# ProjectVerse — AI Project Lifecycle Upgrade: Master Overview

> **This file is the map. Read it fully before opening any part file.**
> The actual work is split into three part files that must be executed **in order**:
>
> 1. `PART-1-FOUNDATION.md` — data layer, Project Log JSON, selection-flow changes, intake wizard backend
> 2. `PART-2-AI-ENGINES.md` — the four AI engines (Doc Generator, Personalization, 15-Day Verification, AI Mentor) + admin AI
> 3. `PART-3-FRONTEND.md` — all UI: new selection steps, intake wizard, document viewer/download, Log section, Chat section, reports, admin AI panel
>
> Each part file is self-contained enough for an AI agent to implement alone, but they share the
> **contracts defined in this file**. Any change to a shared contract must be reflected here first.

---

## 1. Motive — what we are building and why

ProjectVerse currently ends its AI involvement at **project selection**: a student navigates the
catalog through a chat interface, passes an AI feasibility interview, and the project is created.
After that, the AI knows nothing about the project's life.

This upgrade turns ProjectVerse into an **AI-supervised project lifecycle platform** for
engineering-college academic projects (6-month scale). The AI:

1. **Generates the official project execution document** (AI Engine 1) — background, objectives,
   deliverables, work breakdown, percentage allocation, skills, milestones, risks, resources,
   success criteria. This document is the reference for the whole project and is **downloadable**.
2. **Guarantees uniqueness between teams** (AI Engine 2) — if 10 teams pick "Smart Irrigation",
   each generated execution plan must genuinely differ in ≥30–40% of execution scope (scope,
   users, dataset, algorithms, sensors, deployment, evaluation…), not just wording.
3. **Verifies daily work logs every 15 days** (AI Engine 3) — students submit daily logs; every
   15 days the AI compiles them, compares against the approved plan + GitHub activity, and
   produces a scored evaluation report (scope adherence, progress, authenticity, plagiarism risk,
   mentor feedback, next-15-day recommendations).
4. **Continuously mentors** (AI Engine 4) — detects delays, suggests next tasks, flags missing
   dependencies, inactive members, overload, timeline risk; recommends learning resources for
   skill gaps.

### The core architectural idea: the Project Log JSON

**The AI never re-reads chat history to make decisions.** Every meaningful decision and event —
project title, type, deadlines (and deadline changes), member allocation, work-package
assignments, technology choices, document versions, modifications — is written into one
canonical, structured **Project Log JSON** per project. Every AI engine answers by reading:

- the relevant project's log JSON (a trimmed view of it, never everything), and
- when relevant, that project's **GitHub analytics** (already collected by the existing
  `github` module).

For the **admin panel**, an AI assistant classifies each admin question, selects only the
project(s) whose log JSON it needs, optionally pulls the GitHub snapshot, and answers — it never
loads every project's JSON at once.

### Flow changes on the student side

1. When a student starts a **new project**, the chat FIRST shows three option pills —
   **Mini Project / Final Year Project / Research Project** — before any catalog navigation.
2. The existing catalog/proposal/mentor-interview flow runs as today.
3. After the project is confirmed, an **intake wizard** collects:
   - **Team members** — picked from a list of registered students (AI can suggest based on skills).
   - **Semester duration** — if unreasonably long for the project type, the AI advises shortening it.
   - **Technologies already decided** (optional) — free entry / upload.
4. AI Engine 1 + Engine 2 then generate the **execution document**, shown in-app and
   downloadable (Markdown + PDF).
5. If the document's required skills are missing from the team's recorded skills
   (`UserSkill` model), the AI attaches **learning directions** per missing skill.
6. Two sections exist per project/team: **Log** (each member enters what they did that day)
   and **Chat** (real-time team chat — the existing `TeamMessage` + Socket.io infrastructure,
   surfaced properly in this flow).

---

## 2. Current codebase facts (verified — do not rediscover)

