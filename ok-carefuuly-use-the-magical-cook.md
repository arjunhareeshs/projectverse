# Plan — GitHub commit truth, full JSON→DB normalization, leak-free LLM boundary

## Context

Three problems that turn out to be one problem.

**1. GitHub commit evidence is fake-empty.** [`github.service.ts:332`](../../../SSG%20projects/ProjectVerse/projectverse/server/src/modules/github/github.service.ts) upserts only `snapshot.latestCommit` — so `GithubCommit` holds **at most one row per repository, ever**. But [`evaluation.engine.ts`](../../../SSG%20projects/ProjectVerse/projectverse/server/src/modules/lifecycle/engines/evaluation.engine.ts) queries `ghRepo.commits` filtered to a 15-day window and expects a list. It almost always gets `[]`. That empty list then trips the "contradiction guardrail", which caps `technicalProgress` and `scopeAdherence` to 20 for every member with no in-window commits. **The bad evaluation scores and the missing GitHub data are the same defect.** Per-contributor commit counts scoped to the project's own repo do not exist anywhere today.

**2. Analysis data lives in JSON blobs, so it cannot be queried, ranked, or aggregated.** 19 `Json` columns across the schema. The worst consequence: `EvaluationReport` has no score column at all — `overallScore` is computed in memory, written into a notification *string*, and thrown away. Admin ranking pages have to re-parse JSON and re-derive weights to sort anything.

**3. The LLM prompt leaks.** [`evaluation.prompt.ts`](../../../SSG%20projects/ProjectVerse/projectverse/server/src/modules/lifecycle/prompts/evaluation.prompt.ts) `JSON.stringify`s, into a third-party API: other projects' raw daily-log text (`suspiciousPairs[].otherLog`), students' real full names and cuid userIds, and raw git author strings. The cross-project plagiarism query has **no `organizationId` filter**, so it samples logs from other institutions.

**Intended outcome:** every commit in a project's repo is stored and attributed to a real user; all analysis data lives in relational tables that can be sorted and joined; JSON exists only as a transient serialization built at the LLM call boundary, containing aliases and no foreign or cross-org content.

> **One flagged concern, proceeding as directed.** `ProjectLog.state` and `ProjectLogEvent.data` are an event-sourced aggregate plus its event envelope — JSON is a defensible design there, and normalizing them is the largest and riskiest part of this work. You asked for all JSON storage in DB tables, so the plan does that, but it is sequenced **last** (Phase 5) so Phases 1–4 ship value before that risk is taken.

---

## Phase 0 — Baseline migration (blocking prerequisite)

Per `PAGE_FIX_PROTOCOL.md` §3 the live DB was built with `db push` and has **no `_prisma_migrations` table**; the 3 existing migration files cover a fraction of the schema. Every phase below adds schema changes, so this must come first or `migrate deploy` will build a broken DB.

- `npx prisma migrate diff --from-empty --to-schema-datamodel database/prisma/schema.prisma --script` → write as `migrations/0_init/migration.sql`
- `npx prisma migrate resolve --applied 0_init`
- Verify `_prisma_migrations` exists and `migrate status` is clean.
- All prisma commands here need `--schema=database/prisma/schema.prisma`.

Log this schema work in `db_change.md` (real schema change, unlike ordinary feature work).

---

## Phase 1 — Real commit history + per-contributor attribution

### Schema
Extend `GithubCommit` (already has `@@unique([repositoryId, sha])`, so `createMany({ skipDuplicates: true })` is safe):
```prisma
authorLogin   String?   // GitHub login from commit.author.login
authorEmail   String?   // commit.commit.author.email
linkedUserId  String?   // FK -> User, resolved attribution
linkedUser    User?     @relation(fields: [linkedUserId], references: [id])
isMerge       Boolean   @default(false)
@@index([repositoryId, date])
@@index([linkedUserId, date])
```

