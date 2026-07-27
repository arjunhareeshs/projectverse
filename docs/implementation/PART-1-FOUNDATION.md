# PART 1 — Foundation: Data Layer, Project Log JSON, Flow Plumbing

> Prerequisite reading: `00-OVERVIEW.md` (especially §2 codebase facts and §3 shared contracts).
> This part contains **no LLM logic**. It builds the data spine that Parts 2 and 3 stand on.
> Where an endpoint will later be AI-powered, build it now with a deterministic stub that
> returns `{ available: false }` so Part 3 can be built and Part 2 can slot in.

## Goals

1. Persist the **Project Log JSON** — one canonical `ProjectLogState` per project, mutated only
   through append-only events with a reducer.
2. Add Prisma models: `ProjectLog`, `ProjectLogEvent`, `DailyWorkLog`, `ExecutionDocument`,
   `EvaluationReport`, and the `ProjectCategory` enum.
3. Change the selection flow so the **project category (Mini / Final Year / Research) is chosen
   first**, before catalog chat, and flows into project creation.
4. Build the **intake wizard backend**: team members, semester duration, technologies.
5. Build **daily work log** CRUD.
6. Create the `lifecycle` module and mount it; define all shared types.

---

## 1. Shared types

Create `server/src/shared/projectLog.types.ts` containing **exactly** the interfaces from
`00-OVERVIEW.md` §3.1–§3.5 (`ProjectLogState`, `ProjectLogEventType`, `ProjectLogEventPayload`,
`DailyLogEntry`, `ExecutionDocContent`, `EvaluationReportContent`, `ProjectCategory`).
Create the client mirror `client/src/types/projectLog.ts` with the same content (client uses it
in Part 3; create it now so the contract ships together).

## 2. Prisma schema additions

Edit `server/database/prisma/schema.prisma`. Follow existing model style (cuid ids, `createdAt`
/ `updatedAt` where present). Then create one migration: `npx prisma migrate dev
--name lifecycle_foundation` (run from wherever the repo's prisma commands are run — check
`server/package.json` scripts first and use the existing script if one exists).

```prisma
enum ProjectCategory {
  MINI
  FINAL_YEAR
  RESEARCH
}

model ProjectLog {
  id          String   @id @default(cuid())
  projectId   String   @unique
  project     Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  version     Int      @default(0)
  state       Json     // ProjectLogState
  updatedAt   DateTime @updatedAt
  createdAt   DateTime @default(now())
  events      ProjectLogEvent[]
}

model ProjectLogEvent {
  id          String     @id @default(cuid())
  logId       String
  log         ProjectLog @relation(fields: [logId], references: [id], onDelete: Cascade)
  seq         Int        // monotonically increasing per log; equals state.version after apply
  type        String     // ProjectLogEventType
  actorUserId String     // userId | "SYSTEM" | "AI"
  data        Json
  note        String?
  createdAt   DateTime   @default(now())

  @@unique([logId, seq])
  @@index([logId, type])
}

model DailyWorkLog {
  id           String   @id @default(cuid())
  projectId    String
  project      Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  userId       String
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  date         DateTime @db.Date
  workDone     String
  hoursSpent   Float?
  blockers     String?
  evidenceUrls Json?    // string[]
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  @@unique([projectId, userId, date])
  @@index([projectId, date])
}

model ExecutionDocument {
  id         String   @id @default(cuid())
  projectId  String
  project    Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  version    Int
  content    Json     // ExecutionDocContent
  markdown   String   // rendered markdown, source of truth for download
  createdAt  DateTime @default(now())

  @@unique([projectId, version])
}

model EvaluationReport {
  id           String   @id @default(cuid())
  projectId    String
  project      Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  cycle        Int      // 1, 2, 3… (15-day cycles)
  periodStart  DateTime
  periodEnd    DateTime
  content      Json     // EvaluationReportContent
  createdAt    DateTime @default(now())

  @@unique([projectId, cycle])
}
```

Also add to the existing `Project` model:

```prisma
  category      ProjectCategory?   // null for legacy projects
  // + back-relations: projectLog ProjectLog?, dailyWorkLogs DailyWorkLog[],
  //   executionDocuments ExecutionDocument[], evaluationReports EvaluationReport[]
```

(Add the matching back-relation on `User` for `DailyWorkLog`.)