| Concern | Where it lives today |
|---|---|
| Backend | Express + TypeScript, `server/src/app.ts` mounts routers under `/api/*` |
| Modules pattern | `server/src/modules/<name>/{*.routes.ts, *.controller.ts, *.service.ts}` |
| DB | PostgreSQL 16 + Prisma, schema at `server/database/prisma/schema.prisma` |
| LLM | Groq via `server/src/modules/ai/llm.service.ts` — exports `chat(messages, fallback)`, `chatJSON<T>(messages, fallback)`, `isLlmConfigured()`. Both degrade gracefully without `GROQ_API_KEY`. |
| Selection chat | Client: `client/src/pages/ProjectSelectionChat.tsx` (~844 lines). Server: `server/src/modules/projects/project.catalog.controller.ts` with routes in `project.routes.ts`: `GET /api/projects/catalog/tree`, `POST /api/projects/catalog/validate-proposal`, `POST /api/projects/catalog/propose`, `POST /api/projects/catalog/mentor`, `POST /api/projects/catalog/allocate-team`, `POST /api/projects/catalog/:id/select` |
| GitHub | `server/src/modules/github/` — client, service, controller; models `GithubRepository`, `GithubContributor`, `GithubCommit`, `GithubSnapshot` |
| Teams/chat | Models `Team`, `TeamMember`, `TeamMessage`; Socket.io already wired in server |
| Skills | Model `UserSkill` exists |
| Auth | JWT, `authGuard` middleware, roles Admin / Student |
| Client | React 18 + Vite, Redux Toolkit, Tailwind (HSL tokens), services in `client/src/services/`, pages in `client/src/pages/` |
| Admin | `server/src/modules/admin/`, client pages under `client/src/pages/Admin/` |

**Conventions all parts must follow:** feature modules under `server/src/modules/`, Zod
validation on every mutating endpoint, `authGuard` on all new routes, role checks for
admin-only routes, LLM calls ONLY through `llm.service.ts` helpers with sensible fallbacks
(never let a missing API key break a flow), client API calls through a service file in
`client/src/services/`.

---

## 3. Shared contracts (single source of truth)

These types are created **in Part 1** at `server/src/shared/projectLog.types.ts` and mirrored on
the client at `client/src/types/projectLog.ts`. Parts 2 and 3 import them — never redefine them.

### 3.1 The Project Log JSON (canonical state per project)

```ts
export type ProjectCategory = 'MINI' | 'FINAL_YEAR' | 'RESEARCH';

export interface ProjectLogState {
  version: number;                 // incremented on every write
  projectId: string;
  title: string;
  category: ProjectCategory;
  department?: string;
  createdAt: string;               // ISO
  duration: {
    months: number;
    startDate: string;             // ISO
    endDate: string;               // ISO — recomputed if duration changes
    history: Array<{ at: string; months: number; reason?: string }>;
  };
  team: {
    teamId: string;
    members: Array<{
      userId: string; name: string;
      responsibilities: string[];  // work-package ids
      joinedAt: string; active: boolean;
    }>;
  };
  technologies: string[];          // decided/declared technologies
  executionDoc: {
    currentVersion: number;        // 0 = not generated yet
    generatedAt?: string;
    uniquenessNotes?: string;      // what Engine 2 varied vs similar projects
  };
  workPackages: Array<{
    id: string;                    // slug, e.g. "backend"
    name: string;
    percentage: number;            // all sum to 100
    assignedTo: string[];          // userIds
    status: 'NOT_STARTED' | 'IN_PROGRESS' | 'DONE';
  }>;
  milestones: Array<{
    id: string; name: string; expectedOutput: string;
    dueWeek: number; dueDate: string;
    status: 'PENDING' | 'DONE' | 'MISSED';
    history: Array<{ at: string; dueDate: string; reason?: string }>; // deadline updates
  }>;
  skills: {
    required: string[];
    gaps: Array<{ skill: string; missingFor: string[] /* userIds */ }>;
  };
  github?: { repoFullName: string; linkedAt: string };
  evaluations: Array<{             // summary refs only — full reports live in their own table
    cycle: number; periodStart: string; periodEnd: string;
    authenticity: number; plagiarismRisk: 'LOW' | 'MEDIUM' | 'HIGH';
    overall: number; reportId: string;
  }>;
  flags: Array<{                   // raised by AI Mentor, cleared when resolved
    id: string; at: string; type: 'DELAY' | 'INACTIVE_MEMBER' | 'MISSING_DEPENDENCY'
      | 'OVERLOAD' | 'TIMELINE_RISK' | 'TECH_DRIFT';
    message: string; resolved: boolean;
  }>;
}
```

### 3.2 Log events (append-only audit of every change)

```ts
export type ProjectLogEventType =
  | 'PROJECT_CREATED' | 'CATEGORY_SET' | 'MEMBERS_SET' | 'MEMBER_ADDED' | 'MEMBER_REMOVED'
  | 'DURATION_SET' | 'DURATION_CHANGED' | 'TECHNOLOGIES_SET'
  | 'DOC_GENERATED' | 'DOC_REGENERATED'
  | 'WORK_PACKAGE_ASSIGNED' | 'WORK_PACKAGE_STATUS'
  | 'MILESTONE_UPDATED' | 'DEADLINE_CHANGED'
  | 'GITHUB_LINKED' | 'EVALUATION_ADDED' | 'FLAG_RAISED' | 'FLAG_RESOLVED'
  | 'MANUAL_NOTE';

export interface ProjectLogEventPayload {
  type: ProjectLogEventType;
  actorUserId: string | 'SYSTEM' | 'AI';
  data: Record<string, unknown>;   // event-specific; keep small and structured
  note?: string;
}
```

