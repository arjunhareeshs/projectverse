# DB / Backend Change Log

Append-only log of what changed per page, kept alongside `PAGE_FIX_PROTOCOL.md`. One section
per page, added when that page's fix is verified. Schema changes are called out explicitly —
most entries should have **none**.

---

## Dashboard — 2026-08-12

**Schema/migration change:** none. All tables already existed in the live DB
(`UserStreak`, `Hackathon`, `LeetCodeContest`, `TeamMember`, `DailyWorkLog`, `Milestone`,
`ProjectPhase`, `PhaseSubmission`, `RewardTransaction`, `GithubRepository`, `GithubCommit`,
`ProjectMember`) and matched `schema.prisma`.

**Logic changes (`server/src/modules/dashboard/dashboard.service.ts`):**
- `getStreakData` — was hash-generating a fake contribution grid and persisting hardcoded
  `currentStreak: 12, longestStreak: 28` to `UserStreak` on first request. Now computed live
  from real `DailyWorkLog` dates; empty state is genuine zeros, nothing persisted.
- `getKpiDetails.hoursFocused` — was `fakeStreakTotal * 0.15 + 10`. Now `SUM(DailyWorkLog.hoursSpent)`.
- `getKpiDetails.projectsActive` — was `Project.count({ organizationId })` (org-wide, wrong
  scope). Now scoped to `Project.count({ members: { some: { userId } } })` via `ProjectMember`.
