# ProjectVerse — Page-by-Page Fix Protocol

Fix ProjectVerse one page at a time. Correct the existing flow — do not redesign it.

## 1. Objective

Make the full chain correct for one page at a time:

```
Component -> Frontend service -> Endpoint -> Route -> Controller
-> Backend service -> Prisma query -> DB model -> Typed DTO -> Render
```

The page must show real backend-driven data. Empty DB → backend returns safe zero/empty
states. Never fake values.

## 2. Hard Rules

**Never without being asked:** mount orphaned components · add UI sections · redesign layout
or styling · refactor unrelated code · fix other pages mid-task · build endpoints for dead
code · add hardcoded fallbacks to fill a page · persist generated fake data as real ·
hand-patch DB rows as the fix.

**Always:** understand what's actually live before editing (a file existing ≠ it being used) ·
preserve user changes · report out-of-scope findings instead of acting on them · ask when
scope is unclear.

**Test before every edit:** *"Did the user ask for this, or did I decide it was a good idea?"*
If the second — report it, don't do it.

## 3. Database

Never change the DB page-by-page. Before any DB change, confirm:
does `schema.prisma` have it? does the live DB have it? do migrations create it? is this
really a schema problem, or just a query/DTO/endpoint problem?

- **Migration** → schema changes only
- **Seed script** → sample/demo data only
- **Application logic** → status, counters, points, progress, all normal data updates

No migrations for: status/counter/points updates, empty states, DTO renames, endpoint paths,
hardcoded-value fixes, normal CRUD. Never use a Prisma field that isn't in the schema.

**Repo state (verified 2026-08-12):** live DB has all ~51 tables and matches `schema.prisma`,
but there is **no `_prisma_migrations` table** — schema was built via `db push`. The 3
migration files cover a fraction of it, so `migrate deploy` on a fresh env would build a
broken DB. A baseline migration is still owed. Doesn't block page work on the current DB.
Note: `prisma` commands here need `--schema=database/prisma/schema.prisma`.

## 4. Audit First

Read only files relevant to the page. Report, then wait for approval before implementing
(unless already told to proceed).

Answer: which route/component is live · which children are actually used · which files are
orphaned · what the page displays · which service functions and endpoints are called · which
route/controller/service handles each · which Prisma models are queried · what DTO comes back ·
whether the frontend expects that same shape · what's hardcoded/mock/fake · what endpoints are
missing or unused · what logic wrongly lives in the frontend · what empty/loading/error states
are missing.

### Report format

```
## Page / Component Tree
Route · Live component · Live children · Orphaned files · Sections displayed

## Frontend Service Calls
| Function | Method | Endpoint | Called From | Notes |

## Backend Mapping
| Endpoint | Route File | Controller | Service Logic | Prisma Models |

## Response DTO Shapes
<per endpoint, as ts>

## Hardcoded / Mock / Fake Data
Item · Location · Why wrong · Correct replacement

## Mismatches / Missing Endpoints
Issue · Frontend expects · Backend returns · Correct fix

## Out-of-Scope Findings
Finding · Why not fixing now

## Recommended Fix Scope
Fix now · Don't fix now · Needs user decision
```

## 5. Implementation

One vertical slice only. Backend logic → endpoint (only if needed) → Prisma query → stable
typed DTO → frontend service → live component. Remove hardcoded values from the live page.
Preserve existing UI design. Verify.

**Fake data lives in many places** — component, service, controller, backend service, seed
fallback, generated DB rows, static arrays, fake counters/dates/charts/activity/status/points/
progress. Replace all of them with real logic. When empty, return `{ count: 0, items: [] }` or
the page's equivalent. Never silently fall back to demo data; if demo mode is genuinely needed
it must be user-approved and flagged in the DTO (`{ source: "demo" }`).

**Business logic belongs on the backend** — scores, rankings, points, progress, status
transitions, eligibility, permissions, analytics, evaluations, deadlines, activity summaries,
team/project metrics. The frontend may format for display; it must not invent domain values.