**Write rule (all parts):** nothing mutates `ProjectLogState` directly. All writes go through
`projectLogService.appendEvent(projectId, event)` (built in Part 1), which applies the event to
the state (reducer style), bumps `version`, persists both, and returns the new state.

**Read rule (all AI engines, Part 2):** engines call `projectLogService.getContext(projectId,
view)` where `view` selects a trimmed slice (`'planning' | 'evaluation' | 'mentor' | 'admin'`)
so prompts stay small. Never dump the entire raw state into a prompt when a view exists.

### 3.3 Daily work log entry

```ts
export interface DailyLogEntry {
  id: string; projectId: string; userId: string;
  date: string;                    // YYYY-MM-DD, one entry per user per project per day
  workDone: string;                // what was done (required)
  hoursSpent?: number;
  blockers?: string;
  evidenceUrls?: string[];         // commit links, screenshots, files
  createdAt: string; updatedAt: string;
}
```

### 3.4 Execution document (Engine 1 output)

Stored as structured JSON + rendered Markdown. Sections are fixed and ordered:

```ts
export interface ExecutionDocContent {
  overview: { background: string; purpose: string; problemStatement: string;
              scope: string; expectedOutcome: string };
  objectives: string[];                               // measurable
  deliverables: string[];                             // only applicable items
  workBreakdown: Array<{ id: string; name: string; description: string;
                         percentage: number }>;       // 3–5 packages, sum 100
  skillsRequired: string[];
  milestones: Array<{ name: string; expectedOutput: string; completionWeek: number }>;
  risks: string[];
  learningResources: Array<{ topic: string; resource: string; url?: string }>;
  successCriteria: string[];
  uniquenessNotes?: string;                           // Engine 2 delta description
}
```

### 3.5 15-day evaluation report (Engine 3 output)

```ts
export interface EvaluationReportContent {
  cycle: number; periodStart: string; periodEnd: string;
  scopeAdherence: { score: number; notes: string };        // /100 each
  technicalProgress: { score: number; notes: string };
  timelineCompliance: { score: number; notes: string };
  memberParticipation: { score: number; notes: string;
                         perMember: Array<{ userId: string; score: number; notes: string }> };
  documentationQuality: { score: number; notes: string };
  authenticityConfidence: { score: number; notes: string };
  plagiarismRisk: 'LOW' | 'MEDIUM' | 'HIGH';
  missingWork: string[];
  suspiciousBehaviour: string[];
  mentorFeedback: string;
  next15DayRecommendations: string[];
}
```

### 3.6 New API surface (implemented in Parts 1–2, consumed in Part 3)

All under `authGuard`. `[A]` = admin-only.

| Method & path | Purpose | Part |
|---|---|---|
| `POST /api/projects/catalog/session/start` | Start selection; body `{ category }` (the 3-option step) | 1 |
| `POST /api/lifecycle/:projectId/intake` | Save members + duration + technologies (wizard steps, idempotent per step) | 1 |
| `POST /api/lifecycle/:projectId/intake/duration-check` | AI advisory on proposed duration | 2 |
| `POST /api/lifecycle/:projectId/intake/suggest-members` | AI member suggestions from student list + skills | 2 |
| `GET  /api/lifecycle/:projectId/log-state` | Current ProjectLogState (role-scoped) | 1 |
| `GET  /api/lifecycle/:projectId/events` | Paginated event history | 1 |
| `POST /api/lifecycle/:projectId/document/generate` | Run Engine 1 (+ Engine 2 pass) | 2 |
| `GET  /api/lifecycle/:projectId/document` | Latest doc (JSON + markdown) | 2 |
| `GET  /api/lifecycle/:projectId/document/download?format=md\|pdf` | Download | 2 |
| `POST /api/lifecycle/:projectId/daily-log` | Create/update today's entry | 1 |
| `GET  /api/lifecycle/:projectId/daily-logs?from&to&userId` | List entries | 1 |
| `POST /api/lifecycle/:projectId/evaluation/run` | Run Engine 3 for current cycle `[A]` (+ cron) | 2 |
| `GET  /api/lifecycle/:projectId/evaluations` | List reports (summary) | 2 |
| `GET  /api/lifecycle/:projectId/evaluations/:reportId` | Full report | 2 |
| `GET  /api/lifecycle/:projectId/mentor/status` | Engine 4 snapshot (flags, next tasks, on-time estimate) | 2 |
| `POST /api/lifecycle/:projectId/mentor/ask` | Ask the mentor a question (reads log JSON, not chat) | 2 |
| `POST /api/admin/ai/ask` | Admin AI: `{ question }` → routed answer `[A]` | 2 |