### Ingestion
- Add `listAllPaginated(path, params, maxPages)` to [`github.client.ts`](../../../SSG%20projects/ProjectVerse/projectverse/server/src/modules/github/github.client.ts). **Reuse the existing `coreGet` + `countFromLinkHeader`** already in that file — do not write a new HTTP layer. Cap at 20 pages × 100 = 2000 commits, configurable.
- Add `syncCommitHistory(repositoryId, owner, repo)` to `github.service.ts`, called from the same place the snapshot is persisted (~line 320). Metadata only — no per-commit API calls, so no rate-limit blowup.
- `isMerge` = `commit.parents.length > 1`.

### Attribution (this is the fix for the score capping)
Resolve `linkedUserId` in priority order — **reuse `User.githubUsername`, which already exists** for exactly this purpose:
1. `commit.author.login` → `User.githubUsername` (case-insensitive)
2. `commit.commit.author.email` → `User.email`
3. else `null` (unattributed, still stored)

Replace the current fragile matcher in `evaluation.engine.ts`:
`c.author?.toLowerCase().includes(m.name.toLowerCase())` — a git author string compared against a full name, which fails on `jdoe` or an email-only author and silently caps that member's scores to 20. It becomes a `linkedUserId` equality check.

### Read API
- `getRepoContributorStats(projectId, { from?, to? })` in `github.service.ts` → `{ userId, githubLogin, displayName, commits, activeDays, firstCommitAt, lastCommitAt, isAttributed }[]`, plus repo totals and an `unattributed` bucket. Scoped by `projectId` → one `GithubRepository` (`projectId` is `@unique`), so no cross-repo bleed by construction.
- `GET /api/github/project/:projectId/contributors` in `github.routes.ts`, guarded by `requireProjectAccess`.

### Backfill
`server/src/scripts/backfillCommitHistory.ts` — iterate every `GithubRepository`, run `syncCommitHistory`, report counts. Idempotent via `skipDuplicates`.

---

## Phase 2 — Normalize scoring & analysis JSON

Highest value first: these are the columns that block ranking and reporting.

| Current `Json` | Becomes |
|---|---|
| `EvaluationReport.content` | typed columns on `EvaluationReport` (**`overallScore Int`**, `plagiarismRisk`, `isFallback`, `statusNote`, `mentorFeedback`) + `EvaluationCategoryScore(reportId, category, score, notes)` + `EvaluationMemberScore(reportId, userId, score, notes)` + `EvaluationFinding(reportId, kind: MISSING_WORK\|SUSPICIOUS\|RECOMMENDATION, text)` + `EvaluationEvidence(reportId, category, key, value)` |
| `ProblemStatementProposal.scores` | `ProposalScore(proposalId, overallScore, …)` 1:1 + `ProposalRubricScore(proposalId, family: RUBRIC\|INDUSTRY\|PERSPECTIVE, dimension, score, rationale)` |
| `ProblemStatementProposal.extracted` | `ProposalExtraction` 1:1 + `ProposalExtractionItem(proposalId, kind, value)` for the string arrays |
| `DailyWorkLog.evidenceUrls`, `PhaseSubmission.evidenceUrls` | shared `EvidenceUrl(ownerType, ownerId, url, position)` — also fixes the crash risk where a non-array legacy JSON value passes the `?.length` guard then breaks `.map` |
| `OpportunityRecommendation.recommendations` | `OpportunityRecommendationItem(recommendationId, type, name, url, why, deadline, matchReason)` |

**Persisting `overallScore` is the single highest-value item in this phase** — it makes Admin Top Teams / Top Students / Standouts sortable in SQL instead of by re-deriving weights in application code.

Keep the category weight table (`weightsByCategory`) in `evaluation.engine.ts` as the source of truth; it writes the derived `overallScore` to the new column.

---

## Phase 3 — Normalize GitHub + catalog JSON