## 3. The `projectLogService` (heart of this part)

New module: `server/src/modules/lifecycle/`. Files:

```
lifecycle/
  lifecycle.routes.ts
  lifecycle.controller.ts
  projectLog.service.ts      // state + events + reducer + context views
  dailyLog.service.ts
  intake.service.ts
  lifecycle.schemas.ts       // Zod
```

### 3.1 `projectLog.service.ts` API

```ts
initLog(projectId, seed: { title, category, teamId, durationMonths, startDate }): Promise<ProjectLogState>
appendEvent(projectId, event: ProjectLogEventPayload): Promise<ProjectLogState>
getState(projectId): Promise<ProjectLogState | null>
getEvents(projectId, opts: { cursor?, limit?, types? }): Promise<{ events; nextCursor }>
getContext(projectId, view: 'planning' | 'evaluation' | 'mentor' | 'admin'): Promise<object>
```

**`appendEvent` semantics (critical):**
1. Load `ProjectLog` row for the project (create via `initLog` path if absent — but callers
   should normally have initialized it).
2. Run the pure reducer `applyEvent(state, event): ProjectLogState` (see below).
3. In **one transaction**: insert `ProjectLogEvent` with `seq = version + 1`, update
   `ProjectLog.state` and `version = version + 1`.
4. Use the `@@unique([logId, seq])` constraint as the optimistic-concurrency guard: on unique
   violation, reload and retry once, then fail with 409.

**Reducer** (`applyEvent`, pure function, exhaustive `switch` on `event.type`):
- `MEMBERS_SET` → replace `team.members` (mark removed ones `active:false` rather than delete).
- `DURATION_SET` / `DURATION_CHANGED` → set months, recompute `endDate`, push into
  `duration.history`.
- `DEADLINE_CHANGED` → update the milestone's `dueDate` and push `{at, dueDate, reason}` into
  that milestone's `history`.
- `DOC_GENERATED` → set `executionDoc.currentVersion/generatedAt/uniquenessNotes`, and replace
  `workPackages`, `milestones`, `skills.required` from `event.data` (Engine 1 supplies them).
- `WORK_PACKAGE_ASSIGNED` → set `assignedTo` and mirror into members' `responsibilities`.
- `EVALUATION_ADDED` → push summary into `evaluations`.
- `FLAG_RAISED` / `FLAG_RESOLVED` → manage `flags`.
- `GITHUB_LINKED` → set `github`.
- Unknown type → throw (never silently ignore; the event log is the audit trail).

Keep the reducer in its own file if it grows (`projectLog.reducer.ts`) and **unit-test it**
(pure function — test every event type: apply to a seed state, assert the delta and that
`version` handling stays in the service, not the reducer).

### 3.2 Context views (`getContext`)

The reason this exists: **AI prompts must stay small and relevant**. Each view returns a plain
object (subset/reshape of state, plus joins where noted):

- `planning`: title, category, department, duration, team member names + skills (join
  `UserSkill`), technologies. Used by Engine 1/2.
- `evaluation`: workPackages, milestones (+status/history), team members + responsibilities,
  duration, executionDoc summary, last evaluation summary. Used by Engine 3.
- `mentor`: workPackages, milestones, flags, recent evaluations, team activity summary
  (daily-log counts per member for last 15 days — join `DailyWorkLog`). Used by Engine 4.
- `admin`: one-screen summary — title, category, team, % time elapsed vs milestone status,
  latest evaluation scores, open flags, github repo name. Used by Admin AI.

### 3.3 Hooking into project creation (the existing flow)

In `project.catalog.controller.ts` → `selectProject` (and the custom-proposal finalize path),
after the project is created/finalized: call `projectLogService.initLog(...)` with the chosen
category, then `appendEvent({type:'PROJECT_CREATED', ...})`. Category comes from the session
(see §4). For the GitHub attach path (wherever repo linking happens in `github` module or
project finalize), append `GITHUB_LINKED`.

**Backfill:** add script `server/src/scripts/backfillProjectLogs.ts` that creates a minimal
`ProjectLog` for existing active projects (category null → default `FINAL_YEAR`, note
`MANUAL_NOTE` event "backfilled"). Follow the style of existing scripts in that folder.

## 4. Category-first selection step

