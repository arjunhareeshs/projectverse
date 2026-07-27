# Implementation Plan — Admin Panel Directory + Live Performance Ranking

Scope agreed with the user:
- Build the **Directory** feature exactly as specified in [admin_developer_prompt](docs/admin%20part/admin_developer_prompt) (Teams/Students tabs, slide-over detail panels) — currently unbuilt (no `AdminDirectory.tsx` exists yet).
- Replace the static, Excel-imported `GroupRanking` numbers with a **live-computed ranking** based on deadline completeness, finishment (overall completion), and productivity — computed on read, not stored/scheduled.
- Team ranking stays team-level; **student ranking is based on each student's own contribution** (their assigned tasks + their own daily logs), not an inherited team score.
- The new ranking replaces what's currently shown wherever `GroupRanking`/points-based progress appears today (Directory progress bars, Team Trends, Student Trends, `getStats` avgProgress) — the Excel `GroupRanking` table itself is left in the schema untouched (still used for whatever admins imported), but the UI stops reading from it for these "progress/rank" displays.

---

## Part 1 — Ranking Engine (new backend module)

### 1.1 Why a new module
Today "ranking" (`prisma.groupRanking`) is static: seeded once via `importExcelData.ts` / `seed.ts`, never recalculated from what teams/students actually do (`Task`, `DailyWorkLog`, `Milestone`). The admin's request — rank by "deadline completeness, finishment, and productivity" — requires deriving these live from real execution data.

**New file:** `server/src/modules/ranking/ranking.service.ts`

### 1.2 Data inputs (confirmed to exist in schema)
- `Task { dueDate, completedAt, status, assigneeId, projectId }` — deadline + completion signal.
- `DailyWorkLog { projectId, userId, date, hoursSpent }` — productivity/activity signal, already unique per `(projectId, userId, date)`.
- `Milestone { dueDate }` — optional secondary deadline signal at project level (not per-person, so used only in team scoring).
- `Project.teamId`, `ProjectMember { projectId, userId }` — links tasks/logs back to team and student.

### 1.3 Team score formula
For each team, across all its non-template `Project`s and their `Task`s:

```
deadlineCompleteness = onTimeCompletedTasks / tasksWithDueDate     (tasks with no dueDate excluded from denominator)
finishment            = completedTasks / totalTasks                 (all tasks, regardless of due date)
productivity          = min(1, activeLogDays / expectedLogDays)     (expectedLogDays = weekdays since project start, capped)

teamScore (0-100) = round(
  deadlineCompleteness * 40 +
  finishment            * 35 +
  productivity          * 25
)
```
- Teams with zero tasks yet: `finishment`/`deadlineCompleteness` default to `0`, not `null`/skip — a team that hasn't started shouldn't rank above one that has, but shouldn't crash the average either. Flag these as `hasActivity: false` in the response so the UI can show "Not started" instead of a misleading 0%.
- `rank` = 1-based position after sorting all teams by `teamScore` desc (ties broken by `finishment` desc, then team name asc for stability).

### 1.4 Student score formula (individual contribution)
For each student, across `Task`s where `assigneeId === student.id` and `DailyWorkLog`s where `userId === student.id`:

```
deadlineCompleteness = onTimeCompletedOwnTasks / ownTasksWithDueDate
finishment            = completedOwnTasks / totalOwnTasks
productivity          = min(1, ownActiveLogDays / expectedLogDays)   (reuse UserStreak.currentStreak as a cheap secondary signal if present)

studentScore (0-100) = round(
  deadlineCompleteness * 40 +
  finishment            * 35 +
  productivity          * 25
)
```
- Students with no assigned tasks (e.g. not yet added to a project) get `studentScore = 0`, `hasActivity: false`.
- `rank` = 1-based position after sorting all students by `studentScore` desc.

### 1.5 Module shape
```ts
// server/src/modules/ranking/ranking.service.ts
export interface TeamRankingResult {
  teamId: string;
  score: number;            // 0-100
  rank: number;
  deadlineCompleteness: number; // 0-1
  finishment: number;           // 0-1
  productivity: number;         // 0-1
  hasActivity: boolean;
}
export interface StudentRankingResult { /* mirrors the above, keyed by userId */ }

export class RankingService {
  static async getTeamRankings(organizationId: string): Promise<TeamRankingResult[]>;
  static async getStudentRankings(organizationId: string): Promise<StudentRankingResult[]>;
  static async getTeamRanking(teamId: string): Promise<TeamRankingResult | null>;
  static async getStudentRanking(userId: string): Promise<StudentRankingResult | null>;
}
```
- Implemented as a handful of grouped Prisma queries (`groupBy` on `Task` by `projectId`/`assigneeId`, plus a `DailyWorkLog.groupBy` for active-day counts) rather than N+1 loops per team/student — needed since `getTeams`/`getStudents` already paginate up to 50 rows and Directory expects snappy loads.
- Computed on every call (no caching table) per the "live compute" decision. If load ever becomes a concern, revisit with an in-memory TTL cache — not needed at current scale (tens of teams).