| Current `Json` | Becomes |
|---|---|
| `GithubRepository.languages` | `GithubRepositoryLanguage(repositoryId, language, bytes)` |
| `GithubRepository.labels`, `.milestones` | `GithubRepositoryLabel`, `GithubRepositoryMilestone` |
| `GithubRepository.structure` | `GithubRepoStructure` 1:1, typed boolean/count columns |
| `GithubSnapshot.metrics` | typed columns on `GithubSnapshot` — the key set is fixed and known (stars, forks, watchers, commitCount, contributorCount, open/closed issues, open/closed/merged PRs, popularityScore) |
| `Project.useCases`, `.deliverables` | `ProjectUseCase`, `ProjectDeliverable` (ordered rows) |
| `Project.expectedMetrics` | `ProjectExpectedMetric(projectId, name, target, unit)` |
| `Project.phases` | `ProjectCatalogPhase(projectId, label, week, expected)` — **name it distinctly from the existing `ProjectPhase` model**, which is the separate execution-phase feature |
| `Project.typeSpecific` | `ProjectTypeSpecific` 1:1 with a `kind` discriminator (SOFTWARE/HARDWARE/IOT) and nullable per-kind columns |
| `ExecutionDocument.content` | `ExecutionDocOverview` 1:1 + ordered child rows: `ExecutionDocObjective`, `Deliverable`, `Risk`, `SuccessCriteria`, `SkillRequired`, `WorkPackage`, `Milestone`, `LearningResource`, `Feature`, `TeamShare` |

`ExecutionDocument` is versioned — every child row carries the `executionDocumentId` so versions stay independent.

---

## Phase 4 — Leak-free LLM boundary

New module `server/src/modules/ai/promptSerializer.ts`. **This is the only place in the codebase permitted to build JSON for an LLM.**

**Alias mapping.** Per request, build `Map<userId, "M1"|"M2"…>`. Only aliases cross the network; the response is de-aliased on return. No `userId`, `fullName`, `email`, `regNo`, or git author string is ever serialized.

**Foreign text removal.** `suspiciousPairs` currently carries 100 chars of another team's `workDone`. Replace with `{ myLogDate, similarityPercent, matchScope: 'OTHER_PROJECT_SAME_ORG' }` — the similarity number is what the model needs; the foreign text is not.

**Org scoping.** The cross-project plagiarism query in `evaluation.engine.ts` gets `project: { organizationId }` added to its `where`. Also add a deterministic `orderBy` — today it is `take: 100` with no ordering, so Postgres can return a different sample each run and the same cycle re-run can produce a different `plagiarismRisk`.

**Commit identities.** Commits serialize as `{ alias, dateOnly, messageLength, isMerge }` — attribution now comes from `linkedUserId`, so raw author strings never need to leave the DB.

**Schema validation.** `chatJSON` in the evaluation path is called **without** a `schema` option, unlike `validateIdea` which passes `IdeaValidationSchema`. Add `EvaluationReportSchema` (zod) so a malformed response returns the fallback instead of throwing inside the cron when guardrail code reads `.technicalProgress.score` on undefined.

**Guard test.** A unit test asserting the serialized payload for a fixture project contains no member name, no email, no cuid, and no `workDone` text belonging to another project.

---

## Phase 5 — Normalize the project log (largest, do last)

`ProjectLog.state` → `ProjectLogDuration` (1:1) + `ProjectLogDurationHistory`, `ProjectLogMember`, `ProjectLogMemberResponsibility`, `ProjectLogTechnology`, `ProjectLogWorkPackage` (+ `Dependency`), `ProjectLogMilestone` (+ `History`), `ProjectLogSkill`, `ProjectLogSkillGap`, `ProjectLogFlag`, `ProjectLogEvaluationRef`. `version` stays a column on `ProjectLog`.

`ProjectLogEvent.data` spans ~30 event types with different payloads. Use `ProjectLogEventField(eventId, key, valueText, valueNum, valueBool, valueDate)` — relational and queryable without 30 per-type tables.