**DTOs must be predictable.** No guessing between `overall` and `overallScore`. Fix the backend
DTO or the frontend type so they match exactly. Don't return raw Prisma objects where the UI
needs a stable contract. Prefer one page-level summary endpoint (backend fans out with
`Promise.all`) over many scattered requests — but only introduce one if it genuinely simplifies
the live page and the user approves.

**Orphaned code** is not part of the page. Don't edit, mount, or build endpoints for it. Report
it and ask whether to delete, wire, or defer.

## 6. Verification — mandatory

```bash
cd server && npx tsc --noEmit -p .
cd client && npx tsc --noEmit -p .
curl -s -H "Authorization: Bearer $TOKEN" "http://localhost:4000/api/<path>"
```

Confirm: endpoint exists · returns the expected DTO · works with real data · works with an
empty DB · frontend calls the right URL and reads the right fields · page doesn't crash ·
loading, empty, and error states all work.

Never claim verification you didn't run. If you couldn't run it, say why. If a check failed,
show the output. If the browser shows stale cached data, say so — don't report a fix you
didn't observe.

## 7. Post-Fix Report

**What was broken** · **What changed** · **Files changed** · **Endpoint/model/page affected** ·
**Verification** (command + result) · **Remaining risks / out-of-scope**. Factual and specific.

## 8. Flow

Audit relevant files → report live tree and data flow → identify fake data and
endpoint/DTO/ORM/schema issues → ask if scope is unclear → implement approved live-page fixes
only → verify backend, frontend, empty state, real data → report what changed → next page only
after approval.

## 9. Pages

```
Auth/Profile · Dashboard ✅ · Projects/My Projects · Project Catalog · Propose Idea
Project Detail Workspace · Daily Logs · Team & Features Allocation
Phase Execution Plan & Reviews · 15-Day Evaluations · Team Pages · Documents
Notifications ✅ · Admin Top Teams · Admin Top Students · Admin Overlaps
Admin Standouts · Admin Upload · GitHub Analytics
```

**Watch for:** `RoleType` enum drift · models used in code but missing from migrations ·
evaluations returning `overall`/`authenticity` where the frontend wants `overallScore`/
`authenticityScore` · GitHub analytics calling undefined endpoints · orphaned components
(common here — always confirm what's actually rendered).

## 10. Principle

Fix what exists. Don't imagine a better app. Don't add features unless asked. Make the current
live page correct, backend-driven, typed, verified, stable.

---

### Appendix — Dashboard (done 2026-08-12)

| Component | Was | Now |
|---|---|---|
| Streak/heatmap | hash-faked grid, hardcoded 12/28, persisted to DB | real `DailyWorkLog` dates + computed streaks |
| Projects Active | all org projects | scoped to `ProjectMember.userId` |
| Hours Focused | `fakeStreak * 0.15 + 10` | `SUM(DailyWorkLog.hoursSpent)` |
| Team Growth | headcount + broken cumulative `reduce` | projects + `RewardTransaction` + `GithubCommit`; bug fixed |
| Deadlines | `Task.dueDate` only | `Task` + `Milestone` + `ProjectPhase`, merged/sorted |
| Recent Activity | `ActivityLog` (nothing writes to it) | `Task` updates + `PhaseSubmission` |
| Hackathons/LeetCode | silent hardcoded fallback | DB only, empty when empty |

Deleted dead code: `AiInsightsPanel.tsx` (called nonexistent `/dashboard/insights`),
`ActiveProjectsList.tsx`, `DashboardActionRow.tsx`, `KpiMetricsRow.tsx`, `getInsights()`.

`StudentDashboardProfile.tsx` stays on disk, **unmounted** — it was mounted once unasked and
reverted. Do not mount it unless explicitly requested.

Remaining risk: no baseline migration; no RBAC on `/dashboard` beyond `authGuard`.