Route mounting: new module `server/src/modules/lifecycle/` mounted at `/api/lifecycle` in
`app.ts`; admin AI lives in the existing `admin` module.

---

## 4. What each part file does

### `PART-1-FOUNDATION.md` — Data layer & flow plumbing (no LLM logic)
- Prisma schema additions: `ProjectLog` (state snapshot, JSONB), `ProjectLogEvent`
  (append-only), `DailyWorkLog`, `ExecutionDocument`, `EvaluationReport`; enum `ProjectCategory`;
  migration.
- `server/src/shared/projectLog.types.ts` + client mirror — the contracts above.
- `projectLogService` — event reducer, `appendEvent`, `getState`, `getContext(view)` (context
  builder with the four trimmed views), backfill hook for existing projects.
- Selection flow change: category-first step endpoint; wire category into project creation.
- Intake endpoints (members/duration/technologies) — pure CRUD + log events; the AI advisory
  endpoints are stubbed to return `{ available: false }` until Part 2 lands.
- Daily log CRUD with one-entry-per-user-per-day upsert semantics.
- Route module `lifecycle`, Zod schemas, tests.

### `PART-2-AI-ENGINES.md` — All LLM logic (server-side)
- Prompt files per engine under `server/src/modules/lifecycle/prompts/` (system instructions
  derived from the spec PDF, adapted — the PDF prompts are the base system instructions).
- Engine 1: execution-document generation from log-state `planning` view → `ExecutionDocContent`
  via `chatJSON`, markdown renderer, PDF export, versioning, `DOC_GENERATED` event.
- Engine 2: similarity retrieval over existing projects/docs in the same domain + variation
  pass folded into Engine 1's generation (single LLM call chain), `uniquenessNotes` recorded.
- Engine 3: 15-day cycle compiler (daily logs + log-state `evaluation` view + GitHub commits) →
  `EvaluationReportContent`, scheduled via cron per project, manual trigger for admins.
- Engine 4: mentor status computation (mixed deterministic checks + LLM narration), flags into
  log state, `mentor/ask` Q&A over the `mentor` view, skills-gap learning directions.
- Duration advisory + member suggestion (the two intake AI endpoints stubbed in Part 1).
- Admin AI router: question classification → project resolution → load only needed log JSON
  view(s) + GitHub snapshot → answer.
- Every engine MUST work degraded (deterministic fallback) when `isLlmConfigured()` is false.

### `PART-3-FRONTEND.md` — All client work
- Selection chat: 3-option category step first; pass category through the flow.
- Post-confirmation intake wizard (members picker w/ AI suggest, duration w/ AI advisory,
  technologies) and execution-document screen with download (md/pdf) + skills-gap learning
  directions display.
- New project sections: **Log** (daily entry form + team log timeline) and **Chat** (real-time
  team chat using existing Socket.io/TeamMessage, surfaced in the project workspace).
- Evaluation reports UI (cycle list, scored report view with the parameter table).
- Mentor panel (flags, next tasks, ask-the-mentor).
- Admin AI assistant page in the admin portal.
- Service files, Redux slices where state is shared, routing, role gating.

---

## 5. Execution order & integration rules

1. **Order is 1 → 2 → 3.** Part 2 imports Part 1's service and types; Part 3 consumes both.
2. If a part is worked in parallel anyway: Part 2 may mock `projectLogService` against the
   contract types; Part 3 may build against the API table in §3.6 with MSW-style mocks — but
   final integration must use the real implementations.
3. **Contract changes**: if any part discovers a needed contract change, update THIS file's §3
   first, then the affected part files, then code. Never let code drift from this file.
4. **Definition of done per part** is listed at the end of each part file; a part is not done
   until its checklist passes, `npx tsc --noEmit` is clean in both `server/` and `client/`,
   and the dev servers boot (`server_run.log` / `client_run.log` pattern already used in repo).
5. **Non-negotiables everywhere**: authGuard + role checks, Zod on mutations, LLM only via
   `llm.service.ts` with fallbacks, all state changes through `appendEvent`, prompts kept in
   dedicated files (not inlined in controllers), no breaking changes to existing selection,
   teams, tasks, or GitHub features.