### 1.6 Wiring into existing endpoints
Replace `ranking.totalPoints`/`ranking.rank` reads with `RankingService` output in:
- `AdminService.getStats()` — `avgProgress` becomes `average(teamScore)` instead of `average(totalPoints)/10`.
- `AdminService.getTeams()` / `getTeamDetail()` — attach computed `{ score, rank, deadlineCompleteness, finishment, productivity }` per team instead of (or alongside, see 1.7) the `ranking` include.
- `AdminService.getTeamTrends()` — `orderBy` can no longer be a Prisma `orderBy: { ranking: { totalPoints: 'desc' } }` (that field's gone from the sort); fetch teams, compute rankings, sort in JS.
- `AdminService.getStudents()` / `getStudentDetail()` / `getStudentTrends()` — same swap, using `RankingService.getStudentRankings`.
- Directory's team-card progress bar (`progress = ranking ? min(100, totalPoints/10) : 0` per the spec) becomes `progress = score` directly (already 0-100).
- Directory's student-card progress bar (`progress = min(100, (rewardPoints+activityPoints)/2)`) becomes `progress = score` directly, OR keep `rewardPoints/activityPoints` as a separate "engagement points" stat and show the new score as "Performance". **Open question below.**

### 1.7 What happens to `rewardPoints` / `activityPoints` / `GroupRanking.totalPoints`
These remain in the schema and keep being editable by admins (achievements, manual point awards). They are a *different* metric (gamification points) from the new *performance* score (deadline/finishment/productivity). Recommend showing both side-by-side in the Directory/Trends UI rather than deleting the points system — but confirm this during review since it changes what number is "the" ranking number on cards.

---

## Part 2 — Directory Feature (per `admin_developer_prompt`)

Building exactly what the spec describes, now backed by `RankingService` instead of `GroupRanking` for the progress bars.

### 2.1 Files to add
| File | Purpose |
|---|---|
| `client/src/pages/Admin/AdminDirectory.tsx` | Hub page: tab toggle (Teams/Students), search, domain filter, pagination, grid |
| `client/src/pages/Admin/AdminTeamDetailPanel.tsx` | Slide-over: team overview, project, roster, achievements |
| `client/src/pages/Admin/AdminStudentDetailPanel.tsx` | Slide-over: student stats, profile, team, skills |

### 2.2 Files to modify
| File | Change |
|---|---|
| `client/src/layout/AdminLayout.tsx` | Add `{ icon: Users, label: 'Directory', to: '/admin/directory' }` to `adminNav` (line 20-26) |
| `client/src/App.tsx` | Add `<Route path="/admin/directory" element={<AdminDirectory />} />` inside the existing `<Route element={<AdminLayout />}>` block |
| `client/src/services/admin.service.ts` | Add `getTeamById`, `getStudentById` client methods |
| `server/src/modules/admin/admin.routes.ts` | Add `GET /admin/teams/:id` → `getTeamDetail`, `GET /admin/students/:id` → `getStudentDetail` (spec wants these at the top-level path, not nested under `/chat/`; the existing `/chat/teams/:id` / `/chat/students/:id` routes stay as-is for the chat feature — these are new, separate routes reusing the same controller methods) |
| `server/src/modules/admin/admin.service.ts` | `getTeamDetail` needs its `include` extended to `achievements: { orderBy: { date: 'desc' }, take: 10 }` per spec §5; both `getTeamDetail`/`getStudents`/`getTeams` need the `RankingService` wiring from Part 1.6 |

### 2.3 Component behavior (from spec, unchanged)
- Dual pill tabs with count badges from `teamsTotal`/`studentsTotal`.
- Client-side search (name/groupCode for teams; fullName/regNo/email for students) + domain filter dropdown.
- Team cards: domain badge, group code, name, active project title, progress bar (now `RankingService` score), member count, status badge.
- Student cards: initials avatar, name, regNo, email, domain tag, team name, progress bar (now `RankingService` score).
- 12 items/page pagination.
- Slide-over panels: right-side slide-in, `bg-gray-900/40 backdrop-blur-sm` backdrop, closes on outside-click or `Escape`.
- Team panel: 4-col overview (rank, total points → **or score**, member count, completion %), project details, member roster table (adds each member's own student rank/score per the new individual-ranking model), achievements timeline.
- Student panel: 3-col stats (now: performance score, reward points, activity points — see 1.7 open question), profile table, team info card, skills checklist with existing `skillRank`/`totalRanks`.

### 2.4 Acceptance criteria (from spec, unchanged)
- [ ] Directory renders and loads teams by default.
- [ ] Tab switch pulls correct data.
- [ ] Real-time client search filters instantly.
- [ ] Slide-overs render full detail records without overlay conflicts.
- [ ] Escape closes any open drawer.
- [ ] `npm run build` passes with zero TS errors.
- [ ] **New:** Team/Student cards and slide-overs show the live-computed score (not stale Excel points) and match what Team/Student Trends pages show for the same entity.

---

## Open items to confirm before implementation starts
1. **Points vs. performance display** (§1.7): show both `rewardPoints/activityPoints` (gamification) and the new performance score side-by-side, or fully replace one with the other on the cards?
2. **"Expected log days" baseline for productivity**: use project's `createdAt` → today (or team's declared duration from `IntakeWizard`/`DurationStep` if set) as the window over which "active days" is measured? Needs the actual project start/duration field confirmed in the lifecycle intake data.
3. Any specific weighting preference other than the proposed 40/35/25 split for deadline/finishment/productivity — happy to adjust once you see it in practice.