[`projectLog.reducer.ts`](../../../SSG%20projects/ProjectVerse/projectverse/server/src/modules/lifecycle/projectLog.reducer.ts) and `projectLog.service.ts` must be rewritten to read/write rows instead of mutating a blob. **Keep `getState()` and `getContext()` signatures identical** — they are called from the evaluation engine, mentor engine, intake service, and lifecycle controller. Rebuilding the object from rows behind an unchanged interface keeps every caller working and is what makes this phase survivable.

---

## Migration & rollout pattern (applies to Phases 2, 3, 5)

Never drop a `Json` column in the same migration that adds its tables:

1. Migration A — add new tables, leave the `Json` column in place.
2. Backfill script in `server/src/scripts/` — read JSON, write rows, idempotent, re-runnable.
3. Switch reads/writes to the tables.
4. Verify parity on a DB copy: row counts and spot-checked values match the JSON.
5. Migration B — drop the `Json` column.

---

## Critical files

- `server/database/prisma/schema.prisma`
- `server/src/modules/github/{github.client.ts, github.service.ts, github.controller.ts, github.routes.ts}`
- `server/src/modules/lifecycle/engines/evaluation.engine.ts`
- `server/src/modules/lifecycle/prompts/evaluation.prompt.ts`
- `server/src/modules/ai/promptSerializer.ts` *(new)*
- `server/src/modules/ai/llm.service.ts` — reuse `chatJSONWithMeta`, add the evaluation zod schema
- `server/src/modules/lifecycle/{projectLog.service.ts, projectLog.reducer.ts}` *(Phase 5)*
- `server/src/modules/projects/proposal.worker.ts` — `buildEvaluationSnapshot` writes rows instead of a blob
- `server/src/shared/projectLog.types.ts` — types follow the new tables
- `server/src/scripts/` — backfill scripts

**Out of scope:** all `client/` work (the Antigravity UI brief owns that); the cross-organization phase-review authorization hole (parked, separate slice); wiring the orphaned `EvaluationsTab.tsx`.

---

## Verification

**Per phase**
```bash
cd server && npx tsc --noEmit -p .
cd server && npx prisma validate --schema=database/prisma/schema.prisma
cd server && npx prisma migrate status --schema=database/prisma/schema.prisma
```

**Phase 1 — commits**
```bash
# before: expect 1 row per repo. after: expect hundreds
psql -c "SELECT \"repositoryId\", COUNT(*) FROM \"GithubCommit\" GROUP BY 1;"
# attribution rate — unattributed should be a small minority
psql -c "SELECT COUNT(*) FILTER (WHERE \"linkedUserId\" IS NOT NULL)::float/COUNT(*) FROM \"GithubCommit\";"
curl -s -H "Authorization: Bearer $TOKEN" localhost:4000/api/github/project/<id>/contributors
```
Confirm returned per-contributor counts equal `GithubContributor.contributions` for the same repo, and that the endpoint returns only that project's repo.

**Phase 2** — re-run a cycle via `POST /lifecycle/:projectId/evaluation/run`; confirm `EvaluationReport.overallScore` is populated and `ORDER BY "overallScore" DESC` works in SQL. Confirm a project with real in-window commits **no longer gets capped to 20** — this is the regression that proves Phase 1 and Phase 2 landed together.

**Phase 4 — leak check (the important one)**
- Unit test on the serialized payload: no member name, no email, no cuid, no foreign `workDone`.
- Log the exact outbound payload for one fixture project at debug level and read it by eye once.
- Confirm the plagiarism query returns zero rows from another `organizationId`.
- Confirm two consecutive runs of the same cycle produce an identical `plagiarismRisk` (proves the `orderBy` fix).

**Phase 5** — on a DB copy, snapshot `getState(projectId)` for ~20 projects before and after; the reconstructed objects must deep-equal the old blobs. Replay events and confirm `version` still increments identically.

**Empty-DB check (protocol §6)** — a project with no repo, no logs, and no commits must return `{ count: 0, items: [] }`-shaped empties at every new endpoint, never a crash and never demo data.