The requirement: when a student starts a new project, they FIRST pick one of
**Mini Project / Final Year Project / Research Project**, and only then the catalog chat begins.

Backend work in this part (UI in Part 3):
- Add `POST /api/projects/catalog/session/start` → body `{ category: ProjectCategory }`
  (Zod-validated). Persist the choice server-side keyed to the user (simplest robust option:
  a small `SelectionSession` — reuse if the selection flow already persists session state;
  inspect `project.catalog.controller.ts` first. If the current flow is stateless/client-driven,
  it is acceptable to instead accept `category` as a required field on
  `POST /api/projects/catalog/:id/select` and on the propose/finalize endpoint — choose the
  approach that matches how the existing flow actually carries state, and document the choice
  in code comments).
- Ensure category ends up on the created `Project.category` and in the log state.

## 5. Intake wizard backend

`POST /api/lifecycle/:projectId/intake` — one endpoint, step-discriminated body (Zod
discriminated union), idempotent per step, and each step appends its event:

```ts
{ step: 'members',      memberUserIds: string[] }          // → MEMBERS_SET (+ TeamMember sync)
{ step: 'duration',     months: number, startDate?: string } // → DURATION_SET
{ step: 'technologies', technologies: string[] }           // → TECHNOLOGIES_SET
```

Rules:
- Caller must be a member of the project's team (or its creator) — reuse existing membership
  check helpers from `teams`/`projects` modules if present.
- `members` step: validate userIds exist and are Students; sync `TeamMember` rows for the
  project's team (add missing, deactivate removed) so the rest of the app (chat, boards) sees
  the same team.
- `duration` step: only range-validate here (1–12 months). The "AI says shorten it" advisory is
  `POST /api/lifecycle/:projectId/intake/duration-check` — **stub in this part**:
  return `{ available: false, advisory: null }`. Part 2 replaces the internals.
- `POST /api/lifecycle/:projectId/intake/suggest-members` — same stub pattern:
  `{ available: false, suggestions: [] }`.

`GET /api/lifecycle/:projectId/log-state` returns the full state for team members; for
Students not on the team → 403; Admin → allowed.
`GET /api/lifecycle/:projectId/events` — paginated, newest first, optional `types` filter.

## 6. Daily work log

`dailyLog.service.ts` + endpoints:

- `POST /api/lifecycle/:projectId/daily-log` — body `{ date?, workDone, hoursSpent?, blockers?,
  evidenceUrls? }`. `date` defaults to today (server date, `YYYY-MM-DD`). **Upsert** on
  `(projectId, userId, date)` — a student edits today's entry freely; editing entries older
  than 2 days is rejected (409) to keep logs honest (Engine 3 depends on this).
- `GET /api/lifecycle/:projectId/daily-logs?from&to&userId` — team members see all team
  entries; admins see all. Order by date desc, then user.
- Do **not** write a `ProjectLogEvent` per daily entry (too chatty); daily logs are their own
  table and Engine 3 reads them directly.

## 7. Wiring

- `lifecycle.routes.ts`: `router.use(authGuard)` at top, mount all routes above.
- `server/src/app.ts`: `app.use('/api/lifecycle', lifecycleRoutes);` next to existing mounts.
- All request bodies validated with Zod in `lifecycle.schemas.ts`; validation errors → 400 with
  the same error shape the existing `errorHandler` produces (inspect `middleware/` first).

## 8. Definition of done (Part 1)

- [ ] Migration applies cleanly on a fresh DB and on the existing dev DB.
- [ ] Reducer unit tests: every event type covered; unknown event throws.
- [ ] Service test (or script): init → append 5 mixed events → `getState.version === 5`,
      events readable in order; concurrent append retries correctly.
- [ ] `getContext` returns the four views with the documented shapes; none exceeds ~2–3 KB of
      JSON for a typical project.
- [ ] Category-first endpoint works; a project created through the full selection flow has
      `category` set and a `ProjectLog` with `PROJECT_CREATED`.
- [ ] Intake steps append correct events and sync `TeamMember`.
- [ ] Daily-log upsert + edit-window rule verified.
- [ ] Stub AI endpoints return `{ available: false }` shapes.
- [ ] `npx tsc --noEmit` clean in `server/`; server boots; existing selection flow, teams,
      tasks, github routes unaffected (smoke-test them).
