# ProjectVerse — Business Features Implementation Plan

> **Scope.** This document turns every idea brainstormed in the product/analyst discussion —
> selection friction (G), project-management friction (H), admin analytics (I), and the
> senior-analyst validation layer (V) — into a concrete, buildable engineering plan.
>
> **It is the execution companion to `AI_IMPROVEMENTS_PLAN.md` Part 6.** Read that first for the
> *why*; this doc is the *how* — logic, code, plug-in points, and explicit do/don't per feature.
>
> **The two governing constraints are unchanged and non-negotiable:**
>
> 1. **🚫 No schema migration.** No `schema.prisma` edits, no `migrate dev`, no `db push`, no new
>    tables/columns. Everything below lands in existing tables, JSON `content`/`state`, event
>    `data`, or is computed on read. New "event types" and "flag types" are **TypeScript union
>    additions**, not DB changes.
> 2. **Deterministic code decides; the LLM only narrates.** Every score, flag, risk band, fit %,
>    and funnel number is computed in auditable code. The model turns numbers into prose — never
>    the reverse.

---

## Table of contents

- [Part 0 — Architecture & ground rules](#part-0--architecture--ground-rules)
- [Part 1 — Shared substrate (build first)](#part-1--shared-substrate-build-first)
- [Part 2 — Selection features (G1–G5)](#part-2--selection-features-g1g5)
- [Part 3 — Project-management features (H1–H5)](#part-3--project-management-features-h1h5)
- [Part 4 — Admin analytics features (I1–I6)](#part-4--admin-analytics-features-i1i6)
- [Part 5 — Analyst validation layer (V1–V6)](#part-5--analyst-validation-layer-v1v6)
- [Part 6 — Delivery sequencing & milestones](#part-6--delivery-sequencing--milestones)
- [Part 7 — Global DO / DON'T & test strategy](#part-7--global-do--dont--test-strategy)

---

# Part 0 — Architecture & ground rules

## 0.1 Where everything plugs in (existing anchors)

| Concern | Existing file | We extend it by |
|---|---|---|
| Catalog + selection flow | `projects/project.catalog.controller.ts` | Enriching `getCatalog`, adding pre-flight checks, draft/vote endpoints |
| Event-sourced project state | `lifecycle/projectLog.service.ts` (`appendEvent`, `getContext`) | New event types + new derived reads |
| Reducer (JSON state mutation) | `lifecycle/projectLog.reducer.ts` | Handling the new event types |
| Shared types | `shared/projectLog.types.ts` | New event/flag type unions, new context shapes |
| Admin service/routes | `admin/admin.service.ts`, `admin/admin.routes.ts` | New analytics endpoints (funnel, formation, segmentation) |
| Rankings (analytics source) | `ranking/ranking.service.ts` | Reuse `TeamRankingResult` as an input to risk/benchmark |
| Notifications | `notifications/notification.service.ts` | `createForUser`, `broadcastToTeam` for nudges (never auto-send outbound) |
| Renderers | `lifecycle/render/docPdf.ts`, `docMarkdown.ts` | Exports (I6) reuse these — no new PDF stack |

## 0.2 New shared modules to create (the whole plan leans on these)

All under `server/src/shared/` and `server/src/modules/metrics/` (new folder). Pure functions,
unit-testable, no Prisma inside the math helpers (pass data in, get numbers out):

```
server/src/shared/
  ttlCache.ts          # generic in-memory TTL cache (mirrors mentorEngine.narrationCache)
  fairness.ts          # giniCoefficient(values: number[]): number  — contribution balance
  statistics.ts        # median, percentile, zScore, stdev, concentrationHHI
server/src/modules/metrics/
  selectionFit.ts      # deterministic team↔statement fit score (feeds G4 + A1)
  cohortMetrics.ts     # compute-on-read funnel / segmentation / engagement (I1–I4)
  riskModel.ts         # deterministic team risk score + band (H2/E4 + V2 backtest)
  benchmarks.ts        # cohort median/percentile context for any metric (V4)
```

## 0.3 New event & flag types (TypeScript only — NOT a migration)

Add to `shared/projectLog.types.ts`:

```ts
export type ProjectLogEventType =
  | /* …existing… */
  | 'SELECTION_DRAFT'        // G1: mentor chat/checklist/shortlist snapshot for a team
  | 'SELECTION_VOTE'         // G5: a member's thumbs up/down on the captain's choice
  | 'SELECTION_LOCKED'       // G5: consensus reached, choice committed
  | 'BLOCKER_ESCALATED'      // H2: a persistent blocker crossed the escalation threshold
  | 'INTERVENTION_LOGGED'    // V5: an admin nudge was sent (for effectiveness tracking)
  | 'DELIVERABLE_DRAFTED';   // (already reserved in AI plan B4)

// H2 adds one flag type:
type FlagType = 'DELAY' | 'INACTIVE_MEMBER' | 'MISSING_DEPENDENCY'
  | 'OVERLOAD' | 'TIMELINE_RISK' | 'TECH_DRIFT'
  | 'PERSISTENT_BLOCKER';   // NEW
```

> **Why events, not columns:** `ProjectLogEvent` is an append-only stream keyed `(logId, seq)`.
> Adding a `type` string value costs nothing at the DB layer. The reducer decides what each new
> type does to `state`. This is the sanctioned zero-migration persistence path.

## 0.4 The caching helper (used by every analytics read)

```ts
// shared/ttlCache.ts
export class TtlCache<T> {
  private store = new Map<string, { value: T; expires: number }>();
  constructor(private ttlMs: number) {}
  get(key: string): T | undefined {
    const hit = this.store.get(key);
    if (!hit) return undefined;
    if (Date.now() > hit.expires) { this.store.delete(key); return undefined; }
    return hit.value;
  }
  set(key: string, value: T): void {
    this.store.set(key, { value, expires: Date.now() + this.ttlMs });
  }
  async wrap(key: string, fn: () => Promise<T>): Promise<T> {
    const cached = this.get(key);
    if (cached !== undefined) return cached;
    const value = await fn();
    this.set(key, value);
    return value;
  }
}
```

- **DO** give cohort-wide reads a 2–5 min TTL; per-team reads 15 min.
- **DON'T** cache anything a student expects to see change instantly after their own action
  (e.g. their just-saved daily log) — scope cache keys so a mutation invalidates the right entry,
  or skip cache on the write-through path.

---

# Part 1 — Shared substrate (build first)

Nothing in Parts 2–4 is safe to build until these land, because they remove the duplicated,
drifting math that would otherwise appear in five controllers.

## 1.1 `fairness.ts` — the contribution-balance primitive (feeds H3, B6, V3)

```ts
// shared/fairness.ts
/** Gini coefficient of a non-negative distribution. 0 = perfectly even, →1 = one actor holds all.
 *  Used for contribution fairness (commits/logs/tasks per member). */
export function giniCoefficient(values: number[]): number {
  const xs = values.filter((v) => v >= 0);
  const n = xs.length;
  if (n === 0) return 0;
  const total = xs.reduce((a, b) => a + b, 0);
  if (total === 0) return 0;                       // no activity at all → treat as even, not unfair
  const sorted = [...xs].sort((a, b) => a - b);
  let cumWeighted = 0;
  sorted.forEach((v, i) => { cumWeighted += (i + 1) * v; });
  return (2 * cumWeighted) / (n * total) - (n + 1) / n;
}
```

- **Explanation:** one number every fairness feature shares, so the private student view (B6),
  the workload bar (H3), and the admin freeloading signal (V3) can never disagree.
- **DON'T** flag a low-activity team as "unfair" — `total === 0` returns 0 on purpose. Absence of
  work is a *health* problem (risk model), not a *fairness* problem.

## 1.2 `statistics.ts` — benchmarks & concentration

```ts
// shared/statistics.ts
export function median(xs: number[]): number { /* sort, mid */ }
export function percentileRank(value: number, population: number[]): number { /* % below */ }
export function stdev(xs: number[]): number { /* population sd */ }
export function zScore(value: number, population: number[]): number { /* (v-μ)/σ, σ=0 → 0 */ }
/** Herfindahl–Hirschman Index of catalog demand. High = herding onto few statements. */
export function concentrationHHI(selectionCounts: number[]): number {
  const total = selectionCounts.reduce((a, b) => a + b, 0);
  if (total === 0) return 0;
  return selectionCounts.reduce((acc, c) => acc + Math.pow(c / total, 2), 0);
}
```

- **Why it matters (analyst):** *no metric means anything without a benchmark.* Every admin number
  we surface will be paired with `median` + `percentileRank` so "60%" becomes "60%, p18 of cohort".

## 1.3 `selectionFit.ts` — deterministic fit (shared by G4 and AI-plan A1)

```ts
// modules/metrics/selectionFit.ts
export interface FitInput {
  teamSkills: string[];                 // union of members' UserSkill.skillName
  requiredSkills: string[];             // derived from statement domain/sector config
  avgPerformance: number;               // 0-100, from ranking or 50 baseline
  weeksAvailable: number;
  difficultyTier: number;               // 0-4
}
export interface FitResult { score: number; skillCoverage: number; reasons: string[]; }

const DOMAIN_REQUIRED_SKILLS: Record<string, string[]> = { /* code config, tunable, no DB */ };

export function computeFit(input: FitInput): FitResult {
  const covered = input.requiredSkills.filter((r) =>
    input.teamSkills.some((s) => skillMatches(s, r)));      // reuse shared/skillMatch.ts (AI-plan 1.3)
  const skillCoverage = input.requiredSkills.length
    ? covered.length / input.requiredSkills.length : 0.5;
  const timeFit = clamp01(input.weeksAvailable / (6 + input.difficultyTier * 2));
  const perfFit = input.avgPerformance / 100;
  const score = Math.round(100 * (0.55 * skillCoverage + 0.25 * timeFit + 0.20 * perfFit));
  const reasons = buildReasons(skillCoverage, timeFit, perfFit, covered, input.requiredSkills);
  return { score, skillCoverage, reasons };
}
```

- **DO** keep the weights (`0.55/0.25/0.20`) in one named constant block so V1 can tune them
  against outcome data later.
- **DON'T** let the LLM produce `score`. The model may only phrase `reasons` into one sentence.

## 1.4 Reducer handling for the new events

```ts
// lifecycle/projectLog.reducer.ts (inside applyEvent switch)
case 'SELECTION_LOCKED':
  state.team.teamId = event.data.teamId as string;         // idempotent; safe to re-apply
  break;
case 'BLOCKER_ESCALATED':
  state.flags.push({
    id: `blocker-${event.seq}`, at: event.createdAt,
    type: 'PERSISTENT_BLOCKER', message: event.data.summary as string,
    resolved: false, severity: event.data.severity as number,
  });
  break;
// SELECTION_DRAFT / SELECTION_VOTE / INTERVENTION_LOGGED are audit-only:
// they live in the event stream and are read directly, they do not mutate `state`.
```

- **DO** make every reducer case idempotent (re-applying the event stream must reproduce identical
  state — that's the event-sourcing contract).
- **DON'T** mutate `state.version` yourself; the service's `appendEvent` owns it.

---

# Part 2 — Selection features (G1–G5)

## G1 — Persist the selection draft (kill refresh-loses-everything)

**Goal:** a team's mentor chat, checklist, `readinessScore`, shortlist, and chosen category survive
refresh/device change so the funnel stops leaking teams mid-flow.

**Design decision — where the draft lives.** A pre-selection team has **no `Project` and no
`ProjectLog` yet**, so there is no event stream to append to. Two options:

| Option | Persistence | Verdict |
|---|---|---|
| **A. Client-first** | Redux + `localStorage`, key `pv:selDraft:<teamId>` | **Default.** Zero backend, zero risk, covers same-device refresh — the 90% case. |
| B. Server-side | A lazily-created draft `ProjectLog` (no `Project`) holding `SELECTION_DRAFT` events | Only if cross-device is a hard requirement. |

> **DON'T** create a `Project` row for a draft — it pollutes `childProjects` counts (G2) and catalog
> scarcity. If B is needed, the draft log attaches to the *team*, and is deleted/ignored once
> `selectProject` creates the real project.

**Client logic (Option A):**

```ts
// client: persist on every mentor turn / checklist change
const KEY = (teamId: string) => `pv:selDraft:${teamId}`;
saveDraft(teamId, { history, checklist, readinessScore, shortlist, category, updatedAt: Date.now() });
// hydrate on selection-flow mount; discard on successful selectProject()
```

- **DO** stamp `updatedAt` and expire drafts client-side after, say, 14 days.
- **DON'T** store anything sensitive; it's a convenience cache, not a system of record.

---

## G2 — Scarcity & availability shown before the mentor chat

**Goal:** show `slots left`, a `Filling fast / Open / Full` tag on every catalog card, and disable
"select" when full — so teams never hit the "max 4 teams" wall *after* investing in the chat.

**The bug this also fixes:** capacity is enforced only at submit today
(`project.catalog.controller.ts:613`, `childCount >= 4`). Extract the constant and reuse it.

```ts
// modules/projects/selection.constants.ts   (NEW — single source of truth)
export const MAX_TEAMS_PER_STATEMENT = 4;
export function availability(childCount: number) {
  const slotsLeft = Math.max(0, MAX_TEAMS_PER_STATEMENT - childCount);
  const status = slotsLeft === 0 ? 'FULL' : slotsLeft <= 1 ? 'FILLING_FAST' : 'OPEN';
  return { slotsLeft, status };
}
```

```ts
// getCatalog enrichment (project.catalog.controller.ts:112)
const enriched = templates.map((t) => ({
  ...t,
  ...availability(t._count.childProjects),
}));
res.json(enriched);
```

And in `selectProject`, replace the inline `>= 4` with the shared constant so card and submit can
never drift.

- **DO** compute on read from the `_count.childProjects` already selected in `getCatalog`.
- **DON'T** duplicate the number `4` anywhere again — one constant, imported in both places.

---

## G3 — Team-readiness gate with a visible checklist

**Goal:** replace the bare `401 "Must belong to a team"` (`selectProject:573`) with an explained,
fixable checklist *before* the CTA.

```ts
// modules/projects/selection.readiness.ts (NEW)
export async function getTeamSelectionReadiness(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { teamId: true, skillsRegistered: true, groupRegistered: true },
  });
  const team = user?.teamId
    ? await prisma.team.findUnique({
        where: { id: user.teamId },
        select: { maxMembers: true, _count: { select: { teamMembers: true } } },
      })
    : null;
  const MIN_MEMBERS = 2;
  const checks = [
    { id: 'inTeam',     ok: !!user?.teamId,                       fix: '/teams' },
    { id: 'teamSized',  ok: (team?._count.teamMembers ?? 0) >= MIN_MEMBERS, fix: '/teams/invite' },
    { id: 'skills',     ok: !!user?.skillsRegistered,            fix: '/profile/skills' },
    { id: 'group',      ok: !!user?.groupRegistered,             fix: '/profile/group' },
  ];
  return { ready: checks.every((c) => c.ok), checks };
}
```

- **Endpoint:** `GET /projects/catalog/readiness` (behind `authGuard`), consumed by the flow to gate
  the "Start selection" button.
- **DO** always return *why* and a *fix link* per failed check.
- **DON'T** scale `MIN_MEMBERS` blindly — read it from a config so solo/pair exceptions are tunable.

---

## G4 — Sort/filter catalog by the team's fit

**Goal:** make fit the primary sort so a team sees "best for us" first.

```ts
// getCatalog, when the caller is a student on a team
const teamSkills = await unionTeamSkills(user.teamId);       // one query, dedup UserSkill.skillName
const avgPerf = await teamAvgPerformance(user.teamId);       // ranking or 50 baseline
const scored = enriched.map((t) => ({
  ...t,
  fit: computeFit({
    teamSkills,
    requiredSkills: DOMAIN_REQUIRED_SKILLS[t.domain ?? ''] ?? [],
    avgPerformance: avgPerf,
    weeksAvailable: weeksUntilDeadline(),
    difficultyTier: Number(t.difficultyLevel ?? 2),
  }),
}));
if (req.query.sort === 'fit') scored.sort((a, b) => b.fit.score - a.fit.score);
```

- **New query params:** `?sort=fit&minFit=60&onlyOpen=true`.
- **DO** compute the team's skill union **once** per request, not per card.
- **DON'T** hide low-fit statements by default — sort, don't censor (a determined team may still want one).

---

## G5 — Consensus lock (captain proposes, members confirm)

**Goal:** stop a captain unilaterally committing the team; require a majority thumbs-up.

**Where state lives:** this happens pre-project, so use the **draft log** (G1 Option B) *or*, simpler,
a short-lived `TeamMessage`-backed tally. Recommended: a lightweight vote read-model computed from
`SELECTION_VOTE` events on the draft log (falls back to client state if no draft log).

```ts
// tally is deterministic
function isLocked(votes: Vote[], rosterSize: number) {
  const ups = votes.filter((v) => v.value === 'up').length;
  const threshold = rosterSize <= 2 ? 1 : Math.ceil(rosterSize / 2);  // no quorum wall on tiny teams
  return ups >= threshold;
}
```

- **Flow:** captain hits "Propose" → members notified (`broadcastToTeam`) → each votes → on threshold,
  the existing `selectProject` runs, appending `SELECTION_LOCKED`.
- **DO** scale the threshold to roster size; a 2-person team needs 1 confirm, not a "majority" wall.
- **DON'T** auto-notify on every vote — one "proposal opened" ping, one "locked" ping. No spam.

---

# Part 3 — Project-management features (H1–H5)

## H1 — One-tap daily log with GitHub prefill

**Goal:** cut logging friction (the input everything downstream depends on) by pre-filling `workDone`
from that day's commits; the student confirms/edits before save.

```ts
// modules/lifecycle/dailyLog.prefill.ts (NEW)
export async function draftDailyLog(projectId: string, userId: string, date: Date) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { githubUsername: true } });
  if (!user?.githubUsername) return { workDone: '', evidenceUrls: [], source: 'none' as const };
  const repo = await prisma.githubRepository.findUnique({
    where: { projectId }, select: { id: true },
  });
  if (!repo) return { workDone: '', evidenceUrls: [], source: 'none' as const };
  const dayCommits = await prisma.githubCommit.findMany({
    where: {
      repositoryId: repo.id,
      author: user.githubUsername,
      date: { gte: startOfDay(date), lte: endOfDay(date) },
    },
    select: { message: true, sha: true },
  });
  return {
    workDone: dayCommits.map((c) => `- ${c.message.split('\n')[0]}`).join('\n'),
    evidenceUrls: dayCommits.map((c) => c.sha),   // frontend expands to commit URLs
    source: dayCommits.length ? ('github' as const) : ('none' as const),
  };
}
```

- **Endpoint:** `GET /lifecycle/:projectId/daily-log/draft?date=` → returns the draft only.
- **DO** treat the draft as a suggestion; the student saves the real `DailyWorkLog` explicitly.
- **DON'T** ever auto-create a `DailyWorkLog` from commits — that would corrupt the authenticity
  signal D2/V3 depends on (a commit is evidence, not a self-report).

---

## H2 — Blocker escalation ladder

**Goal:** a `DailyWorkLog.blockers` that stays unresolved for N days becomes an AMBER on team health
(B1) and lands on the admin early-warning board (E4/I4).

```ts
// modules/metrics/blockerEscalation.ts (NEW) — deterministic
const ESCALATION_DAYS = 3;
export async function detectPersistentBlockers(projectId: string) {
  const logs = await prisma.dailyWorkLog.findMany({
    where: { projectId, blockers: { not: null } },
    orderBy: { date: 'asc' },
    select: { userId: true, date: true, blockers: true },
  });
  // group similar blocker text (reuse wordOverlapRatio) that recurs across >= ESCALATION_DAYS
  // with no later log clearing it → return { summary, spanDays, severity }[]
}
```

- **Trigger:** run inside the existing daily-log write path and the mentor/health read; when a
  blocker crosses the threshold, `appendEvent({ type: 'BLOCKER_ESCALATED', actorUserId: 'SYSTEM', … })`.
  The reducer raises a `PERSISTENT_BLOCKER` flag (0.4). That flag automatically flows into
  `getContext('admin').openFlags` — **no new admin surface needed.**
- **DO** define "persistent" as *recurrence*, not first occurrence — one blocker is normal work.
- **DON'T** notify the admin directly; raise the flag and let the early-warning board (I4) rank it.

---

## H3 — Team workload-balance view

**Goal:** make uneven task load visible while it's fixable.

```ts
// modules/metrics/workload.ts (NEW)
export async function teamWorkload(projectId: string) {
  const tasks = await prisma.task.groupBy({
    by: ['assigneeId', 'status'],
    where: { projectId },
    _count: true,
  });
  // pivot into per-member { open, inProgress, done, overdue }, then:
  const openCounts = members.map((m) => m.open + m.inProgress);
  return { members, imbalance: giniCoefficient(openCounts) };   // shared/fairness.ts
}
```

- **Visibility rules:** captain sees all names; a member sees their own bar highlighted, others muted.
- **DO** reuse `giniCoefficient` so this and B6/V3 agree.
- **DON'T** rank members — it's a balancing tool, not a leaderboard. Show load, not a score.

---

## H4 — Milestone timeline vs today

**Goal:** the "are we behind?" question answered visually, using the *same* numbers as the traffic
light so they never contradict.

- **Backend:** nothing new — the timeline reads `state.milestones` (`dueDate`, `status`) and the
  `percentTimeElapsed` / `percentMilestonesDone` already in `getContext('admin')`
  (`projectLog.service.ts:362`). Expose them on a student-facing read.
- **DO** render "today" against milestone `dueWeek`/`dueDate`; flag `PENDING` milestones already past due.
- **DON'T** recompute elapsed/slippage in the client — consume the server numbers so B1, H4, and I4
  share one source of truth.

---

## H5 — Streak-driven log nudge

**Goal:** use the dormant `UserStreak` to lift daily-log compliance with a single well-timed nudge.

```ts
// a scheduled sweep (reuse the pattern in lifecycle/evaluation.scheduler.ts), late afternoon
for (const streak of activeStreaks /* currentStreak > 0 */) {
  const loggedToday = await prisma.dailyWorkLog.count({
    where: { userId: streak.userId, date: today() },
  });
  if (loggedToday === 0) {
    await notificationService.createForUser(
      streak.userId,
      `Keep your ${streak.currentStreak}-day streak`,
      `Log today's work to keep your streak alive.`,
    );
  }
}
```

- **DO** send exactly one nudge, late in the day, only to streaks at risk.
- **DON'T** nudge users with no active streak or who already logged — noise kills notification trust.

---

# Part 4 — Admin analytics features (I1–I6)

All live in `admin.service.ts` (methods) + `admin.routes.ts` (endpoints, already `requireRole('ADMIN')`),
backed by `cohortMetrics.ts`. Every one is **compute-on-read**, cached via `TtlCache` (2–5 min).

## I1 — Onboarding funnel

**Goal:** answer "who is stuck and where" before projects even start.

```ts
// modules/metrics/cohortMetrics.ts
export async function onboardingFunnel(organizationId: string) {
  const students = await prisma.user.findMany({
    where: { organizationId, role: 'STUDENT' },
    select: { id: true, teamId: true, groupRegistered: true, skillsRegistered: true },
  });
  const teamSizes = await teamSizeMap(organizationId);
  const projectsByTeam = await selectedTeamSet(organizationId);   // teams with a non-template Project
  const approvedByTeam = await approvedTeamSet(organizationId);

  const stage = {
    total:            students.length,
    groupRegistered:  students.filter((s) => s.groupRegistered).length,
    skillsRegistered: students.filter((s) => s.skillsRegistered).length,
    inTeam:           students.filter((s) => s.teamId).length,
    teamAtMinSize:    students.filter((s) => s.teamId && teamSizes.get(s.teamId)! >= 2).length,
    selected:         students.filter((s) => s.teamId && projectsByTeam.has(s.teamId)).length,
    approved:         students.filter((s) => s.teamId && approvedByTeam.has(s.teamId)).length,
  };
  return { stage, dropoff: computeDropoff(stage) };   // + drill-down id lists per stage
}
```

- **Endpoint:** `GET /admin/analytics/funnel`.
- **DO** return the **drop count between stages** and a drill-down id list, not just totals — the
  analyst reframing (funnel drop-off > vanity counts).
- **DON'T** recompute per request under load — cache 5 min (cohort-wide key).

## I2 — Team-formation health board

**Goal:** surface under-filled, orphaned, pending-heavy teams.

```ts
export async function formationHealth(organizationId: string) {
  return {
    underFilled:  /* teams where _count.teamMembers < maxMembers */,
    captainOnly:  /* teams with a leadId but 0/1 members */,
    orphanStudents: /* users role=STUDENT, teamId null */,
    pendingInvites: /* TeamInvite status='pending' grouped by team, count */,
  };
}
```

- **DO** offer a C6-style *drafted* nudge per row (to captain / orphan student) — admin approves send.
- **DON'T** auto-send. Draft only.

## I3 — Cohort segmentation analytics

**Goal:** slice completion/risk/selection by the rich `User` profile fields already collected.

```ts
export async function segmentation(organizationId: string, dimension:
  'department' | 'deptCode' | 'cluster' | 'year' | 'gender' | 'resident' | 'ssgDomain') {
  // join rankings + health to the chosen User dimension; for each segment return
  // { n, medianScore, onTrackPct, githubLinkedPct } and flag outliers via zScore (V4)
}
```

- **Endpoint:** `GET /admin/analytics/segments?dimension=cluster`.
- **DO** flag a segment as a *significant* outlier using `zScore` against the cohort — not just show averages.
- **DON'T** build per-segment tables; group on read.

## I4 — Engagement pulse & early-warning ranking

**Goal:** the leading indicator board — teams ranked by deterministic risk.

```ts
// modules/metrics/riskModel.ts — the auditable core (also backtested in V2)
export interface RiskInput {
  percentTimeElapsed: number; percentMilestonesDone: number;
  logComplianceRate: number;   // logs submitted / expected working days
  commitVelocityTrend: number; // recent vs baseline, -1..1
  openFlagSeverity: number;    // sum of open flag severities, normalized
  contributionGini: number;    // fairness.ts
}
const W = { slip: 0.30, logs: 0.25, commits: 0.15, flags: 0.20, fairness: 0.10 };
export function teamRisk(i: RiskInput): { score: number; band: 'GREEN'|'AMBER'|'RED'; drivers: string[] } {
  const slip = clamp01((i.percentTimeElapsed - i.percentMilestonesDone) / 100);
  const risk = 100 * (W.slip*slip + W.logs*(1-i.logComplianceRate)
    + W.commits*(1-clamp01((i.commitVelocityTrend+1)/2))
    + W.flags*i.openFlagSeverity + W.fairness*i.contributionGini);
  const band = risk >= 66 ? 'RED' : risk >= 33 ? 'AMBER' : 'GREEN';
  return { score: Math.round(risk), band, drivers: topDrivers(/* per-component contribution */) };
}
```

- **Endpoint:** `GET /admin/analytics/early-warning` → teams sorted by risk, each with `drivers`.
- **DO** return the **component drivers** so every red is explainable (V-caution: an unexplained flag
  gets ignored, and "the AI said so" loses a grade dispute).
- **DON'T** train a model or hide the weights. "Predictive" = trend extrapolation over transparent
  components, nothing more.

## I5 — Selection-demand & catalog intelligence

**Goal:** rebalance the catalog this cycle.

```ts
export async function catalogDemand(organizationId: string) {
  const templates = await prisma.project.findMany({
    where: { organizationId, isTemplate: true, status: 'CATALOG' },
    select: { id: true, shortName: true, domain: true, sector: true,
              _count: { select: { childProjects: true } } },
  });
  const counts = templates.map((t) => t._count.childProjects);
  return {
    concentration: concentrationHHI(counts),        // statistics.ts — herding measure (V1)
    mostChosen: /* top N */, zeroDemandDomains: /* domains with 0 selections */,
    nearFull: templates.filter((t) => availability(t._count.childProjects).slotsLeft <= 1),
    nearDuplicates: /* reuse A3/personalization overlap on problemStatement */,
  };
}
```

- **DO** reuse the existing overlap logic (`wordOverlapRatio`/personalization) for near-duplicates.
- **DON'T** delete statements automatically — surface, admin acts via existing catalog CRUD.

## I6 — One roster/cohort export

**Goal:** the accreditation artifact registrars ask for.

- **Logic:** assemble I1–I3 payloads → reuse `lifecycle/render/docPdf.ts` for PDF; use the existing
  `xlsx` dependency (already imported in `admin.service.ts`) for Excel.
- **DO** reuse the existing renderer/`xlsx`. **DON'T** add a new PDF/reporting stack.

---

# Part 5 — Analyst validation layer (V1–V6)

This is what separates "a dashboard" from "a defensible system." None of it needs new storage —
it's analysis over data already kept.

## V1 — Metric tree & North Star instrumentation

- **North Star:** *% of projects finishing on-track with dispute-free, evidence-backed grades.*
- **Action:** define the tree once in `metrics/northStar.ts` as pure derivations (leading:
  log-compliance, commit-cadence, slippage, blocker-persistence, contribution-Gini; lagging:
  completion, grade, dispute, plagiarism). Every dashboard number references a node, so nothing
  orphan-floats.
- **DO** label each metric leading vs lagging in the UI. **DON'T** ship a chart that doesn't roll up
  to a tree node.

## V2 — Risk-model calibration (backtest, no ML)

- **Goal:** prove the I4 risk score is trustworthy before anyone acts on it.
- **Method:** replay finished projects from prior cycles; for each, compute `teamRisk` from its
  *early* state (first 3 cycles) and compare its band to the *final* outcome. Report precision/recall
  of "RED → actually failed." Store nothing — it's an offline/report-time computation.
- **DO** publish the model's precision alongside the board ("RED flags were right 78% last cohort").
- **DON'T** ship the board without a calibration number — an uncalibrated red is the boy who cried wolf.

## V3 — Authenticity via cross-source correlation

- **Goal:** the strongest anti-gaming signal — contradictions between independent sources.
- **Method (deterministic):** per member per day, build `{ logClaimed: bool, hoursClaimed, commits,
  docEdits }`. Flag `claimed work + 0 commits + 0 doc activity`. Feeds `suspiciousBehaviour` in the
  evaluation report `content` JSON (AI-plan D2) — no new surface.
- **DO** require *two* independent sources to disagree before flagging (log vs commit vs doc).
- **DON'T** punish a single-source gap (some legit work leaves no commit) — require corroborated contradiction.

## V4 — Benchmarks, variance & anomaly framing

- **Goal:** every admin number ships *with* its comparison.
- **Method:** `benchmarks.ts` wraps any raw metric into `{ value, cohortMedian, percentile, trendDelta,
  isOutlier }` via `statistics.ts`. Anomaly = deviates from the team's *own* trend or the cohort
  distribution (relative), not a fixed threshold (absolute).
- **DO** flag on relative deviation. **DON'T** hardcode "red if < 50%" — thresholds age badly.

## V5 — Intervention-effectiveness loop

- **Goal:** learn which admin nudges actually work.
- **Method:** when an admin sends a nudge (C6/I2), append `INTERVENTION_LOGGED` to that team's project
  log (`data: { kind, at, actorUserId }`). A report-time job measures the team's risk trajectory for
  14 days after each intervention and aggregates "avg risk delta by intervention kind."
- **Persistence:** event stream only. **DO** tie the loop to real trajectory, not opens/clicks.
  **DON'T** auto-send to build sample size — every send stays admin-approved.

## V6 — Cohort-over-cohort & ROI reporting

- **Goal:** the board-level "are we getting better?" and the renewal conversation.
- **Method:** aggregate per-cohort: median weeks-to-first-intervention, regret/abandonment rate,
  grade-dispute rate, % scores with attached evidence, catalog concentration (HHI). Render via I6.
- **The ROI table this produces (the renewal doc):**

| Claim | Metric that proves it |
|---|---|
| Catch failing teams earlier | Median weeks-to-first-intervention ↓ |
| Fewer collapses | Regret/abandonment rate ↓ |
| Defensible grades | Dispute rate ↓; % evidence-backed scores ↑ |
| Fairer effort | Median contribution-Gini ↓ |
| Spread the catalog | Concentration HHI ↓; zero-demand domains ↓ |

- **DO** state correlation ≠ causation explicitly (high-fit teams finishing better may just mean strong
  teams pick well). **DON'T** let the product imply the fit score *caused* the outcome.

---

# Part 6 — Delivery sequencing & milestones

| Milestone | Ships | Depends on | Migration |
|---|---|---|---|
| **M0 — Substrate** | `ttlCache`, `fairness`, `statistics`, `selectionFit`, new event/flag types + reducer cases | — | No |
| **M1 — Selection unblocks** | G2 scarcity, G3 readiness gate, G1 draft (client) | M0 | No |
| **M2 — Student value** | H1 log prefill, H4 timeline, H5 streak nudge, H3 workload | M0 | No |
| **M3 — Admin cockpit** | I1 funnel, I2 formation, I4 early-warning (+ riskModel) | M0 | No |
| **M4 — Analyst rigor** | V2 calibration, V4 benchmarks, I3 segmentation, I5 demand | M3 | No |
| **M5 — Loop & prove** | G4 fit-sort, G5 consensus, H2 escalation, V5 intervention loop, I6 export, V6 ROI | M1–M4 | No |

**Highest ROI first (recommended cut for a single sprint):** **G2 + G3 + I1 + I2** — all pure reads
on existing data, zero AI, and they fix the two worst leaks (selection drop-off, admin blindness).

---

# Part 7 — Global DO / DON'T & test strategy

**DO**
- ✅ Put every auditable number in a **pure function** in `shared/`/`metrics/` — data in, number out,
  no Prisma inside the math. That's what makes V2 backtesting and unit tests possible.
- ✅ Persist new state **only** via new event types (`data` JSON) or existing JSON `content`.
- ✅ Pair every admin metric with a benchmark (`median`/`percentile`/trend) — never a bare number.
- ✅ Reuse: `giniCoefficient`, `computeFit`, `availability`, `render/docPdf`, `notificationService`,
  `wordOverlapRatio`, `skillMatch`. One implementation each.
- ✅ Make reducer cases idempotent; cache reads with `TtlCache` + sensible TTLs.

**DON'T**
- 🚫 Touch `schema.prisma` / run `migrate dev` / `db push` / add tables or columns. Re-express via
  events + JSON, or defer.
- 🚫 Let the LLM produce any score, band, fit %, funnel number, or risk — model narrates only.
- 🚫 Auto-send any outbound (nudge, email, notification-as-action) — student/admin approves every one.
- 🚫 Create a `Project` row for a selection draft (pollutes scarcity counts).
- 🚫 Auto-create a `DailyWorkLog` from commits (destroys the authenticity signal).
- 🚫 Duplicate the `MAX_TEAMS_PER_STATEMENT` constant or any metric formula across files.
- 🚫 Ship the early-warning board without a V2 calibration number.

**Test strategy**
- **Unit** (Vitest, mirrors `lifecycle/__tests__`): every pure metric — `giniCoefficient` (even vs
  one-actor), `computeFit` (weights sum, no-skill edge), `teamRisk` (band boundaries 33/66),
  `concentrationHHI`, `availability` (0/1/≥2 slots), reducer idempotency for each new event type.
- **Integration:** funnel/segmentation endpoints against a seeded cohort; assert drop-off math and
  cache invalidation on write-through paths.
- **Regression guard:** a test asserting `getCatalog` and `selectProject` read the *same*
  `MAX_TEAMS_PER_STATEMENT` (import identity), so card and submit can never drift.
- **Calibration harness (V2):** a script (not a live endpoint) that replays historical logs and prints
  risk-model precision/recall — run per cohort, output archived with the ROI report.