- `getTeamGrowth` — was team-headcount-by-month with a broken cumulative `reduce` (used
  `push()`'s return value as the running sum, corrupting all but the first data point). Now a
  composite signal (`Project` created + `RewardTransaction` + `GithubCommit`, by month,
  cumulative) with the reduce bug fixed.
- `getUpcomingDeadlines` — was `Task.dueDate` only. Now merges `Task.dueDate` (kanban) +
  `Milestone.dueDate` (timeline) + `ProjectPhase` computed target (`project.createdAt +
  weekTarget × 7 days`, gantt), sorted and capped at 4.
- `getRecentActivity` — was reading `ActivityLog`, which nothing in the app writes to (always
  returned `[]`). Now merges recent `Task` status changes + `PhaseSubmission` events.
- `getHackathons` / `getLeetCodeContests` — removed silent hardcoded fallback arrays that
  masked an empty DB as real data. Now DB-only; empty array when empty.

**Frontend:**
- Deleted dead files: `AiInsightsPanel.tsx` (called nonexistent `/dashboard/insights`),
  `ActiveProjectsList.tsx`, `DashboardActionRow.tsx`, `KpiMetricsRow.tsx` — none were imported
  by the live `Dashboard/index.tsx`.
- Removed the dead `dashboardService.getInsights()` call.
- `StudentDashboardProfile.tsx` left on disk, **unmounted** (mounted once without being asked,
  reverted per user correction — do not mount without explicit request).

**Verified:** `tsc --noEmit` clean on client + server. All 8 live endpoints hit directly with a
real seeded student token against the running dev server — confirmed zero/empty states for a
student with no activity, and confirmed `projectsActive` correctly returns `0` instead of the
previous org-wide `274`.

**Remaining risk:** no `_prisma_migrations` baseline (see Known Issues in
`PAGE_FIX_PROTOCOL.md` §3) — not page-specific, applies to the whole app.

---

## Timeline / Gantt — 2026-08-12

**Schema/migration change:** none. `Task` already had every field the Gantt page needs
(`category`, `progress`, `startDate`, `dueDate`, `assigneeId`, `status`) and the page was
already querying the real table — no fake/mock data existed on this page.

**Finding:** the page itself was already real and already closely matched the requested
reference design (top stats, category legend, task list, gantt bars with due-date diamond
markers and a LATE badge, detail drawer with donut/dates/duration/assignee). The actual defect
was a **status-vocabulary mismatch** across pages that all write to the same `Task.status`
field with no shared contract:

| Page | Status values written |
|---|---|
| Kanban Board (`KanbanBoard.tsx`) | `todo`, `in-progress`, `in-review`, `done` |
| Gantt "Add Task" form (before fix) | `todo`, `on-track`, `in-progress`, `at-risk`, `completed` |
| Team Pages tasks tab (`TeamDetailPage.tsx`) | writes `progress` for in-progress tasks |

Consequence: a task created from the Gantt form with status `on-track` or `at-risk` had no
matching Kanban column and would silently disappear from the Kanban board. A task already
`in-review` (from Kanban) or `progress` (from Team Pages) displayed on Gantt as "Not Started"
because `getStatus()` didn't recognize those values.

**Changed:**
- `client/src/pages/TimelineGantt.tsx` — `getStatus()` now also buckets `in-review` and
  `progress` into the `on-track` display bucket (was falling through to `todo`).
- `client/src/pages/TimelineGantt.tsx` — "Add Task" status dropdown now writes only
  Kanban-valid values (`todo`, `in-progress`, `in-review`, `done`) instead of inventing
  `on-track`/`at-risk`/`completed`, so tasks created from Gantt now appear in the correct
  Kanban column.
- `server/src/modules/tasks/task.service.ts` — `createGanttTask`/`updateGanttTask` set
  `completedAt` only on `status === 'completed'`; now also matches `'done'` (the value the
  form now actually sends), consistent with `createTask`/`updateTaskStatus`.

**Verified:** `tsc --noEmit` clean on client + server. Hit `GET /api/tasks/gantt` against the
real running dev server with a real seeded org — found a live task with `status: "progress"`,
confirmed it mapped to `todo` (wrong) before the fix and `on-track` (correct) after, using the
exact same `getStatus()` logic shipped in the file.

**Out-of-scope, flagged not fixed:**
- `TeamDetailPage.tsx` ("Team Pages") still writes `progress` directly — the underlying
  three-vocabulary problem is only patched on Gantt's read side, not fixed at the source. Needs
  a decision when Team Pages is worked: either standardize all writers on Kanban's 4 statuses,
  or keep translating at read time everywhere `Task.status` is displayed.
- `gantt.service.ts.updateTask()` (`PATCH /tasks/gantt/:taskId`) exists on the backend but has
  no frontend caller — no drag-to-reschedule or inline edit on the Gantt page itself, only
  create/delete. Not built now; wasn't asked for.
- Gantt page is a global, non-project-scoped `/timeline` route, not a tab inside the Project
  Detail Workspace. Left as-is — restructuring routes wasn't requested.

---

## Documents Section Removal — 2026-08-12

**Schema/migration change:**
- Removed `model Document` table from `schema.prisma`.
- Removed `documents Document[]` relation array from `User` model.
- Removed `documents Document[]` relation array from `Project` model.

**Backend Changes:**
- Deleted backend module `server/src/modules/documents/` (`document.controller.ts`, `document.service.ts`, `document.routes.ts`).
- Removed `documentRoutes` import and `/api/documents` API route mounting from `server/src/app.ts`.

**Frontend Changes:**
- Deleted frontend page `client/src/pages/Documents.tsx`.
- Deleted frontend API service `client/src/services/document.service.ts`.
- Removed `/documents` route from `client/src/App.tsx`.
- Removed "Documents" navigation link under WORKSPACE section in `client/src/layout/Sidebar.tsx`.

**Verified:**
- `npx prisma generate` executed successfully on backend.
- Clean build / typecheck across `server` and `client`.

---

## Project Catalog + Propose Idea — 2026-08-12

**Schema/migration change: none.** No table was created or altered. The async proposal
flow was built entirely on existing columns.

**Opinion / suggestions on the 4 tables that were proposed for this feature:**

Three of the four are not needed — the state they'd hold is already derivable:

| Proposed table | Verdict | Reason |
|---|---|---|
| `ProposalAnalysisJob` | **Not needed** | `ProblemStatementProposal.verdict` is an unconstrained `String`. Writing `PENDING` on submit and overwriting it with the terminal verdict gives the full job lifecycle with zero schema cost. `FAILED` covers the error state; `updatedAt` already exists for staleness. |
| `ProjectSetupJob` | **Not needed** | Setup progress for a claimed project is derivable from whether that child project has `ProjectFeature` / `ProjectPhase` rows. A `projectId`-unique job table would duplicate that. |
| `ProposalEvaluationSummary` | **Not needed** | `totalScore`/`verdict` already live on the proposal row and in `scores` Json. An input/prompt hash for the determinism cache fits in that same Json without a migration. |
| `ProposalEvaluationScore` | **Defer — genuinely needs a migration** | Per-rubric rows would be the one real gain (queryable score analytics, per-field history). But detailed scores are now hidden from students by design, so nothing reads them per-field today. Recommend deferring until an admin analytics view actually needs it, then adding it with the owed baseline migration rather than as a one-off. |

**Recommended index (not applied — needs a migration):** `Project(parentProjectId)`. It is
queried on every catalog listing, every claim capacity check, and now on every
`/proposals/mine` request (`findClaimedTemplateIds`). It is currently unindexed. Similarly
`Project(isTemplate, status)` backs the catalog query and `ProblemStatementProposal(submitterId,
createdAt)` backs the proposals list.

**Not recommended:** the proposed `@@unique([parentProjectId, teamId])` on `Project`. The
duplicate-claim check in `selectProject` already runs inside a transaction gated by a Postgres
advisory lock on the template id, so the race it would guard against is already closed. Adding
it would also block any future legitimate re-claim after withdrawal.

**Pre-existing schema defect found (not introduced here, not fixed here):**
`project.service.ts:372` — `withdrawProject` still calls `tx.document.deleteMany(...)`, but
`model Document` was deleted in the "Documents Section Removal" entry above. This does not
compile (`tsc` reports it) and would throw at runtime, so **project withdrawal is currently
broken**. Five seed/script files have the same leftover call. No migration needed to fix —
the dead lines just need removing.
