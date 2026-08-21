# ProjectVerse — Complete Database Design

> **Sources of truth for this document:** `server/database/db_change.md` (normalization change
> log), `docs/db_change.md` (page-by-page backend change log), `server/database/prisma/schema.prisma`
> (94 models, 3 enums, PostgreSQL), `client/src/App.tsx` (route map), and the 14 route modules
> under `server/src/modules/`.
>
> Anything not derivable from those files is marked **[ASSUMPTION]**.
> Recommended changes to what exists today are marked **[CHANGE]**; brand-new tables/columns
> are marked **[NEW]**.
>
> This is a **design document only** — no schema or migration is implemented here.

---

## 0. Table Count Summary

| Group | Existing | Proposed new | Total |
|---|---:|---:|---:|
| Identity, organization, team | 8 | 1 | 9 |
| Project core & catalog | 11 | 0 | 11 |
| Proposal pipeline | 5 | 0 | 5 |
| Tasks / boards / delivery | 9 | 1 | 10 |
| Project Log (event-sourced) | 13 | 0 | 13 |
| Execution documents | 12 | 0 | 12 |
| Evaluation | 5 | 0 | 5 |
| GitHub integration | 8 | 0 | 8 |
| Insights & recommendation | 5 | 1 | 6 |
| Phases, features, rewards | 4 | 0 | 4 |
| Engagement & gamification | 8 | 1 | 9 |
| Evidence & daily work | 2 | 1 | 3 |
| Storage | 1 (orphaned) | 2 | 3 |
| Auth / RBAC | 2 (stubs) | 4 | 6 |
| Audit & logs | 3 | 5 | 8 |
| Derived metrics & analytics | 0 | 14 | 14 |
| **Total** | **96*** | **30** | **126** |

\* 94 `model` blocks in `schema.prisma`; the two extra rows above are `FileAsset` and
`ActivityLog` counted in their functional groups.

Enums: **3 existing** (`RoleType`, `ProjectCategory`, `EvaluationFindingKind`) + **17 proposed**
to replace unconstrained `String` status columns + **11** for the metrics subsystem (§17.5)
= **31**.

Section **17** covers the `metrics` / `intelligence` subsystem, added after a coverage audit
found it untraced; it carries its own tables, relationships and migration phase.

---

## 1. Platform Understanding

### 1.1 What ProjectVerse is

ProjectVerse is a **university project-lifecycle and academic-integrity platform**. Students are
organised into groups (teams) inside an organization (the college). They pick or propose a
problem statement from a curated catalog, receive an AI-generated execution plan, then execute
it in phases while logging daily work. The platform continuously pulls their GitHub activity,
attributes commits to real users, and produces AI evaluation reports every 15 days. Admins and
faculty consume the aggregate: rankings, overlap/plagiarism detection, standout
("startup-worthy") project detection, and opportunity recommendations.

The property that distinguishes it from a generic project tracker is that **every claim a
student makes is cross-checked against evidence**: daily logs vs. GitHub commits vs. phase
submissions vs. AI evaluation. The schema is therefore evidence-heavy and audit-heavy, and its
integrity rules matter more than its raw feature count.

### 1.2 Major modules

| # | Module | Server module | Purpose |
|---|---|---|---|
| 1 | Auth & identity | `auth` | Register, login, JWT issue, profile, GitHub username linking |
| 2 | Dashboard | `dashboard` | KPIs, streak grid, deadlines, hackathons, contests, recent activity |
| 3 | Catalog & proposals | `projects` | Browse curated problem statements, claim one, propose your own, AI validation |
| 4 | Project lifecycle | `lifecycle` | Intake wizard, project log event store, execution doc, features, phases, daily logs, evaluations, AI mentor |
| 5 | Tasks & delivery | `tasks` | Kanban board, Gantt timeline, subtasks, labels, comments |
| 6 | Teams | `teams` | Team CRUD, members, invites/join requests, chat, inter-team collaboration, stats |
| 7 | GitHub integration | `github` | Repo analysis, snapshots, commits, contributor attribution, college analytics |
| 8 | Insights | `insights` | Top teams, top students, overlap flags, standout projects |
| 9 | Recommendation | `recommendation` | Opportunity recommendations per project |
| 10 | Intelligence / AI | `ai`, `intelligence` | LLM calls, idea intelligence, prompt serialization |
| 11 | Metrics | `metrics` | Authenticity, workload, risk, north-star, cohort, intervention |
| 12 | Ranking | `ranking` | Group ranking, reward/activity points |
| 13 | Admin | `admin` | Bulk Excel upload of students/teams/achievements, role changes, proposal moderation |
| 14 | Notifications | `notifications` | Per-user notifications, broadcasts, deadline alerts |
| 15 | Internal | `internal` | HMAC-signed server-to-server API (bot/automation surface) |

### 1.3 User types

Enum `RoleType` = `ADMIN | STUDENT | FACULTY`.

- **STUDENT** — owns the execution surface. Creates proposals, joins/leads teams, logs daily
  work, submits phases, edits execution docs, chats.
- **FACULTY** — mentor/reviewer. Reviews phase submissions (`requireRole(['ADMIN','FACULTY'])`
  on `POST /lifecycle/:projectId/phases/:phaseId/review`), files `ProjectReview` records, reads
  project workspaces. **[ASSUMPTION]** Faculty read scope is org-wide; there is no
  faculty↔project assignment table today (gap **G-7**).
- **ADMIN** — full org control. Bulk upload, role changes, evaluation runs
  (`requireRole('ADMIN')` on `POST /lifecycle/:projectId/evaluation/run`), college analytics,
  insight triage, catalog publishing.
- **SYSTEM / AI** — *not* a `User` row. `ProjectLogEvent.actorUserId` accepts the literal
  strings `"SYSTEM"` and `"AI"`, and `ProjectFeature.addedBy` accepts `"AI"`. That is why those
  columns are plain `String` rather than FKs (gap **G-4**).
- **INTERNAL service** — authenticated by HMAC (`middleware/internalAuth.ts`) via
  `x-internal-user-id` / `x-internal-role` headers; it borrows a real user's identity rather
  than having its own principal.

### 1.4 Core workflows

1. **Onboarding** — Admin bulk-uploads students and groups from Excel → `User`, `Team`,
   `TeamMember`, `UserSkill`. Student logs in with `mustChangePassword = true`.
2. **Problem selection** — Student browses `/projects/catalog` (template `Project` rows with
   `isTemplate = true`), checks approach uniqueness, then claims one. The claim creates a
   **child project** (`Project.parentProjectId` → template) inside a Postgres advisory-lock
   transaction, capped by `Project.maxTeams`.
3. **Own proposal** — Student submits free text at `/projects/propose` →
   `ProblemStatementProposal` with `verdict = PENDING`; AI scores it into `ProposalScore` +
   `ProposalRubricScore` and extracts structure into `ProposalExtraction` +
   `ProposalExtractionItem`; the verdict is then overwritten to `ACCEPTED | REJECTED |
   PENDING_ADMIN`. Accepted proposals may be published as a catalog `Project`
   (`publishedProjectId`).
4. **Intake** — Team runs the intake wizard → creates `ProjectLog` (version 0) plus its
   normalized children (`ProjectLogDuration`, `ProjectLogMember`, `ProjectLogTechnology`,
   `ProjectLogWorkPackage`, `ProjectLogMilestone`, `ProjectLogSkill`, `ProjectLogSkillGap`).
5. **Execution doc generation** — AI produces `ExecutionDocument` version N with 11 normalized
   child tables. Markdown is stored for download; the child tables are the queryable truth.
6. **Daily execution** — `DailyWorkLog` (one row per project+user+date), `Task`/`Subtask`
   movement on Kanban/Gantt, `TeamMessage` chat, and an appended `ProjectLogEvent` for every
   lifecycle state change.
7. **Phase submission & review** — `ProjectPhase` → `PhaseSubmission` → faculty/admin review →
   on approval a `RewardTransaction` credits `User.rewardPoints`.
8. **GitHub sync** — `GithubRepository` upserted per project, with `GithubCommit`,
   `GithubContributor`, `GithubSnapshot` time series, and normalized language/label/milestone/
   structure children. `GithubCommit.linkedUserId` resolves a commit to a real user via
   `User.githubUsername` — the attribution backbone for all ranking.
9. **Evaluation cycle** — Every 15 days an admin runs evaluation → `EvaluationReport` (unique
   per project+cycle) with `EvaluationCategoryScore`, `EvaluationMemberScore`,
   `EvaluationFinding`, `EvaluationEvidence`, plus a denormalized pointer row
   `ProjectLogEvaluationRef`.
10. **Insights pipeline** — A scheduled job computes `ProjectOverlapFlag`
    (+`ProjectOverlapMember`), `StandoutProject`, and `OpportunityRecommendation` (+items).
    Admin triages each through its `status` field.
11. **Ranking** — `GroupRanking` per team; student ranking derived from `UserSkill`,
    `RewardTransaction`, `GithubCommit`, `DailyWorkLog`, `EvaluationMemberScore`.

### 1.5 What data must be stored, by area

| Area | Data that must persist |
|---|---|
| Identity | credentials, org/team membership, academic profile (year, dept, cluster, resident, learning mode), SSG enrolment, GitHub login, points |
| Catalog | full industry-grade problem metadata: soul, background, target users, constraints, out-of-scope, metrics, deliverables, CO/PO mapping, skills gained, hardware BOM, budget, standards, SDG alignment, references, similar products, duration |
| Differentiation | each claiming team's unique angle plus extracted keywords, for the similarity check |
| Lifecycle | an **append-only event log** plus a materialized current state, both versioned |
| Evidence | daily logs with hours/blockers/evidence URLs, phase submissions with evidence, commits |
| AI output | every AI verdict with its score breakdown, rationale, and an `isFallback` flag marking degraded (non-LLM) output |
| Audit | who changed what, admin actions, login history, errors, bulk-import provenance |
| Files | execution doc exports, phase evidence, uploaded assets, bulk-upload source spreadsheets |

---

## 2. Required Tables

Notation: `PK` primary key · `!` required (NOT NULL) · `?` nullable.

### 2.1 Identity, Organization, Team

#### `User`
- **Purpose**: every human principal in the system.
- **Supports**: Login, Register, Profile, Settings, Dashboard, and every ownership check.
- **Why needed**: root of all ownership and attribution.

| Column | Type | Req | Default | Notes |
|---|---|---|---|---|
| `id` | `TEXT` (cuid) | ! | `cuid()` | PK |
| `email` | `TEXT` | ! | — | UNIQUE |
| `regNo` | `TEXT` | ? | — | UNIQUE; college register number |
| `fullName` | `TEXT` | ! | — | |
| `passwordHash` | `TEXT` | ! | — | bcrypt |
| `mustChangePassword` | `BOOLEAN` | ! | `false` | set `true` by bulk upload |
| `role` | `RoleType` | ! | — | **[CHANGE]** default `STUDENT` |
| `organizationId` | `TEXT` | ? | — | FK → `Organization` |
| `teamId` | `TEXT` | ? | — | FK → `Team` (denormalized primary team) |
| `githubUsername` | `TEXT` | ? | — | **[CHANGE]** add UNIQUE — attribution must be 1:1 |
| `year` | `TEXT` | ? | — | "I".."IV" → **[CHANGE]** enum `AcademicYear` |
| `department` | `TEXT` | ? | — | e.g. "Agricultural Engineering" |
| `deptCode` | `TEXT` | ? | — | "AG", "CSE", "ECE" |
| `cluster` | `TEXT` | ? | — | "CS" / "Non CS" |
| `gender` | `TEXT` | ? | — | |
| `resident` | `TEXT` | ? | — | "H" hosteller / "D" day-scholar |
| `learningMode` | `TEXT` | ? | — | e.g. "Project-Based Learning Mode" |
| `ssgEnrolled` | `BOOLEAN` | ! | `false` | |
| `ssgDomain` | `TEXT` | ? | — | "Hardware" / "Software" |
| `groupRegistered` | `BOOLEAN` | ! | `false` | |
| `skillsRegistered` | `BOOLEAN` | ! | `false` | |
| `rewardPoints` | `INTEGER` | ! | `0` | materialized sum of `RewardTransaction` |
| `activityPoints` | `INTEGER` | ! | `0` | |
| `teamRole` | `TEXT` | ? | — | "team-captain", "team-member-5" |
| `status` | `UserStatus` | ! | `ACTIVE` | **[NEW]** `ACTIVE\|SUSPENDED\|ALUMNI` |
| `lastLoginAt` | `TIMESTAMPTZ` | ? | — | **[NEW]** |
| `createdAt` / `updatedAt` | `TIMESTAMPTZ` | ! | `now()` / auto | |
| `deletedAt` | `TIMESTAMPTZ` | ? | — | **[NEW]** soft delete — never hard-delete a user; commits, evaluations and ledger rows reference them |

#### `Organization`
- **Purpose**: tenant boundary (the college/institution).
- **Supports**: every scoped query; multi-college readiness.
- **Columns**: `id` PK, `name!`, `createdAt!`, `updatedAt!`.
  **[NEW]** `slug TEXT UNIQUE`, `deletedAt?`.

#### `Team`
- **Purpose**: the student group that owns projects.
- **Supports**: Teams list, Team Detail (7 tabs), Members, Collaborate, rankings.
- **Columns**: `id` PK, `organizationId!`, `name!`, `description?`, `domain?`, `color?`
  default `#7C3AED`, `leadId?` → `User`, `maxMembers!` default `6`, `isPublic!` default `true`,
  `currentProjectLabel?`, `groupCode?` UNIQUE (`"A#100161"`), `groupLevel?`, `groupCategory?`,
  `iYearCount!` default `0`, `iiYearCount!` default `0`, timestamps.
  **[NEW]** `status TeamStatus! default ACTIVE` (`ACTIVE|ARCHIVED|DISBANDED`), `deletedAt?`.

#### `TeamMember`
- **Purpose**: explicit team membership with role label and join date.
- **Why needed**: `User.teamId` alone cannot express history or multiple memberships.
- **Columns**: `id` PK, `teamId!`, `userId!`, `roleLabel!`, `joinedAt!` default `now()`.
  UNIQUE `(teamId, userId)`. **[NEW]** `leftAt?`, `isActive BOOLEAN! default true`.

#### `TeamInvite`
- **Purpose**: both directions of joining — `type` is `INVITE` (team→user) or `JOIN_REQUEST`
  (user→team).
- **Columns**: `id` PK, `teamId!`, `email!`, `userId?`, `roleLabel!` default `"Member"`,
  `message?`, `skills TEXT[]!` default `{}`, `type!` default `INVITE`, `status!` default
  `pending`, `invitedBy?`, timestamps.
  **[CHANGE]** `type` → enum `InviteType`; `status` → enum `InviteStatus`
  (`PENDING|ACCEPTED|DECLINED|EXPIRED`); `invitedBy` → FK `User.id`.
  **[NEW]** `expiresAt?`, `respondedAt?`.

#### `TeamCollaboration`
- **Purpose**: team-to-team collaboration requests; accepted ones populate
  `Project.collaboratingTeamId`.
- **Columns**: `id` PK, `fromTeamId!`, `toTeamId!`, `projectName?`, `message?`, `status!`
  default `pending`, `requestedBy?`, timestamps.
  **[CHANGE]** `status` → enum `CollaborationStatus`; `requestedBy` → FK.
  **[NEW]** CHECK `fromTeamId <> toTeamId`; partial UNIQUE `(fromTeamId, toTeamId)
  WHERE status = 'PENDING'`.

#### `TeamMessage`
- **Purpose**: team chat (Team Detail → Chat tab; also the Project Workspace chat surface).
- **Columns**: `id` PK, `teamId!`, `userId!`, `message!`, `createdAt!`.
  **[NEW]** `editedAt?`, `deletedAt?` (chat must soft-delete, never hard-delete),
  `attachmentFileId?` → `StoredFile`.

#### `UserSkill`
- **Purpose**: per-student skill inventory with points and cohort rank.
- **Supports**: Profile, Admin Top Students, skill-gap analysis in the Project Log.
- **Columns**: `id` PK, `userId!`, `skillName!`, `skillType!` (`primary|secondary|
  specialization`), `totalPoints!` default `0`, `skillRank?`, `totalRanks?`.
  UNIQUE `(userId, skillName)`.
  **[CHANGE]** `skillType` → enum `SkillType`. **[NEW]** `updatedAt`.

#### `UserProfileLink` **[NEW]**
- **Purpose**: LeetCode / LinkedIn / portfolio handles surfaced on Profile and used by the
  contest module. Today there is nowhere to store them, so only `githubUsername` exists.
- **Columns**: `id` PK, `userId!`, `platform ProfilePlatform!`, `handle!`, `url?`,
  `verifiedAt?`. UNIQUE `(userId, platform)`.

### 2.2 Project Core & Catalog

#### `Project`
- **Purpose**: dual-role table — a **template** (`isTemplate = true`, the catalog problem
  statement) and a **claimed instance** (`parentProjectId` pointing at the template).
- **Supports**: Catalog, All Projects, Project Detail workspace, and every downstream module.
- **Why one table rather than two**: a claimed project inherits all catalog metadata and adds
  only team-specific differentiation; splitting would duplicate ~30 columns and break the
  similarity engine, which compares templates and instances in the same query.

| Group | Columns |
|---|---|
| Identity | `id` PK, `organizationId!`, `teamId?`, `collaboratingTeamId?`, `name!`, `description?` |
| Classification | `domain?`, `sector?`, `shortName?`, `difficultyLevel?`, `type?` (Hardware/Software), `category ProjectCategory?`, `problemId?` UNIQUE (`"H0001"`, `"S0001"`) |
| Lifecycle | `approved!` default `false`, `status!` default `"planned"`, `isTemplate!` default `false`, `parentProjectId?` self-FK, `maxTeams!` default `3` |
| Narrative | `problemStatement?`, `objective?`, `expectedOutcome?`, `requirements?`, `innovation?`, `soul?`, `backgroundContext?`, `targetUsers?`, `constraints?`, `outOfScope?`, `expectedImpact?`, `publicationPotential?` |
| Arrays | `technologies[]`, `courseOutcomes[]`, `programOutcomes[]`, `skillsGained[]`, `prerequisites[]`, `hardwareComponents[]`, `standards[]`, `sdgAlignment INT[]`, `referenceLinks[]`, `similarProducts[]` |
| Legacy JSON (superseded) | `useCases`, `expectedMetrics`, `deliverables`, `phases`, `typeSpecific` — replaced by the five normalized children in Phase 3 of `db_change.md`; keep read-only, then drop |
| Budget / duration | `budgetEstimateInr?`, `budgetNotes?`, `suggestedDurationWeeks?` |
| Differentiation | `differentiationApproach?` (30+ chars), `differentiationKeywords[]` |
| Repo | `repoLink?` |
| Timestamps | `createdAt!`, `updatedAt!` |
| **[NEW]** | `status` → enum `ProjectStatus` (`PLANNED\|ACTIVE\|SUBMITTED\|COMPLETED\|WITHDRAWN\|ARCHIVED`), `deletedAt?`, `withdrawnAt?`, `claimedAt?`, `slug TEXT` |

#### Normalized catalog children (Phase 3 of `db_change.md`)

| Table | Purpose | Columns | Constraints |
|---|---|---|---|
| `ProjectUseCase` | one use case per row | `id`, `projectId!`, `text!`, `order!` default `0` | index `(projectId, order)` |
| `ProjectDeliverable` | one deliverable per row | same shape | index `(projectId, order)` |
| `ProjectExpectedMetric` | measurable target | `id`, `projectId!`, `name!`, `target!`, `unit?` | index `(projectId)`; **[NEW]** add `order` |
| `ProjectCatalogPhase` | review checkpoint | `id`, `projectId!`, `label!`, `week!`, `expected!` | index `(projectId, week)` |
| `ProjectTypeSpecific` | tier-3 block, 1:1 | `id`, `projectId!` UNIQUE, `kind!`, `data?`, `attributes JSONB?` | **[CHANGE]** `kind` → enum `ProjectTypeKind` (`SOFTWARE\|HARDWARE\|IOT`) |

All five: `ON DELETE CASCADE` from `Project`.

#### `ProjectMember`
- **Purpose**: which users work on which project.
- **Columns**: `id` PK, `projectId!`, `userId!`, `role RoleType!`, `createdAt!`.
  UNIQUE `(projectId, userId)`.
- **[CHANGE] Design defect**: `role` reuses the *system* enum `RoleType`. A project role is
  `LEAD | MEMBER | MENTOR | REVIEWER`, not `ADMIN|STUDENT|FACULTY` — a faculty mentor on a
  project is currently indistinguishable from a platform admin. Introduce
  `ProjectMemberRole`.
  **[NEW]** `joinedAt`, `leftAt?`, `isActive! default true`, `allocationPercent INT?`.

#### `ProjectReview`
- **Purpose**: faculty/admin milestone review of a project.
- **Columns**: `id` PK, `projectId!` (CASCADE), `reviewerId!`, `reportUrl?`, `milestone?`,
  `comments?`, `status!` default `pending`, timestamps.
  **[CHANGE]** `status` → enum `ReviewStatus` (`PENDING|APPROVED|CHANGES_REQUESTED`);
  `reportUrl` → `reportFileId` FK → `StoredFile`.

### 2.3 Proposal Pipeline

#### `ProblemStatementProposal`
- **Purpose**: a student-submitted idea moving through AI validation to publication.
- **Supports**: `/projects/propose`, `/projects/proposals`, admin proposal moderation.
- **Columns**: `id` PK, `submitterId!`, `rawText!`, `scores JSONB?` (legacy), `verdict!`,
  `reasons[]`, `improvementHints[]`, `duplicateOfId?` → `Project`, `extracted JSONB?`
  (legacy), `publishedProjectId?` → `Project`, timestamps.
- **Status field doubles as job state**: `db_change.md` explicitly rejects a separate
  `ProposalAnalysisJob` table — writing `PENDING` on submit and overwriting with the terminal
  verdict gives the full async lifecycle at zero schema cost, `FAILED` covers the error state,
  and `updatedAt` already covers staleness. This design honours that decision.
  **[CHANGE]** `verdict` → enum `ProposalVerdict` = `PENDING | ACCEPTED | REJECTED |
  PENDING_ADMIN | FAILED`.
  **[NEW]** `evaluatedAt?`; `inputHash TEXT?` — `db_change.md` notes the determinism-cache hash
  can live inside the existing JSON, but a real column is indexable and makes the cache lookup
  an index probe instead of a JSON scan.

#### `ProposalScore` / `ProposalRubricScore`
- `ProposalScore`: `id` PK, `proposalId!` UNIQUE (CASCADE), `overallScore FLOAT!`,
  `feasibility?`, `impact?`, `novelty?`, `technicalDepth?`, `clarity?`, `createdAt!`.
- `ProposalRubricScore`: `id` PK, `scoreId!` (CASCADE), `family!` (`RUBRIC|INDUSTRY|
  PERSPECTIVE`), `dimension!`, `scoreValue FLOAT!`, `rationale?`; index `(scoreId, family)`.
  **[CHANGE]** `family` → enum `RubricFamily`; add UNIQUE `(scoreId, family, dimension)`.
- **Note**: `docs/db_change.md` recommended *deferring* per-rubric rows until an admin analytics
  view needed them. The current schema shows they were subsequently built in Phase 2 — the
  deferral is resolved, and this design keeps them.

#### `ProposalExtraction` / `ProposalExtractionItem`
- `ProposalExtraction`: `id` PK, `proposalId!` UNIQUE (CASCADE), `problemStatement?`,
  `proposedSolution?`, `targetAudience?`, `domain?`, `createdAt!`.
- `ProposalExtractionItem`: `id` PK, `extractionId!` (CASCADE), `kind!`
  (`OBJECTIVE|DELIVERABLE|TECH|CONSTRAINT`), `value!`; index `(extractionId, kind)`.
  **[CHANGE]** `kind` → enum `ExtractionItemKind`. **[NEW]** `order INT! default 0`.

### 2.4 Tasks, Boards, Delivery

#### `Task`
- **Purpose**: unit of work, shared by the Kanban board and the Gantt timeline.
- **Columns**: `id` PK, `projectId!`, `assigneeId?`, `title!`, `description?`, `status!`
  default `"todo"`, `priority!` default `"medium"`, `category?` default `"Development"`,
  `progress INT!` default `0`, `startDate?`, `dueDate?`, `completedAt?`, timestamps.
- **CRITICAL [CHANGE]** — `docs/db_change.md` documents a live defect: three pages write three
  different vocabularies into this one unconstrained `String` column —

  | Writer | Values written |
  |---|---|
  | Kanban Board | `todo`, `in-progress`, `in-review`, `done` |
  | Gantt "Add Task" (pre-fix) | `todo`, `on-track`, `in-progress`, `at-risk`, `completed` |
  | Team Detail tasks tab | `progress` |

  A task created from Gantt with `on-track` had no matching Kanban column and silently
  disappeared. The Gantt read-side was patched, but the log explicitly flags that
  `TeamDetailPage.tsx` **still writes `progress`** and the root cause is unfixed. The correct
  fix is at the schema: `TaskStatus = TODO | IN_PROGRESS | IN_REVIEW | DONE`, with a one-time
  backfill (`on-track|progress|at-risk → IN_PROGRESS`, `completed → DONE`).
  Also `TaskPriority = LOW|MEDIUM|HIGH|URGENT`; CHECK `progress BETWEEN 0 AND 100`;
  CHECK `dueDate >= startDate`.
  **[NEW]** `deletedAt?`, `createdById` FK.

#### `Subtask`
- `id` PK, `taskId!`, `title!`, `done!` default `false`.
  **[NEW]** `order INT! default 0`, `createdAt`, `completedAt?`; CASCADE from `Task`.

#### `Board` / `BoardColumn`
- `Board`: `id` PK, `projectId!`, `name!`. **[NEW]** `isDefault BOOLEAN! default false`, timestamps.
- `BoardColumn`: `id` PK, `boardId!`, `name!`, `position INT!`.
  **[NEW]** `wipLimit INT?`, `statusKey TaskStatus!` (so a column maps to a real status rather
  than matching by name), UNIQUE `(boardId, position)`.

#### `Label` — **[CHANGE] normalization defect**
- Today: `id` PK, `taskId!`, `name!`, `color!` — a label is *owned by one task*, so the same
  "backend" label is stored once per task, with its colour re-entered each time.
- Should be: `ProjectLabel(id, projectId, name, color)` with UNIQUE `(projectId, name)`, plus
  join table `TaskLabel(taskId, labelId)` with composite PK `(taskId, labelId)`.

#### `Comment` — `id` PK, `taskId!`, `userId!`, `body!`, `createdAt!`.
  **[NEW]** `updatedAt`, `deletedAt?`, `parentCommentId?` (threading).
#### `Sprint` — `id` PK, `projectId!`, `name!`, `startsAt?`, `endsAt?`.
  **[NEW]** `goal?`, `status SprintStatus! default PLANNED`, CHECK `endsAt > startsAt`.
#### `Milestone` — `id` PK, `projectId!`, `title!`, `dueDate?`. Feeds the Dashboard deadline merge.
  **[NEW]** `status MilestoneStatus! default PENDING`, `completedAt?`, `description?`.
#### `Meeting` — `id` PK, `projectId!`, `title!`, `notes?`, `startsAt?`.
  **[NEW]** `endsAt?`, `location?`, `createdById`, timestamps.
#### `Report` — `id` PK, `projectId!`, `name!`, `generatedAt!`.
  **[NEW]** `fileId` FK → `StoredFile`, `kind ReportKind`, `generatedById` FK.

### 2.5 Project Log — event-sourced lifecycle state (Phase 5 of `db_change.md`)

#### `ProjectLog`
- **Purpose**: the **materialized current state** of a project's lifecycle plus a version
  counter for optimistic concurrency.
- **Columns**: `id` PK, `projectId!` UNIQUE (CASCADE), `version INT!` default `0`,
  `state JSONB!` (legacy fallback — the normalized children are now authoritative),
  `createdAt!`, `updatedAt!`.
- **Why**: rendering the workspace should be one row plus children, not a replay of every event.

#### `ProjectLogEvent`
- **Purpose**: **append-only** record of every lifecycle mutation — this module's own audit log.
- **Columns**: `id` PK, `logId!` (CASCADE), `seq INT!` (monotonic per log; equals
  `state.version` after apply), `type!`, `actorUserId!` (userId | `"SYSTEM"` | `"AI"`),
  `data JSONB!` (legacy), `note?`, `createdAt!`.
  UNIQUE `(logId, seq)`, index `(logId, type)`.
- **[CHANGE]** `type` → enum `ProjectLogEventType`; revoke UPDATE/DELETE grants on this table so
  append-only is enforced by the database, not by convention.

#### `ProjectLogEventField`
- **Purpose**: normalized key/value decomposition of the event payload, so events are queryable
  without JSON operators.
- **Columns**: `id` PK, `eventId!` (CASCADE), `key!`, `valueText?`, `valueNum FLOAT?`,
  `valueBool?`, `valueDate?`; index `(eventId, key)`.
- **[NEW]** CHECK: exactly one `value*` column is non-null.

#### Materialized-state children (all CASCADE from `ProjectLog`)

| Table | Purpose | Key columns | Constraints & changes |
|---|---|---|---|
| `ProjectLogDuration` | current planned duration (1:1) | `logId!` UNIQUE, `months!`, `startDate!`, `endDate!` | CHECK `endDate > startDate` |
| `ProjectLogDurationHistory` | every duration change | `logId!`, `at!`, `months!`, `reason?` | index `(logId)` |
| `ProjectLogMember` | member snapshot inside the log | `logId!`, `userId!`, `name!`, `joinedAt!`, `active!` default `true` | UNIQUE `(logId, userId)`; **[CHANGE]** `userId` should be a real FK → `User` |
| `ProjectLogMemberResponsibility` | which work packages a member owns | `memberId!`, `workPackageId!` | **[CHANGE]** `workPackageId` is a bare string — make it FK → `ProjectLogWorkPackage.id`; UNIQUE `(memberId, workPackageId)` |
| `ProjectLogTechnology` | tech stack | `logId!`, `name!` | UNIQUE `(logId, name)` |
| `ProjectLogWorkPackage` | WBS item | `logId!`, `slug!`, `name!`, `percentage!` default `0`, `status!` default `NOT_STARTED`, `assignedTo TEXT[]` | UNIQUE `(logId, slug)`; **[CHANGE]** `assignedTo[]` duplicates `ProjectLogMemberResponsibility` — drop the array, keep the join table (single source of truth); `status` → enum `WorkPackageStatus`; CHECK `percentage BETWEEN 0 AND 100` |
| `ProjectLogMilestone` | milestone with due week/date | `logId!`, `milestoneId!` (client id `"m-1"`), `name!`, `expectedOutput?`, `dueWeek!`, `dueDate!`, `status!` default `PENDING` | UNIQUE `(logId, milestoneId)`; `status` → enum `LogMilestoneStatus` (`PENDING\|DONE\|MISSED`) |
| `ProjectLogMilestoneHistory` | every deadline change | `milestoneId!` (CASCADE), `at!`, `dueDate!`, `reason?` | index `(milestoneId)` |
| `ProjectLogSkill` | skills the team has | `logId!`, `skill!` | UNIQUE `(logId, skill)` |
| `ProjectLogSkillGap` | missing skills, and for which WPs | `logId!`, `skill!`, `missingFor TEXT[]` | index `(logId)`; **[CHANGE]** add UNIQUE `(logId, skill)` |
| `ProjectLogFlag` | AI-raised risk flag | `logId!`, `flagId!`, `at!`, `type!`, `message!`, `resolved!` default `false` | UNIQUE `(logId, flagId)`; `type` → enum `FlagType` = `DELAY\|INACTIVE_MEMBER\|MISSING_DEPENDENCY\|OVERLOAD\|TIMELINE_RISK\|TECH_DRIFT`; **[NEW]** `resolvedAt?`, `resolvedById?` |
| `ProjectLogEvaluationRef` | denormalized pointer to an evaluation | `logId!`, `cycle!`, `periodStart!`, `periodEnd!`, `authenticity FLOAT!`, `plagiarismRisk!` default `LOW`, `overall FLOAT!`, `reportId!` | UNIQUE `(logId, cycle)`; **[CHANGE]** `reportId` is a bare string — make it FK → `EvaluationReport.id` so a deleted report cannot leave a dangling reference |

### 2.6 Execution Documents

#### `ExecutionDocument`
- **Purpose**: an immutable, **versioned** AI-generated execution plan.
- **Columns**: `id` PK, `projectId!` (CASCADE), `version INT!`, `content JSONB!` (legacy),
  `markdown TEXT!` (rendered — source of truth for download), `createdAt!`.
  UNIQUE `(projectId, version)`.
- **Why versioned rather than mutable**: `PUT /lifecycle/:projectId/document` saves human edits;
  keeping versions preserves the AI-vs-human diff, which the evaluation engine reads as an
  authorship signal.
- **[NEW]** `generatedBy DocSource! default AI` (`AI|HUMAN|HYBRID`), `createdById?`,
  `isCurrent BOOLEAN` with partial UNIQUE index `(projectId) WHERE isCurrent` so "the current
  doc" is a single indexed lookup rather than a `MAX(version)` subquery.

Eleven CASCADE children, each carrying `order INT! default 0` and index
`(executionDocumentId, order)`:

| Table | Distinct columns |
|---|---|
| `ExecutionDocOverview` (1:1, UNIQUE `executionDocumentId`) | `background?`, `purpose?`, `problemStatement?`, `scope?`, `expectedOutcome?`, `targetUsers?`, `uniquenessNotes?` |
| `ExecutionDocObjective` | `text!` |
| `ExecutionDocDeliverable` | `text!` |
| `ExecutionDocRisk` | `text!` — **[NEW]** `severity RiskLevel?`, `mitigation?` |
| `ExecutionDocSuccessCriteria` | `text!` |
| `ExecutionDocSkillRequired` | `skill!` |
| `ExecutionDocWorkPackage` | `slug?`, `name!`, `description?`, `percentage!` default `0` |
| `ExecutionDocMilestone` | `name!`, `expectedOutput?`, `completionWeek!`, `rewardPoints!` default `0` |
| `ExecutionDocLearningResource` | `topic!`, `resource!`, `url?` |
| `ExecutionDocFeature` | `name!`, `description?`, `importance!` default `Medium`, `points!` default `0`, `implementationMethod?`, `aiRationale?` |
| `ExecutionDocTeamShare` | `userId?`, `name!`, `role!`, `sharePercent!` default `0`, `rewardPoints!` default `0`, `isLead!` default `false` |

**[CHANGE]** `ExecutionDocFeature.importance` → enum `Importance` (`HIGH|MEDIUM|LOW`);
`ExecutionDocTeamShare.userId` → real FK → `User` (`ON DELETE SET NULL`) — it is currently a
bare string, which means reward-share rows cannot be joined back to a user reliably.
Business rule (service-enforced, not a DB constraint): `SUM(sharePercent)` per document = 100.

### 2.7 Evaluation

#### `EvaluationReport`
- **Purpose**: the 15-day AI evaluation of a project.
- **Columns**: `id` PK, `projectId!` (CASCADE), `cycle INT!`, `periodStart!`, `periodEnd!`,
  `overallScore INT?`, `plagiarismRisk TEXT?`, `isFallback BOOLEAN!` default `false`,
  `statusNote?`, `mentorFeedback?`, `content JSONB?` (legacy), `createdAt!`.
  UNIQUE `(projectId, cycle)`, index `(overallScore)`.
- **Why `isFallback` matters**: it marks a report produced without a working LLM, so rankings
  and insights can exclude degraded output instead of treating it as a real assessment. Every
  AI-producing table in this schema carries the same flag, and that consistency is deliberate.
- **[CHANGE]** `plagiarismRisk` → enum `RiskLevel` (`LOW|MEDIUM|HIGH`); CHECK `overallScore
  BETWEEN 0 AND 100`; CHECK `periodEnd > periodStart`.
- **[NEW]** `generatedById?`, `modelUsed TEXT?`, `promptVersion TEXT?` — without these an AI
  verdict is not reproducible, and a student disputing a score cannot be answered.

| Child | Purpose | Columns | Constraints |
|---|---|---|---|
| `EvaluationCategoryScore` | per-category score | `reportId!`, `category!`, `score INT!`, `notes?` | UNIQUE `(reportId, category)` |
| `EvaluationMemberScore` | per-member score | `reportId!`, `userId!` FK, `score INT!`, `notes?` | UNIQUE `(reportId, userId)`, index `(userId)` — powers Admin Top Students |
| `EvaluationFinding` | typed finding | `reportId!`, `kind EvaluationFindingKind!`, `text!` | index `(reportId, kind)` |
| `EvaluationEvidence` | evidence key/value | `reportId!`, `category!`, `key!`, `value!` | index `(reportId, category)` |

All four CASCADE from `EvaluationReport`.

### 2.8 GitHub Integration

#### `GithubRepository`
- **Purpose**: cached full repo profile, one per project.
- **Columns** (grouped): identity (`id` PK, `projectId?` UNIQUE CASCADE, `owner!`,
  `repository!`, `description?`, `visibility!` default `public`, `defaultBranch?`, `homepage?`,
  `license?`, `topics[]`, `language?`, `languages JSONB?` legacy); repo timestamps
  (`repoCreatedAt?`, `repoUpdatedAt?`, `pushedAt?`, `sizeKb!`); flags (`isArchived`,
  `isDisabled`, `isTemplate`, `hasWiki`, `hasPages`, `hasDiscussions`, `hasReadme`,
  `hasContributing`, `hasCodeOfConduct`, `hasSecurityPolicy`, `hasChangelog`); counters
  (`stars`, `forks`, `watchers`, `subscribers`, `commitCount`, `branchCount`, `releaseCount`,
  `tagCount`, `contributorCount`, `openIssues`, `closedIssues`, `openPullRequests`,
  `closedPullRequests`, `mergedPullRequests`); latest-commit fields (`latestCommitSha?`,
  `latestCommitMessage?`, `latestCommitAuthor?`, `latestCommitDate?`); legacy JSON (`labels`,
  `milestones`, `structure` — all superseded by normalized children); derived scores
  (`popularityScore`, `maintenanceScore`, `communityScore`, `freshnessScore`); sync
  (`lastSyncedAt?`, `lastSyncError?`); timestamps.
  UNIQUE `(owner, repository)`.
- **[NEW]** `syncStatus SyncStatus! default IDLE` (`IDLE|SYNCING|OK|ERROR`) — `lastSyncError`
  alone cannot express "a sync is running right now", so concurrent refreshes cannot be blocked.

| Child | Purpose | Columns | Constraints |
|---|---|---|---|
| `GithubContributor` | per-repo contributor totals | `repositoryId!`, `username!`, `contributions!` default `0` | UNIQUE `(repositoryId, username)`; **[NEW]** `linkedUserId?` FK, for attribution symmetry with `GithubCommit` |
| `GithubCommit` | individual commit + attribution | `repositoryId!`, `sha!`, `author!`, `authorLogin?`, `authorEmail?`, `linkedUserId?` FK → `User`, `message!`, `date!`, `isMerge!` default `false` | UNIQUE `(repositoryId, sha)`; index `(repositoryId, date)`; index `(linkedUserId, date)` |
| `GithubSnapshot` | metric time series | `repositoryId!`, `capturedAt!`, `metrics JSONB!` (legacy) + 11 typed counters | index `(repositoryId, capturedAt)` |
| `GithubRepositoryLanguage` | bytes per language | `repositoryId!`, `language!`, `bytes INT!` | UNIQUE `(repositoryId, language)` |
| `GithubRepositoryLabel` | issue labels | `repositoryId!`, `name!`, `color?`, `description?` | UNIQUE `(repositoryId, name)` |
| `GithubRepositoryMilestone` | repo milestones | `repositoryId!`, `title!`, `state!` default `open`, `dueOn?` | UNIQUE `(repositoryId, title)` |
| `GithubRepoStructure` | repo hygiene (1:1) | `repositoryId!` UNIQUE, `hasSrc`, `hasTests`, `hasDocs`, `hasCi`, `fileCount`, `directoryCount`, `topLevelFolders[]` | one-to-one |

All CASCADE from `GithubRepository`.

**Why `GithubCommit.linkedUserId` is the most important FK in the platform**: it converts an
opaque GitHub login into a `User`, which is what makes per-student contribution ranking,
authenticity scoring, and `MISSING_WORK` findings possible at all. Phase 1 of `db_change.md`
added it together with `@@index([linkedUserId, date])` precisely for the
"commits by this student in this window" query that the evaluation engine runs per member per
cycle.

**Attribution rules** (**[ASSUMPTION]**, inferred from the column set):
1. `linkedUserId` = `User` where `githubUsername = authorLogin` (exact, case-insensitive).
2. Fallback: `User.email = authorEmail`.
3. Otherwise `NULL` — an unattributed commit must never be silently credited to the team lead.
4. `isMerge = true` commits are excluded from contribution counts.

### 2.9 Insights & Recommendation

#### `ProjectOverlapFlag`
- **Purpose**: AI-detected similarity cluster across projects — the academic-integrity signal.
- **Columns**: `id` PK, `clusterHash!` UNIQUE, `domain?`, `severity!`, `similarityScore FLOAT!`,
  `confidence INT!`, `overlappingFeatures[]`, `sharedTechnologies[]`, `keyDifferences[]`,
  `rationale!`, `recommendedAction!`, `isFallback!` default `false`, `status!` default `OPEN`,
  `reviewedById?`, `reviewNote?`, timestamps. Index `(status)`, `(domain, status)`.
- **Why `clusterHash` is UNIQUE**: it makes the pipeline idempotent — recomputing insights
  cannot create duplicate flags for the same cluster of projects.
- **[CHANGE]** `severity` → enum `OverlapSeverity` (`PARTIAL_OVERLAP|SUBSTANTIAL_OVERLAP|
  NEAR_DUPLICATE`); `status` → enum `TriageStatus` (`OPEN|ACKNOWLEDGED|DISMISSED|SUPPRESSED`).
  **[NEW]** `reviewedAt?`.

#### `ProjectOverlapMember`
- `id` PK, `flagId!` (CASCADE), `projectId!` (CASCADE), `teamId?`, `contentHash!`, `createdAt!`.
  UNIQUE `(flagId, projectId)`, index `(projectId)`.
- This is the many-to-many join that makes a flag span N projects.

#### `StandoutProject`
- **Purpose**: the "is this startup-worthy" verdict, one per project.
- `id` PK, `projectId!` UNIQUE (CASCADE), `teamId?`, `verdict!` (`NOT_YET|PROMISING|
  STARTUP_WORTHY`), `confidence INT!`, `evidenceScore FLOAT!`, `cyclesEvaluated INT!`,
  `avgScore`, `minScore`, `trendDelta`, `lastCycleSeen`, `oneLinePitch!`, `marketProblem!`,
  `differentiator!`, `defensibility!`, `targetMarket!`, `evidenceHighlights[]`, `risks[]`,
  `nextSteps[]`, `isFallback!`, `status!` default `OPEN`, `reviewedById?`, `reviewNote?`,
  timestamps. Index `(verdict, status)`.
- The `cyclesEvaluated` / `avgScore` / `minScore` / `trendDelta` block is a **cached rollup of
  `EvaluationReport`** — kept denormalized because the Admin Standouts page ranks across all
  projects and cannot afford a per-row aggregate.

#### `OpportunityRecommendation` / `OpportunityRecommendationItem`
- Parent: `id` PK, `projectId!` UNIQUE (CASCADE), `teamId?`, `opportunityScore FLOAT!`,
  `cyclesEvaluated`, `lastCycleSeen`, `hackathonFit INT!`, `presentationFit INT!`,
  `incubationFit INT!`, `recommendations JSONB!` (legacy), `isFallback!`, `status!` default
  `OPEN`, `reviewedById?`, `reviewNote?`, timestamps. Index `(status)`, `(opportunityScore)`.
- Item: `id` PK, `recommendationId!` (CASCADE), `type!`, `name!`, `url?`, `why?`, `deadline?`,
  `matchReason?`; index `(recommendationId)`.
- **[CHANGE]** `deadline` is a `String` — it must be `TIMESTAMPTZ?` to be sortable and
  filterable ("opportunities closing this month" is unanswerable today).
  `type` → enum `OpportunityType` (`HACKATHON|CONFERENCE|GRANT|INCUBATOR|COMPETITION`).

#### `InsightsRun` **[NEW]**
- **Purpose**: the insights scheduler's status lives **in memory only** today
  (`getInsightsStatus()` in `insights.scheduler`), so it is lost on restart, invisible to a
  second app instance, and gives admins no run history.
- **Columns**: `id` PK, `kind InsightKind!` (`OVERLAP|STANDOUT|OPPORTUNITY|ALL`),
  `status JobStatus!` (`QUEUED|RUNNING|SUCCESS|FAILED`), `startedAt!`, `finishedAt?`,
  `projectsScanned INT!` default `0`, `flagsCreated INT!` default `0`, `errorMessage?`,
  `triggeredById?` FK → `User` (NULL = scheduled run). Index `(kind, startedAt DESC)`.

### 2.10 Phases, Features, Rewards

#### `ProjectFeature`
- `id` PK, `projectId!` (CASCADE), `name!`, `description!`, `importance!`, `implementationMethod?`,
  `points INT!`, `aiRationale?`, `addedBy!` (`'AI'` or a userId), `status!` default `ACTIVE`
  (`ACTIVE|REMOVED`), timestamps. Index `(projectId, status)`.
- `status = REMOVED` is already a soft delete: the Team & Features tab never hard-deletes, so
  point history stays intact when a feature is dropped mid-project.
- **[CHANGE]** `addedBy` is an overloaded column (a sentinel string *or* a userId) — split into
  `addedBySource ActorSource!` (`AI|USER|SYSTEM`) + `addedByUserId?` FK.
  `importance` → enum `Importance`.

#### `ProjectPhase`
- `id` PK, `projectId!` (CASCADE), `phaseNumber INT!`, `title!`, `expectedDeliverables!`,
  `weekTarget INT!`, `points INT!`, `hardwareNote?`, `status!` default `PLANNED`, timestamps.
  UNIQUE `(projectId, phaseNumber)`.
- The Dashboard derives a deadline as `project.createdAt + weekTarget × 7 days`.
  **[NEW]** store `targetDate TIMESTAMPTZ` explicitly so the deadline query is an indexed range
  scan instead of a computed expression across every project.
  **[CHANGE]** `status` → enum `PhaseStatus` (`PLANNED|SUBMITTED|APPROVED|CHANGES_REQUESTED`).

#### `PhaseSubmission`
- `id` PK, `phaseId!` (CASCADE), `projectId!`, `submittedById!`, `submissionNote!`,
  `evidenceUrls JSONB?` (legacy → `EvidenceUrl`), `status!` default `PENDING`, `reviewedById?`,
  `reviewNote?`, `reviewedAt?`, `createdAt!`. Index `(phaseId, status)`.
- **[CHANGE]** `projectId` is denormalized with no FK — add it (`ON DELETE CASCADE`).
- **[NEW]** `attemptNumber INT!` so resubmissions after `CHANGES_REQUESTED` are ordered;
  CHECK `status = 'PENDING' OR reviewedById IS NOT NULL`.

#### `RewardTransaction`
- **Purpose**: append-only points ledger; `User.rewardPoints` is its materialized sum.
- `id` PK, `userId!`, `projectId?`, `source!` (`PHASE_APPROVAL|DAILY_LOG|ADMIN_ACHIEVEMENT`),
  `sourceRefId?`, `points INT!`, `note?`, `createdAt!`. Index `(userId)`, `(projectId)`.
- **[CHANGE]** `source` → enum `RewardSource`.
- **[NEW] Important**: UNIQUE `(source, sourceRefId)` — without it a retried phase approval
  credits the points twice, and there is no way to detect it after the fact. This is the single
  cheapest integrity fix in the schema.

### 2.11 Evidence, Daily Work, Engagement

#### `DailyWorkLog`
- **Purpose**: the primary evidence-of-work record; drives streaks, hours, and authenticity
  scoring.
- `id` PK, `projectId!` (CASCADE), `userId!` (CASCADE), `date DATE!`, `workDone!`,
  `hoursSpent FLOAT?`, `blockers?`, `evidenceUrls JSONB?` (legacy), timestamps.
  UNIQUE `(projectId, userId, date)`, index `(projectId, date)`.
- **Why the composite unique key**: exactly one log per person per project per day is the
  contract that makes streak and hour aggregation correct. `docs/db_change.md` records that the
  Dashboard streak grid was rebuilt to compute live from these dates after it was found
  persisting hardcoded `currentStreak: 12, longestStreak: 28` values.
- **[NEW]** index `(userId, date)` — the streak query filters by user across all projects, and
  the existing index leads with `projectId`, so it cannot serve that query.
  CHECK `hoursSpent BETWEEN 0 AND 24`.

#### `EvidenceUrl`
- **Purpose**: shared normalized evidence links for both daily logs and phase submissions.
- `id` PK, `ownerType!` (`DAILY_LOG|PHASE_SUBMISSION`), `ownerId!`, `url!`, `position INT!`
  default `0`, `createdAt!`. Index `(ownerType, ownerId)`.
- **[CHANGE] Polymorphic FK gap**: `ownerId` has no foreign key, so deleting a daily log
  silently orphans its evidence rows and no constraint can catch it. Two options:
  - **(a)** keep polymorphic, convert `ownerType` to an enum, clean up in application code;
  - **(b)** split into `DailyWorkLogEvidence` and `PhaseSubmissionEvidence`, each with a real
    CASCADE FK.
  **Recommended: (b).** This platform's entire value rests on evidence integrity; orphaned or
  mis-linked evidence is a worse outcome than one duplicated table shape.
- **[NEW]** `fileId?` FK → `StoredFile`, for uploaded (rather than linked) evidence.

#### `UserStreak`
- `id` PK, `userId!`, `currentStreak!` default `0`, `longestStreak!` default `0`,
  `totalContributions!` default `0`, `gridData TEXT!` (JSON string), timestamps.
- **[CHANGE] Two defects.** First, `db_change.md` (Dashboard entry) states the grid is now
  computed live from `DailyWorkLog` and *nothing is persisted* — so this table is a **cache**,
  not truth, and needs `computedAt` plus a documented invalidation rule. Second, the relation is
  `streaks UserStreak[]`, meaning one user can have unlimited streak rows for a per-user
  aggregate; it needs **UNIQUE `(userId)`**.
  `gridData` as a JSON string in a `TEXT` column should be `JSONB`.

#### `Notification`
- `id` PK, `userId!`, `title!`, `body!`, `readAt?`, `createdAt!`.
- **[NEW]** `type NotificationType!` (`DEADLINE|EVALUATION|TEAM_INVITE|PHASE_REVIEW|
  PROPOSAL_VERDICT|BROADCAST|MENTION`), `entityType?` + `entityId?` (deep link to the thing the
  notification is about — currently a notification cannot link anywhere), `priority?`.
  Index `(userId, readAt)` for the unread badge and `(userId, createdAt DESC)` for the list.

#### `NotificationPreference` **[NEW]**
- `id` PK, `userId!` UNIQUE, `emailEnabled`, `inAppEnabled`, `deadlineAlerts`,
  `evaluationAlerts`, `teamAlerts` — all `BOOLEAN! default true`.
- **Why**: `POST /notifications/broadcast` and `POST /notifications/deadline-alert` currently
  have no opt-out surface, and the Settings page has nowhere to persist one.

#### `AdminAchievement`
- `id` PK, `title!`, `description!`, `type!` (`individual|team`), `recipientId?`, `teamId?`,
  `points!` default `0`, `date!`, timestamps.
- **[CHANGE]** CHECK: exactly one of `recipientId` / `teamId` is non-null, consistent with
  `type`; `type` → enum `AchievementType`.
- Feeds `RewardTransaction` with `source = ADMIN_ACHIEVEMENT`.

#### `AdminChatHistory`
- `id` PK, `userId!`, `sessionId!`, `prompt!`, `response!`, `createdAt!`.
- **[NEW]** index `(userId, sessionId, createdAt)`; `modelUsed?`, `tokensUsed?` for cost
  attribution.
- **Note**: the `/admin/chat` and `/admin/ai-assistant` routes now redirect to `/admin/top-teams`
  in `App.tsx`, so this table currently has no live writer.

#### `GroupRanking`
- `id` PK, `teamId!` UNIQUE, `rank INT!`, `totalPoints INT!`.
- **[NEW]** `computedAt!`, `domain?` (Top Teams is grouped by domain — `getTopTeamsByDomain`),
  `previousRank?` so the page can show trend arrows without a second history table.

#### `Hackathon`
- `id` PK, `organizationId?`, `name!`, `dateRange TEXT!`, `status!` default `Upcoming`, `url?`,
  `description?`, `createdAt!`.
- **[CHANGE]** `dateRange` is free text (`"Aug 1 - Aug 3, 2025"`), so it cannot be sorted,
  filtered, or used for a deadline alert. Replace with `startsAt TIMESTAMPTZ!` +
  `endsAt TIMESTAMPTZ!` and render the label in the UI. `status` → enum `EventStatus`.

#### `LeetCodeContest`
- `id` PK, `organizationId?`, `name!`, `startTime!`, `status!` default `Register`, `url?`,
  `description?`, `createdAt!`. `status` → enum `ContestStatus`.
- `db_change.md` notes the hardcoded fallback arrays were removed from both of these — an empty
  table now genuinely renders as empty rather than masquerading as real data.

### 2.12 Storage tables

#### `FileAsset` (existing — **orphaned**)
- `id` PK, `userId!`, `name!`, `url!`, `mimeType!`, `createdAt!`.
- **Finding**: no server module references `prisma.fileAsset` except seed cleanup, while
  `POST /lifecycle/upload-asset` writes bytes straight to local disk (`uploads/assets/`) and
  returns a URL **without creating any database row**. Uploaded files are therefore untracked,
  unowned, unauthorized (the URL is a public static path), and unreclaimable. Cloudinary is
  configured in `infrastructure/storage/cloudinary.ts` but is not called anywhere.
  This is the largest single gap in the current design — see §8 for the replacement.

#### `StoredFile` **[NEW]** and `FileLink` **[NEW]** — full definitions in §8.

### 2.13 Auth / RBAC tables

#### `Role` (existing stub) — `id` PK, `organizationId!`, `name!`.
#### `Permission` (existing stub) — `id` PK, `organizationId!`, `key!`, `description?`.
- **Finding**: neither is joined to `User`, and there is no `RolePermission` table.
  Authorization is actually enforced by `middleware/requireRole.ts` reading the hardcoded
  `User.role` enum. Both tables are dead weight today.
- **Recommendation**: complete the model rather than delete it — routes already use
  `requireRole(['ADMIN','FACULTY'])`, faculty scoping is unresolved (**G-7**), and the platform
  will need per-org role variation. See §9.

#### `RefreshToken` **[NEW]**, `PasswordResetToken` **[NEW]**, `RolePermission` **[NEW]**,
`UserRole` **[NEW]** — see §9.

### 2.14 Audit & log tables

#### `ActivityLog` (existing)
- `id` PK, `userId!`, `action!`, `entityType!`, `entityId!`, `createdAt!`.
- **Finding**: `docs/db_change.md` states plainly that *nothing in the app writes to it* — the
  Dashboard's "recent activity" always returned `[]` and was rewritten to merge `Task` status
  changes and `PhaseSubmission` events instead. Either start writing from a central Prisma
  middleware hook, or drop it. An empty audit table is worse than no audit table, because it
  looks like coverage.

#### `AuditLog` (existing)
- `id` PK, `userId!`, `action!`, `details TEXT?`, `createdAt!`.
- **[CHANGE]** `details` as free text is not queryable. Add `entityType`, `entityId`,
  `before JSONB`, `after JSONB`, `ipAddress INET`, `userAgent`.

#### `LoginHistory` **[NEW]**, `EntityChangeHistory` **[NEW]**, `ErrorLog` **[NEW]**,
`BulkUploadBatch` **[NEW]**, `BulkUploadRow` **[NEW]** — see §10.

---

## 3. Primary Keys

**Global convention**: every table uses a single-column `TEXT` primary key generated by
`cuid()`. This is already consistent across all 94 models and should not be changed.

**Why cuid over auto-increment integers**: IDs appear in URLs
(`/projects/:id`, `/teams/:id`), are generated client-side during the intake wizard before a
round-trip, and must not leak volume ("we have 12 projects"). Sequential integers leak
enumeration and make merging seeded/imported data across environments painful.

**Why cuid over UUIDv4**: cuid is roughly monotonic, so B-tree inserts stay at the right edge
of the index instead of scattering — meaningful for the high-insert tables (`GithubCommit`,
`ProjectLogEvent`, `DailyWorkLog`). If a move to UUID is ever wanted, use **UUIDv7**, never v4.

| Table group | PK | Type | Why |
|---|---|---|---|
| `User`, `Organization`, `Team`, `Project` | `id` | cuid | public in URLs; must not enumerate |
| All join tables (`ProjectMember`, `TeamMember`, `ProjectOverlapMember`) | `id` | cuid | surrogate PK + a UNIQUE composite (see below) |
| All normalized child tables (catalog, execution doc, project log, evaluation) | `id` | cuid | Prisma relations need a scalar PK; the natural key is a UNIQUE constraint instead |
| `TaskLabel` **[NEW]** | `(taskId, labelId)` | **composite** | pure join, no independent identity, never referenced by another table |
| `RolePermission` **[NEW]** | `(roleId, permissionId)` | **composite** | same reasoning |
| `UserRole` **[NEW]** | `(userId, roleId)` | **composite** | same reasoning |

### 3.1 Surrogate PK + natural UNIQUE key

Several tables have a genuine natural key that is enforced as a UNIQUE constraint rather than
the PK, so that child rows can reference a short stable id:

| Table | Surrogate PK | Natural key (UNIQUE) | Why not make the natural key the PK |
|---|---|---|---|
| `ProjectMember` | `id` | `(projectId, userId)` | membership rows are referenced from audit logs |
| `TeamMember` | `id` | `(teamId, userId)` | same |
| `GithubCommit` | `id` | `(repositoryId, sha)` | 40-char sha × repo id would bloat every index |
| `DailyWorkLog` | `id` | `(projectId, userId, date)` | evidence rows point at the log id |
| `EvaluationReport` | `id` | `(projectId, cycle)` | 4 child tables FK to it |
| `ExecutionDocument` | `id` | `(projectId, version)` | 11 child tables FK to it |
| `ProjectLogEvent` | `id` | `(logId, seq)` | `ProjectLogEventField` FKs to it |
| `ProjectPhase` | `id` | `(projectId, phaseNumber)` | `PhaseSubmission` FKs to it |
| `ProjectLogWorkPackage` | `id` | `(logId, slug)` | responsibilities FK to it |
| `ProjectLogMilestone` | `id` | `(logId, milestoneId)` | history rows FK to it |
| `GithubRepository` | `id` | `(owner, repository)` | 7 child tables FK to it |
| `ProjectOverlapFlag` | `id` | `clusterHash` | members FK to it; hash is 64 chars |

### 3.2 Slug / business-key candidates

These are business identifiers, deliberately **not** primary keys, because they are
human-assigned and therefore mutable:

| Table | Business key | Should be UNIQUE |
|---|---|---|
| `Project` | `problemId` (`"H0001"`) | yes — already is |
| `Team` | `groupCode` (`"A#100161"`) | yes — already is |
| `User` | `email`, `regNo` | yes — already are |
| `User` | `githubUsername` | **[CHANGE]** must become UNIQUE — two users claiming the same GitHub login silently corrupts every commit attribution and therefore every ranking |
| `Organization` | `slug` **[NEW]** | yes |
| `Project` | `slug` **[NEW]** | UNIQUE per organization |

---

## 4. Foreign Keys and Relationships

### 4.1 Cascade policy — the three rules

1. **CASCADE** when the child has no meaning without the parent (a use case without its
   project, an evaluation category score without its report). All "normalized array" children
   from `db_change.md` Phases 2/3/5 fall here.
2. **RESTRICT** when the parent is a business entity whose deletion should be a deliberate act
   (`Organization`, `Team`, `User`). Use soft delete (`deletedAt`) instead of deleting.
3. **SET NULL** when the reference is informational and the child survives without it
   (`reviewedById`, `assigneeId`, `duplicateOfId`).

**Never CASCADE from `User`.** A user's commits, evaluation scores, reward ledger and audit
trail are institutional records. `EvaluationMemberScore` and `DailyWorkLog` currently cascade
from `User` — see the change column below.

### 4.2 Identity & team relationships

| Parent | Child | FK column | Type | Cascade | Reason |
|---|---|---|---|---|---|
| `Organization` | `User` | `organizationId` | 1→N | RESTRICT | tenant boundary; deleting an org must not delete students |
| `Organization` | `Team` | `organizationId` | 1→N | RESTRICT | same |
| `Organization` | `Project` | `organizationId` | 1→N | RESTRICT | same |
| `Organization` | `Role` / `Permission` | `organizationId` | 1→N | CASCADE | RBAC config is org-owned config, not records |
| `Organization` | `Hackathon` / `LeetCodeContest` | `organizationId` | 1→N | SET NULL | nullable already — global events have no org |
| `Team` | `User` | `teamId` | 1→N | SET NULL | denormalized "primary team"; user outlives the team |
| `User` | `Team` | `leadId` | 1→N (as lead) | SET NULL | team survives its lead leaving |
| `Team` | `TeamMember` | `teamId` | 1→N | CASCADE | membership is meaningless without the team |
| `User` | `TeamMember` | `userId` | 1→N | RESTRICT | **[CHANGE]** keep the membership record for history |
| `Team` | `TeamInvite` | `teamId` | 1→N | CASCADE | |
| `User` | `TeamInvite` | `userId` | 1→N | SET NULL | invite is addressed by email; user link is a convenience |
| `Team` | `TeamMessage` | `teamId` | 1→N | CASCADE | chat dies with the team |
| `User` | `TeamMessage` | `userId` | 1→N | RESTRICT | **[CHANGE]** preserve authorship; use soft delete on the message |
| `Team` | `TeamCollaboration` | `fromTeamId` / `toTeamId` | 1→N ×2 | CASCADE | self-referencing M:N between teams |
| `User` | `UserSkill` | `userId` | 1→N | CASCADE | skill inventory is pure profile data |

### 4.3 Project relationships

| Parent | Child | FK column | Type | Cascade | Reason |
|---|---|---|---|---|---|
| `Project` (template) | `Project` (instance) | `parentProjectId` | 1→N self | RESTRICT | a template with claims must not be deletable; the catalog page counts these against `maxTeams` |
| `Team` | `Project` | `teamId` | 1→N | SET NULL | a withdrawn project keeps existing unowned |
| `Team` | `Project` | `collaboratingTeamId` | 1→N | SET NULL | second team is optional |
| `Project` | `ProjectMember` | `projectId` | 1→N | CASCADE | |
| `User` | `ProjectMember` | `userId` | 1→N | RESTRICT | **[CHANGE]** membership is evidence of participation |
| `Project` | `ProjectUseCase` / `ProjectDeliverable` / `ProjectExpectedMetric` / `ProjectCatalogPhase` | `projectId` | 1→N ×4 | CASCADE | normalized catalog arrays |
| `Project` | `ProjectTypeSpecific` | `projectId` UNIQUE | 1→1 | CASCADE | tier-3 block |
| `Project` | `ProjectFeature` | `projectId` | 1→N | CASCADE | |
| `Project` | `ProjectPhase` | `projectId` | 1→N | CASCADE | |
| `ProjectPhase` | `PhaseSubmission` | `phaseId` | 1→N | CASCADE | |
| `User` | `PhaseSubmission` | `submittedById` | 1→N | RESTRICT | submission authorship is an academic record |
| `User` | `PhaseSubmission` | `reviewedById` | 1→N | SET NULL | reviewer may leave the institution |
| `Project` | `ProjectReview` | `projectId` | 1→N | CASCADE | already CASCADE |
| `User` | `ProjectReview` | `reviewerId` | 1→N | RESTRICT | |
| `Project` | `Task` / `Board` / `Sprint` / `Milestone` / `Meeting` / `Report` | `projectId` | 1→N ×6 | CASCADE | workspace artifacts |
| `User` | `Task` | `assigneeId` | 1→N | SET NULL | unassign rather than delete the task |
| `Task` | `Subtask` / `Comment` | `taskId` | 1→N | CASCADE | |
| `Task` ↔ `ProjectLabel` | via `TaskLabel` **[NEW]** | — | **M:N** | CASCADE both sides | replaces the per-task `Label` table |
| `Board` | `BoardColumn` | `boardId` | 1→N | CASCADE | |
| `User` | `Comment` | `userId` | 1→N | RESTRICT | preserve authorship |

### 4.4 Proposal relationships

| Parent | Child | FK column | Type | Cascade | Reason |
|---|---|---|---|---|---|
| `User` | `ProblemStatementProposal` | `submitterId` | 1→N | RESTRICT | proposals are academic submissions |
| `Project` | `ProblemStatementProposal` | `duplicateOfId` | 1→N | SET NULL | "duplicate of" is advisory |
| `Project` | `ProblemStatementProposal` | `publishedProjectId` | 1→N | SET NULL | unpublishing must not delete the proposal |
| `ProblemStatementProposal` | `ProposalScore` | `proposalId` UNIQUE | 1→1 | CASCADE | |
| `ProposalScore` | `ProposalRubricScore` | `scoreId` | 1→N | CASCADE | |
| `ProblemStatementProposal` | `ProposalExtraction` | `proposalId` UNIQUE | 1→1 | CASCADE | |
| `ProposalExtraction` | `ProposalExtractionItem` | `extractionId` | 1→N | CASCADE | |

### 4.5 Project Log relationships

| Parent | Child | FK column | Type | Cascade | Reason |
|---|---|---|---|---|---|
| `Project` | `ProjectLog` | `projectId` UNIQUE | 1→1 | CASCADE | one lifecycle log per project |
| `ProjectLog` | `ProjectLogEvent` | `logId` | 1→N | CASCADE | |
| `ProjectLogEvent` | `ProjectLogEventField` | `eventId` | 1→N | CASCADE | |
| `ProjectLog` | `ProjectLogDuration` | `logId` UNIQUE | 1→1 | CASCADE | |
| `ProjectLog` | `ProjectLogDurationHistory` | `logId` | 1→N | CASCADE | |
| `ProjectLog` | `ProjectLogMember` | `logId` | 1→N | CASCADE | |
| `ProjectLogMember` | `ProjectLogMemberResponsibility` | `memberId` | 1→N | CASCADE | |
| `ProjectLogWorkPackage` | `ProjectLogMemberResponsibility` | `workPackageId` | 1→N | CASCADE | **[CHANGE]** currently no FK at all — a bare string. This is what makes member↔work-package an honest **M:N** rather than a dangling reference |
| `ProjectLog` | `ProjectLogTechnology` / `ProjectLogSkill` / `ProjectLogSkillGap` / `ProjectLogFlag` / `ProjectLogWorkPackage` / `ProjectLogMilestone` / `ProjectLogEvaluationRef` | `logId` | 1→N ×7 | CASCADE | |
| `ProjectLogMilestone` | `ProjectLogMilestoneHistory` | `milestoneId` | 1→N | CASCADE | |
| `EvaluationReport` | `ProjectLogEvaluationRef` | `reportId` | 1→N | CASCADE | **[CHANGE]** currently a bare string with no FK |

### 4.6 Execution document relationships

| Parent | Child | FK column | Type | Cascade |
|---|---|---|---|---|
| `Project` | `ExecutionDocument` | `projectId` | 1→N (versions) | CASCADE |
| `ExecutionDocument` | `ExecutionDocOverview` | `executionDocumentId` UNIQUE | 1→1 | CASCADE |
| `ExecutionDocument` | the other 10 child tables | `executionDocumentId` | 1→N ×10 | CASCADE |
| `User` | `ExecutionDocTeamShare` | `userId` | 1→N | SET NULL | **[CHANGE]** currently a bare string |

### 4.7 Evaluation relationships

| Parent | Child | FK column | Type | Cascade | Reason |
|---|---|---|---|---|---|
| `Project` | `EvaluationReport` | `projectId` | 1→N (cycles) | CASCADE | |
| `EvaluationReport` | `EvaluationCategoryScore` / `EvaluationFinding` / `EvaluationEvidence` | `reportId` | 1→N ×3 | CASCADE | |
| `EvaluationReport` | `EvaluationMemberScore` | `reportId` | 1→N | CASCADE | |
| `User` | `EvaluationMemberScore` | `userId` | 1→N | **RESTRICT** | **[CHANGE]** currently CASCADE — deleting a user would erase their academic scores from every report, silently changing the report's totals. Must be RESTRICT + soft delete |

### 4.8 GitHub relationships

| Parent | Child | FK column | Type | Cascade | Reason |
|---|---|---|---|---|---|
| `Project` | `GithubRepository` | `projectId` UNIQUE | 1→1 | CASCADE | |
| `GithubRepository` | `GithubCommit` / `GithubContributor` / `GithubSnapshot` / `GithubRepositoryLanguage` / `GithubRepositoryLabel` / `GithubRepositoryMilestone` | `repositoryId` | 1→N ×6 | CASCADE | all are re-derivable cache |
| `GithubRepository` | `GithubRepoStructure` | `repositoryId` UNIQUE | 1→1 | CASCADE | |
| `User` | `GithubCommit` | `linkedUserId` | 1→N | SET NULL | the commit is a fact about the repo, not about the user; unlinking must not delete it |

### 4.9 Insights relationships

| Parent | Child | FK column | Type | Cascade | Reason |
|---|---|---|---|---|---|
| `ProjectOverlapFlag` | `ProjectOverlapMember` | `flagId` | 1→N | CASCADE | |
| `Project` | `ProjectOverlapMember` | `projectId` | 1→N | CASCADE | **effective M:N**: `Project` ↔ `ProjectOverlapFlag` |
| `Project` | `StandoutProject` | `projectId` UNIQUE | 1→1 | CASCADE | |
| `Project` | `OpportunityRecommendation` | `projectId` UNIQUE | 1→1 | CASCADE | |
| `OpportunityRecommendation` | `OpportunityRecommendationItem` | `recommendationId` | 1→N | CASCADE | |
| `User` | `ProjectOverlapFlag` / `StandoutProject` / `OpportunityRecommendation` | `reviewedById` | 1→N ×3 | SET NULL | triage decision outlives the reviewer's account |

### 4.10 Rewards, engagement, storage, auth

| Parent | Child | FK column | Type | Cascade | Reason |
|---|---|---|---|---|---|
| `User` | `RewardTransaction` | `userId` | 1→N | RESTRICT | financial-style ledger; never cascade |
| `Project` | `RewardTransaction` | `projectId` | 1→N | SET NULL | **[CHANGE]** no FK today |
| `User` | `DailyWorkLog` | `userId` | 1→N | **RESTRICT** | **[CHANGE]** currently CASCADE — deleting a user would erase the evidence base of every evaluation that cited it |
| `Project` | `DailyWorkLog` | `projectId` | 1→N | CASCADE | |
| `User` | `Notification` | `userId` | 1→N | CASCADE | notifications are ephemeral |
| `User` | `UserStreak` | `userId` UNIQUE **[CHANGE]** | 1→1 | CASCADE | derived cache |
| `User` / `Team` | `AdminAchievement` | `recipientId` / `teamId` | 1→N | SET NULL | |
| `Team` | `GroupRanking` | `teamId` UNIQUE | 1→1 | CASCADE | derived |
| `User` | `StoredFile` **[NEW]** | `uploadedById` | 1→N | RESTRICT | ownership of an uploaded artifact |
| `StoredFile` | `FileLink` **[NEW]** | `fileId` | 1→N | CASCADE | |
| `User` | `RefreshToken` **[NEW]** | `userId` | 1→N | CASCADE | sessions die with the account |
| `Role` ↔ `Permission` | `RolePermission` **[NEW]** | composite | **M:N** | CASCADE both | |
| `User` ↔ `Role` | `UserRole` **[NEW]** | composite | **M:N** | CASCADE both | |

### 4.11 Relationship-type summary

- **One-to-one (13)**: `Project↔ProjectLog`, `Project↔GithubRepository`,
  `Project↔StandoutProject`, `Project↔OpportunityRecommendation`, `Project↔ProjectTypeSpecific`,
  `Team↔GroupRanking`, `ProjectLog↔ProjectLogDuration`,
  `GithubRepository↔GithubRepoStructure`, `ExecutionDocument↔ExecutionDocOverview`,
  `ProblemStatementProposal↔ProposalScore`, `ProblemStatementProposal↔ProposalExtraction`,
  `User↔UserStreak` **[CHANGE]**, `User↔NotificationPreference` **[NEW]**.
- **Many-to-many (6)**: `User↔Project` (via `ProjectMember`), `User↔Team` (via `TeamMember`),
  `Team↔Team` (via `TeamCollaboration`), `Project↔ProjectOverlapFlag` (via
  `ProjectOverlapMember`), `Task↔ProjectLabel` (via `TaskLabel` **[NEW]**),
  `ProjectLogMember↔ProjectLogWorkPackage` (via `ProjectLogMemberResponsibility`).
- **Self-referencing (3)**: `Project.parentProjectId` (template→instance),
  `TeamCollaboration` (team→team), `Comment.parentCommentId` **[NEW]**.
- Everything else is one-to-many.

### 4.12 Known relationship gaps (numbered for reference)

| # | Gap | Impact | Fix |
|---|---|---|---|
| **G-1** | `EvidenceUrl.ownerId` has no FK (polymorphic) | orphaned evidence on delete | split into two tables with real FKs |
| **G-2** | `ProjectLogEvaluationRef.reportId` is a bare string | dangling reference to a deleted report | add FK |
| **G-3** | `ProjectLogMemberResponsibility.workPackageId` is a bare string | member responsibilities can point at nothing | add FK |
| **G-4** | `ProjectLogEvent.actorUserId` and `ProjectFeature.addedBy` mix userIds with `"SYSTEM"`/`"AI"` sentinels | cannot FK, cannot join to `User` | split into `actorSource` enum + nullable `actorUserId` FK |
| **G-5** | `ExecutionDocTeamShare.userId` is a bare string | reward shares cannot be reliably joined to users | add FK (SET NULL) |
| **G-6** | `PhaseSubmission.projectId` has no FK | denormalized column can drift from `phase.projectId` | add FK, or drop the column and join through `phase` |
| **G-7** | No faculty↔project assignment table | any faculty can review any project; no "my students" view is possible | add `ProjectMember` rows with `role = MENTOR`, or a dedicated `ProjectMentor` table |
| **G-8** | `User.githubUsername` is not UNIQUE | two users claiming one login corrupts all commit attribution and ranking | add UNIQUE |
| **G-9** | `Project(parentProjectId)` is unindexed | `db_change.md` names this: queried on every catalog listing, every claim capacity check, and every `/proposals/mine` request | add index |
| **G-10** | Uploaded files have no DB row at all | untracked, unowned, unauthorized, unreclaimable storage | `StoredFile` + `FileLink` (§8) |
| **G-11** | `RewardTransaction` has no idempotency key | retried approvals double-credit points | UNIQUE `(source, sourceRefId)` |
| **G-12** | `Task.status` is an unconstrained string with 3 writer vocabularies | tasks silently vanish from Kanban (documented live bug) | `TaskStatus` enum + backfill |

---

## 5. Page-wise Data Trace

Routes are taken verbatim from `client/src/App.tsx`.
"P" = permission required.

### 5.1 `/` — Landing (public)

| | |
|---|---|
| **Shows** | static marketing content; optionally public hackathon/contest counts via `public.routes.ts` |
| **Tables read** | `Hackathon`, `LeetCodeContest` (public endpoints) |
| **Creates / updates / deletes** | none |
| **P** | none — unauthenticated |

### 5.2 `/login` — Login

| | |
|---|---|
| **Shows** | email + password form |
| **Tables read** | `User` (by `email`) |
| **Creates** | `RefreshToken` **[NEW]**, `LoginHistory` **[NEW]** (success and failure) |
| **Updates** | `User.lastLoginAt` **[NEW]** |
| **P** | none; rate-limit by IP |
| **Note** | if `mustChangePassword = true`, force the change before issuing a full session |

### 5.3 `/register` — Register

| | |
|---|---|
| **Shows** | name, email, password, role selection |
| **Tables read** | `User` (uniqueness check on `email`, `regNo`), `Organization` |
| **Creates** | `User` (`role` defaults `STUDENT`), `NotificationPreference` **[NEW]**, `AuditLog` |
| **P** | none |
| **Rule** | `role` must never be settable to `ADMIN` from this form — only `PATCH /admin/users/:userId/role` may elevate |

### 5.4 `/dashboard` — Dashboard

| | |
|---|---|
| **Shows** | streak grid, KPI tiles (hours focused, active projects), team-growth chart, project-activity chart, upcoming deadlines, hackathons, LeetCode contests, recent activity |
| **Tables read** | `DailyWorkLog` (streak grid + `SUM(hoursSpent)`), `ProjectMember` + `Project` (active projects, correctly scoped per `db_change.md`), `RewardTransaction` + `GithubCommit` + `Project` (team-growth composite, cumulative by month), `Task.dueDate` + `Milestone.dueDate` + `ProjectPhase` (deadline merge, capped at 4), `Hackathon`, `LeetCodeContest`, `Task` + `PhaseSubmission` (recent activity), `UserStreak` (cache) |
| **Creates** | nothing — `db_change.md` explicitly removed the fake-streak persistence |
| **Updates** | `UserStreak` cache only, if the cache strategy is kept |
| **P** | authenticated; **all data scoped to `req.user.id`** — the `projectsActive` KPI bug was exactly an org-wide count leaking other students' data |

### 5.5 `/projects` — All Projects

| | |
|---|---|
| **Shows** | the user's projects and active projects, with team, status, domain |
| **Tables read** | `Project`, `ProjectMember`, `Team`, `GithubRepository` (repo badge) |
| **Creates** | `Project` + `ProjectMember` (create project), `ActivityLog` |
| **Updates** | `Project.status` |
| **Deletes** | withdraw → `Project.status = WITHDRAWN`, `withdrawnAt` set (**never** a hard delete) |
| **P** | read own + org-public; create requires team membership |
| **Known bug** | `project.service.ts:372` `withdrawProject` still calls `tx.document.deleteMany(...)` for the `Document` model deleted in the "Documents Section Removal" change — **withdrawal is currently broken at runtime**. No migration needed; the dead lines must be removed (also present in five seed/script files) |

### 5.6 `/projects/catalog` — Project Catalog

| | |
|---|---|
| **Shows** | template problem statements with full industry metadata; claim capacity (`claimed / maxTeams`); readiness; catalog tree by domain→sector |
| **Tables read** | `Project WHERE isTemplate = true`, plus `ProjectUseCase`, `ProjectDeliverable`, `ProjectExpectedMetric`, `ProjectCatalogPhase`, `ProjectTypeSpecific`; `Project WHERE parentProjectId = :id` for the capacity count; `Team`, `UserSkill` (readiness) |
| **Creates** | on select: child `Project` (`parentProjectId` set, `claimedAt`), `ProjectMember` rows, `ProjectLog` v0, `ProjectFeature` + `ProjectPhase` seeds; `CatalogSession` **[ASSUMPTION — `POST /catalog/session/start` exists but nothing is persisted today]** |
| **Updates** | `Project.differentiationApproach`, `differentiationKeywords` from the approach-uniqueness check |
| **P** | STUDENT with a team; the claim is serialized by a Postgres advisory lock on the template id |
| **Rule** | claims must not exceed `maxTeams`. `db_change.md` explicitly rejects `@@unique([parentProjectId, teamId])` — the advisory-lock transaction already closes that race, and the constraint would block legitimate re-claim after withdrawal |
| **Index needed** | `Project(parentProjectId)`, `Project(isTemplate, status)` — both named in `db_change.md`, neither applied |

### 5.7 `/projects/propose` — Propose Problem

| | |
|---|---|
| **Shows** | free-text idea form, live AI validation feedback |
| **Tables read** | `Project` (duplicate detection against the catalog) |
| **Creates** | `ProblemStatementProposal` (`verdict = PENDING`), then asynchronously `ProposalScore`, `ProposalRubricScore`, `ProposalExtraction`, `ProposalExtractionItem` |
| **Updates** | `ProblemStatementProposal.verdict` → terminal state; `duplicateOfId` when a near-match is found |
| **P** | STUDENT; rate-limited (`proposalEvaluateLimiter`) |
| **Rule** | detailed rubric scores are **hidden from students by design** — the API must project them away, not just hide them in the UI |

### 5.8 `/projects/proposals` — My Proposals

| | |
|---|---|
| **Shows** | the user's proposals with verdict, reasons, improvement hints, published project link |
| **Tables read** | `ProblemStatementProposal` (own only), `Project` (published + duplicate-of), `Project WHERE parentProjectId IN (…)` for claimed-template ids |
| **P** | owner only — `submitterId = req.user.id` |
| **Index needed** | `ProblemStatementProposal(submitterId, createdAt)` — named in `db_change.md`, not applied |

### 5.9 `/projects/:id` — Project Detail / Workspace (3 tabs)

The workspace shell reads `Project`, `Team`, `ProjectMember`, `GithubRepository`, `ProjectLog`.

**Tab 1 — Daily Log** (`DailyLogTab`)

| | |
|---|---|
| **Shows** | today's draft, history of logs, workload distribution across members |
| **Reads** | `DailyWorkLog`, `EvidenceUrl`, `ProjectLogWorkPackage` (workload) |
| **Creates/updates** | upsert `DailyWorkLog` on `(projectId, userId, date)`; `EvidenceUrl` rows; `RewardTransaction` (`source = DAILY_LOG`); `ProjectLogEvent` |
| **P** | project member; **a user may only write their own log for today** |

**Tab 2 — Team & Features Allocation** (`TeamFeaturesTab`)

| | |
|---|---|
| **Shows** | members with allocation, feature list with points and AI rationale, skill gaps |
| **Reads** | `ProjectMember`, `ProjectLogMember`, `ProjectLogMemberResponsibility`, `ProjectFeature`, `ProjectLogSkill`, `ProjectLogSkillGap`, `ProjectLogWorkPackage` |
| **Creates** | `ProjectFeature`, `ProjectMember`, `ProjectLogMember`, `ProjectLogEvent` |
| **Updates** | feature fields; work-package status and assignment |
| **Deletes** | feature → `status = REMOVED` (soft); member removal → `ProjectLogMember.active = false` |
| **P** | project member; **[ASSUMPTION]** removing a member should be lead/admin only |

**Tab 3 — Phase Execution Plan & Reviews** (`ExecutionPlanTab`)

| | |
|---|---|
| **Shows** | phases with deliverables, week target, points, status; submission history with review notes |
| **Reads** | `ProjectPhase`, `PhaseSubmission`, `EvidenceUrl`, `User` (submitter/reviewer) |
| **Creates** | `PhaseSubmission`, `EvidenceUrl`, `Notification` (to reviewers) |
| **Updates** | `ProjectPhase.status`; on review: `PhaseSubmission.status/reviewNote/reviewedAt` + `RewardTransaction` + `User.rewardPoints` + `ProjectLogEvent` |
| **P** | submit = project member; **review = ADMIN or FACULTY only** (`requireRole(['ADMIN','FACULTY'])`) |

**Sub-view — Evaluations** (`EvaluationsTab`, `EvaluationReportView`)

| | |
|---|---|
| **Reads** | `EvaluationReport` + `EvaluationCategoryScore` + `EvaluationMemberScore` + `EvaluationFinding` + `EvaluationEvidence` |
| **Creates** | running an evaluation writes the report and all four children, plus `ProjectLogEvaluationRef` |
| **P** | read = project member; **run = ADMIN only** |

**Sub-view — Mentor Panel** (`MentorPanel`)

| | |
|---|---|
| **Reads** | `ProjectLog` + children (context for the LLM) |
| **Creates** | **nothing today** — `POST /lifecycle/:projectId/mentor/ask` returns the answer and discards it. **[NEW]** `MentorConversation` / `MentorMessage` would be needed for history, cost tracking, and evaluating mentor quality |
| **P** | project member |

**Sub-view — Chat** (`ChatTab`) — reads/creates `TeamMessage`; P: team member.

### 5.10 `/projects/:id/execution-doc` and `/execution-doc/:id` — Execution Document

| | |
|---|---|
| **Shows** | rendered execution document: overview, objectives, deliverables, risks, success criteria, skills, work packages, milestones, learning resources, features, team share |
| **Reads** | `ExecutionDocument` + all 11 children |
| **Creates** | generate → a new `ExecutionDocument` version + all children |
| **Updates** | save → **[CHANGE]** should write a new version rather than mutate, preserving the AI-vs-human diff |
| **Deletes** | none — versions are immutable |
| **P** | project member; download produces a file that should be registered in `StoredFile` |

### 5.11 `/kanban` — Kanban Board

| | |
|---|---|
| **Shows** | columns `todo / in-progress / in-review / done` with task cards |
| **Reads** | `Task`, `Subtask`, `Label`, `Comment`, `User` (assignee), `Board`, `BoardColumn` |
| **Creates** | `Task`, `Subtask`, `Comment`, `Label` |
| **Updates** | `Task.status` (drag), `progress`, `assigneeId`, `completedAt` (set when status becomes `done`) |
| **Deletes** | `Task` — **[CHANGE]** should be soft (`deletedAt`) |
| **P** | project member |
| **Rule** | this page defines the canonical status vocabulary that §2.4's `TaskStatus` enum encodes |

### 5.12 `/timeline` — Timeline / Gantt

| | |
|---|---|
| **Shows** | top stats, category legend, task list, gantt bars with due-date diamonds and LATE badges, detail drawer (donut, dates, duration, assignee) |
| **Reads** | `Task` (`category`, `progress`, `startDate`, `dueDate`, `assigneeId`, `status`) |
| **Creates** | `Task` — the "Add Task" form now writes only Kanban-valid statuses after the fix |
| **Updates** | `PATCH /tasks/gantt/:taskId` exists on the backend but **has no frontend caller** — no drag-to-reschedule |
| **Deletes** | `DELETE /tasks/gantt/:taskId` |
| **P** | authenticated; note this is a **global, non-project-scoped route**, so the query must be scoped to the user's projects or it leaks org-wide tasks |

### 5.13 `/teams`, `/teams/:id` — Teams and Team Detail (7 tabs)

| Tab | Reads | Writes | Permission |
|---|---|---|---|
| Overview | `Team`, `TeamMember`, `User`, `GroupRanking` | `Team` fields | member reads; lead/admin updates |
| Members | `TeamMember`, `User`, `TeamInvite` | create `TeamInvite`, accept/decline, remove member | invite = lead; **add member = ADMIN only** (`requireRole('ADMIN')`); remove = lead/admin/self |
| Tasks | `Task` | create/update `Task` | member |
| Projects | `Project` | create `Project`, set `repoLink` (triggers `GithubRepository` sync) | member |
| Progress | `Project`, `ProjectPhase`, `PhaseSubmission`, `EvaluationReport` | — | member |
| Activity | `ActivityLog` (empty today), `Task`, `PhaseSubmission` | — | member |
| Chat | `TeamMessage`, `User` | create `TeamMessage` | member |

`/teams/:teamId/members` and `/teams/:id/collaborate` are dedicated pages over the same tables;
collaborate additionally reads/writes `TeamCollaboration` and, on accept, sets
`Project.collaboratingTeamId`.

### 5.14 `/files` — File Manager

| | |
|---|---|
| **Shows** | intended: uploaded project files |
| **Tables read** | **none — the page has no service wiring and `FileAsset` has no writer** |
| **Should read** | `StoredFile` + `FileLink` (§8) |
| **P** | owner or project member; a private file must be served through a signed URL, never a public static path |

### 5.15 `/analytics` — Analytics

| | |
|---|---|
| **Shows** | project/team/GitHub analytics |
| **Reads** | `GithubSnapshot` (time series), `GithubRepository`, `GithubCommit`, `EvaluationReport`, `RewardTransaction`, `Project` |
| **P** | authenticated; **college-wide analytics is ADMIN only** (`requireRole('ADMIN')` on `/github/college/analytics`) |

### 5.16 `/notifications`, `/settings`, `/profile`

| Page | Reads | Writes | P |
|---|---|---|---|
| Notifications | `Notification` | `readAt`, mark-all-read | own only |
| Settings | `User`, `NotificationPreference` **[NEW]** | `User` profile fields, `githubUsername`, password | own only |
| Profile | `User`, `UserSkill`, `UserStreak`, `RewardTransaction`, `ProjectMember`, `TeamMember`, `GithubCommit`, `EvaluationMemberScore` | `User` fields | own editable; others read-only |

### 5.17 Admin pages

| Page | Reads | Writes | P |
|---|---|---|---|
| `/admin/top-teams` | `GroupRanking`, `Team`, `Project`, `EvaluationReport`, `RewardTransaction` | — | ADMIN |
| `/admin/top-students` | `User`, `UserSkill`, `EvaluationMemberScore`, `GithubCommit`, `RewardTransaction`, `DailyWorkLog` | — | ADMIN |
| `/admin/overlaps` | `ProjectOverlapFlag`, `ProjectOverlapMember`, `Project`, `Team` | `status`, `reviewNote`, `reviewedById` | ADMIN |
| `/admin/standouts` | `StandoutProject`, `Project` | `status`, `reviewNote`, `reviewedById` | ADMIN |
| `/admin/upload` | previous batches | creates `User`, `Team`, `TeamMember`, `UserSkill`, `AdminAchievement` from Excel; **[NEW]** `BulkUploadBatch` + `BulkUploadRow` + `StoredFile` (the source spreadsheet) | ADMIN |

Ten legacy admin routes (`/admin/users`, `/admin/teams`, `/admin/projects`, `/admin/documents`,
`/admin/analytics`, `/admin/directory`, `/admin/chat`, `/admin/ai-assistant`,
`/admin/team-trends`, `/admin/student-trends`) redirect to `/admin/top-teams` or
`/admin/top-students` and read nothing.

---

## 6. Feature-wise Data Trace

### F1 — Authentication

| | |
|---|---|
| **Tables** | `User`, `RefreshToken` **[NEW]**, `PasswordResetToken` **[NEW]**, `LoginHistory` **[NEW]**, `AuditLog` |
| **CRUD** | C: user, refresh token, login history · R: user by email · U: `passwordHash`, `mustChangePassword`, `lastLoginAt` · D: revoke refresh token |
| **Business rules** | `mustChangePassword = true` forces a password change before a full session; `role` is never client-settable; a refresh token is single-use and rotated on refresh |
| **Validation** | email format + UNIQUE; password ≥ 8 chars; `regNo` UNIQUE when present |
| **Relationships** | `User → Organization` (nullable) |
| **Audit** | every login attempt (success and failure) → `LoginHistory`; every role change → `AuditLog` |

### F2 — Bulk Excel Import (students, teams, achievements)

| | |
|---|---|
| **Tables** | `BulkUploadBatch` **[NEW]**, `BulkUploadRow` **[NEW]**, `StoredFile` **[NEW]**, `User`, `Team`, `TeamMember`, `UserSkill`, `AdminAchievement`, `AuditLog` |
| **CRUD** | C: batch + one row per spreadsheet line + the resulting domain records · R: batch history · U: batch status as it progresses |
| **Business rules** | idempotent by `regNo` / `groupCode` — re-uploading the same file must update, not duplicate; imported users get `mustChangePassword = true`; a partial failure records per-row errors instead of aborting the batch |
| **Validation** | required headers present; `regNo` unique within the file; `groupCode` matches `A#\d+`; `year ∈ {I,II,III,IV}` |
| **Audit** | **required** — an import can create hundreds of users, and today there is no record of who uploaded what. `BulkUploadRow` gives per-row provenance |

### F3 — Problem Statement Catalog

| | |
|---|---|
| **Tables** | `Project` (templates), `ProjectUseCase`, `ProjectDeliverable`, `ProjectExpectedMetric`, `ProjectCatalogPhase`, `ProjectTypeSpecific` |
| **CRUD** | C/U/D: admin manages templates and their children · R: all authenticated users |
| **Business rules** | `isTemplate = true` and `parentProjectId IS NULL` for a template; `problemId` is globally unique; a template with claims cannot be deleted (RESTRICT) — archive it instead |
| **Validation** | `maxTeams ≥ 1`; `suggestedDurationWeeks` 1–52; `sdgAlignment` values 1–17; `courseOutcomes`/`programOutcomes` match `CO\d+` / `PO\d+` |
| **Relationships** | `Project` self-referencing template→instance |
| **Audit** | template publish/unpublish → `AuditLog` |

### F4 — Project Claiming (differentiation-gated)

| | |
|---|---|
| **Tables** | `Project` (new child row), `ProjectMember`, `ProjectLog` + children, `ProjectFeature`, `ProjectPhase`, `ProjectLogEvent` |
| **CRUD** | C: the entire project bootstrap in one transaction |
| **Business rules** | (1) count of children with `parentProjectId = template.id` must be `< template.maxTeams`; (2) `differentiationApproach` ≥ 30 characters; (3) the approach must pass the similarity check against sibling claims; (4) the whole check-and-insert runs inside a **Postgres advisory lock keyed on the template id** — this is what makes the capacity cap race-free |
| **Validation** | claiming team must not already hold a live claim on the same template |
| **Relationships** | `Project.parentProjectId`, `Project.teamId` |
| **Audit** | claim → `ProjectLogEvent` (`seq = 0`) + `AuditLog` |
| **Note** | `db_change.md` rejects both a `ProjectSetupJob` table (setup progress is derivable from whether `ProjectFeature`/`ProjectPhase` rows exist) and `@@unique([parentProjectId, teamId])` (the advisory lock already closes the race, and the constraint would block legitimate re-claim after withdrawal) |

### F5 — Proposal Submission & AI Evaluation

| | |
|---|---|
| **Tables** | `ProblemStatementProposal`, `ProposalScore`, `ProposalRubricScore`, `ProposalExtraction`, `ProposalExtractionItem`, `Project` (duplicate/publish targets) |
| **CRUD** | C: proposal → async score + extraction · R: own proposals; admin sees all · U: verdict transitions |
| **Business rules** | `verdict` is the job state machine: `PENDING → ACCEPTED \| REJECTED \| PENDING_ADMIN \| FAILED`, terminal states are final; `PENDING_ADMIN` means the AI abstained and a human must decide; publishing writes `publishedProjectId` and creates a template `Project` |
| **Validation** | `rawText` 100–5000 chars **[ASSUMPTION]**; rate-limited per user |
| **Relationships** | `submitterId`, `duplicateOfId`, `publishedProjectId` |
| **Audit** | verdict change → `AuditLog`; the AI model + prompt version should be recorded for reproducibility |
| **Privacy rule** | per-rubric scores are hidden from students — enforce at the API projection layer |

### F6 — Project Log (event sourcing)

| | |
|---|---|
| **Tables** | `ProjectLog`, `ProjectLogEvent`, `ProjectLogEventField`, and the 12 materialized-state children |
| **CRUD** | C: append an event, then apply it to the materialized children · R: current state in one query · **U/D on events: forbidden** |
| **Business rules** | every mutation is (1) append event with `seq = log.version + 1`, (2) apply to children, (3) `log.version++` — all in one transaction; `UNIQUE (logId, seq)` is the concurrency guard: two racing writers produce a unique violation, and the loser retries |
| **Validation** | `seq` strictly increasing with no gaps; `actorUserId` is a real user id or the `SYSTEM`/`AI` sentinel |
| **Relationships** | `ProjectLog ↔ Project` 1:1 |
| **Audit** | this **is** the audit log for lifecycle state; revoke UPDATE/DELETE at the database level |

### F7 — Execution Document Generation

| | |
|---|---|
| **Tables** | `ExecutionDocument` + 11 children; reads `Project`, `ProjectLog`, `ProjectMember`, `UserSkill` |
| **CRUD** | C: new version + children · R: current version · U: human edits should create a new version · D: never |
| **Business rules** | `version` increments per project; `markdown` is the download source of truth; `SUM(ExecutionDocTeamShare.sharePercent) = 100`; `SUM(ExecutionDocWorkPackage.percentage) = 100` |
| **Validation** | at least one objective, one deliverable, one milestone; `completionWeek ≤ project.suggestedDurationWeeks` |
| **Audit** | generation → `ProjectLogEvent`; record `modelUsed` and `promptVersion` |

### F8 — Daily Work Logging

| | |
|---|---|
| **Tables** | `DailyWorkLog`, `EvidenceUrl`, `RewardTransaction`, `UserStreak` (cache), `ProjectLogEvent` |
| **CRUD** | C/U: upsert on `(projectId, userId, date)` · R: own history, team history, workload rollup |
| **Business rules** | one log per user per project per day; back-dating beyond N days should be blocked **[ASSUMPTION: 7 days]**; a log credits reward points at most once (idempotency key on `RewardTransaction`) |
| **Validation** | `workDone` non-empty; `hoursSpent` 0–24; `date ≤ today` |
| **Relationships** | `DailyWorkLog → Project`, `→ User`; `EvidenceUrl` polymorphic (**G-1**) |
| **Audit** | edits to a past log must be recorded — an evaluation may already have cited it |

### F9 — Phase Execution & Review

| | |
|---|---|
| **Tables** | `ProjectPhase`, `PhaseSubmission`, `EvidenceUrl`, `RewardTransaction`, `User.rewardPoints`, `Notification`, `ProjectLogEvent` |
| **CRUD** | C: submission · U: phase status, review fields |
| **Business rules** | phases are sequential — phase N cannot be submitted before N-1 is `APPROVED` **[ASSUMPTION]**; only `ADMIN`/`FACULTY` review; approval credits `ProjectPhase.points` split by `ExecutionDocTeamShare`; `CHANGES_REQUESTED` allows a resubmission with `attemptNumber + 1` |
| **Status transitions** | `PLANNED → SUBMITTED → APPROVED` or `SUBMITTED → CHANGES_REQUESTED → SUBMITTED` |
| **Validation** | `submissionNote` non-empty; at least one evidence URL **[ASSUMPTION]**; reviewer ≠ submitter |
| **Audit** | **required** — points are awarded here; record reviewer, timestamp, and note |

### F10 — GitHub Sync & Commit Attribution

| | |
|---|---|
| **Tables** | `GithubRepository` + 7 children; `User.githubUsername` |
| **CRUD** | C/U: upsert repo by `(owner, repository)`, commits by `(repositoryId, sha)`, snapshot append-only · D: cascade when the project is deleted |
| **Business rules** | commits are immutable once stored; `linkedUserId` resolved by `authorLogin` → `authorEmail` → NULL (never guess); merge commits excluded from contribution counts; a snapshot is appended per sync, giving the trend series |
| **Validation** | `repoLink` parses to `owner/repository`; the repo must be reachable; a sync already in flight blocks a second one (`syncStatus`) |
| **Relationships** | the `linkedUserId` FK is the join that powers all per-student ranking |
| **Audit** | `lastSyncedAt`, `lastSyncError`, `syncStatus` on the repo row |

### F11 — AI Evaluation Cycle

| | |
|---|---|
| **Tables** | `EvaluationReport` + 4 children, `ProjectLogEvaluationRef`; reads `DailyWorkLog`, `GithubCommit`, `PhaseSubmission`, `ProjectLogWorkPackage`, `ExecutionDocument` |
| **CRUD** | C: report + children in one transaction · R: project members and staff · U: `mentorFeedback` only · D: never |
| **Business rules** | one report per `(projectId, cycle)`; the window is 15 days; a report generated without a working LLM sets `isFallback = true` and must be excluded from rankings; `EvaluationMemberScore` is computed from that member's logs and attributed commits within the window |
| **Validation** | `periodEnd > periodStart`; scores 0–100; every member of the project gets a score row |
| **Relationships** | `EvaluationMemberScore.userId` must be RESTRICT, not CASCADE (**§4.7**) |
| **Audit** | who triggered the run, model, prompt version — required to defend a disputed score |

### F12 — Overlap / Plagiarism Detection

| | |
|---|---|
| **Tables** | `ProjectOverlapFlag`, `ProjectOverlapMember`, `InsightsRun` **[NEW]** |
| **CRUD** | C: flag + member rows per cluster · R: admin triage list · U: `status`, `reviewNote`, `reviewedById` · D: never — dismissal is a status |
| **Business rules** | `clusterHash` is UNIQUE, making recompute idempotent; `SUPPRESSED` means "never show this cluster again"; `isFallback` flags must be visually distinguished from real detections |
| **Status transitions** | `OPEN → ACKNOWLEDGED \| DISMISSED \| SUPPRESSED` (terminal) |
| **Validation** | `similarityScore` 0–1; `confidence` 0–100; a flag needs ≥ 2 member projects |
| **Audit** | every triage decision records reviewer + timestamp + note — this is an academic-integrity record |

### F13 — Standout Detection & Opportunity Recommendation

| | |
|---|---|
| **Tables** | `StandoutProject`, `OpportunityRecommendation`, `OpportunityRecommendationItem`, `InsightsRun` **[NEW]** |
| **CRUD** | C/U: upsert one row per project · R: admin · U: triage status |
| **Business rules** | requires ≥ N evaluation cycles before a verdict (`cyclesEvaluated`); `trendDelta` is the slope across cycles; scores are cached rollups, refreshed by the pipeline, never hand-edited |
| **Validation** | `opportunityScore` and the three fit sub-scores 0–100 |
| **Audit** | recompute runs recorded in `InsightsRun` — today the status is in-memory only and lost on restart |

### F14 — Ranking & Rewards

| | |
|---|---|
| **Tables** | `RewardTransaction` (ledger), `User.rewardPoints` / `activityPoints` (materialized), `GroupRanking`, `UserSkill`, `AdminAchievement` |
| **CRUD** | C: ledger entries (append-only) · U: materialized totals and rankings |
| **Business rules** | the ledger is the truth and `User.rewardPoints` is its cached sum — they must be reconcilable by a periodic job; every credit carries `(source, sourceRefId)` for idempotency (**G-11**); rankings are recomputed on a schedule, not per request |
| **Validation** | `points > 0` for credits; a correction is a negative-points row, never an edit |
| **Audit** | the ledger *is* the audit trail; admin-granted achievements additionally write `AuditLog` |

### F15 — Teams & Collaboration

| | |
|---|---|
| **Tables** | `Team`, `TeamMember`, `TeamInvite`, `TeamCollaboration`, `TeamMessage`, `GroupRanking` |
| **CRUD** | full CRUD on teams and membership; invites and collaborations are status machines |
| **Business rules** | member count ≤ `maxMembers`; a team has at most one lead; `TeamInvite.type` distinguishes invite from join request; accepting a collaboration sets `Project.collaboratingTeamId`; a team cannot collaborate with itself |
| **Status transitions** | invite: `PENDING → ACCEPTED \| DECLINED \| EXPIRED`; collaboration: `PENDING → ACCEPTED \| DECLINED` |
| **Validation** | `groupCode` UNIQUE; `color` is a hex string |
| **Audit** | membership changes → `AuditLog` (they affect project ownership and points) |

### F16 — Tasks (Kanban + Gantt)

| | |
|---|---|
| **Tables** | `Task`, `Subtask`, `ProjectLabel`/`TaskLabel` **[CHANGE]**, `Comment`, `Board`, `BoardColumn`, `Sprint`, `Milestone` |
| **CRUD** | full CRUD; delete should become soft delete |
| **Business rules** | **one canonical status vocabulary across all writers** — the documented root cause of tasks disappearing from Kanban; `completedAt` set exactly when status becomes `DONE`, cleared when it moves back; `progress = 100` implies `DONE` |
| **Validation** | `dueDate ≥ startDate`; `progress` 0–100; assignee must be a project member |
| **Audit** | status changes feed the Dashboard "recent activity" merge |

### F17 — Notifications

| | |
|---|---|
| **Tables** | `Notification`, `NotificationPreference` **[NEW]** |
| **CRUD** | C: system-generated and broadcast · R: own · U: `readAt` · D: **[NEW]** purge older than 90 days |
| **Business rules** | broadcasts fan out one row per recipient (so read state is per-user); preferences gate delivery per channel |
| **Validation** | broadcast is ADMIN-only |
| **Audit** | broadcasts → `AuditLog` |

### F18 — File Upload & Storage

| | |
|---|---|
| **Tables** | `StoredFile` **[NEW]**, `FileLink` **[NEW]** (replacing the orphaned `FileAsset`) |
| **CRUD** | C: on upload · R: authorized viewers only · U: metadata · D: soft delete, then a reclaim job |
| **Business rules** | **every uploaded byte must have a database row** — today it does not; visibility is `PRIVATE` by default; a private file is served via a signed, expiring URL |
| **Validation** | MIME allow-list; ≤ 10 MB (the current multer limit); filename sanitised |
| **Audit** | upload, download and delete of evidence files → `AuditLog` |

---

## 7. User-wise Access and CRUD Permissions

Enforced today by `middleware/requireRole.ts` (role check) and
`requireProjectAccess` (membership check on the lifecycle routes).
Legend: **C**reate **R**ead **U**pdate **D**elete/archive · *own* = row-level ownership required.

### 7.1 STUDENT

**Pages**: `/dashboard`, `/projects`, `/projects/catalog`, `/projects/propose`,
`/projects/proposals`, `/projects/:id` (member only), `/projects/:id/execution-doc`, `/kanban`,
`/timeline`, `/teams`, `/teams/:id`, `/teams/:id/members`, `/teams/:id/collaborate`, `/files`,
`/analytics` (own scope), `/notifications`, `/settings`, `/profile`.
**Blocked**: everything under `/admin/*`.

| Table | C | R | U | D | Ownership rule |
|---|:-:|:-:|:-:|:-:|---|
| `User` | — | ✔ | ✔ | — | read others' public profile; update **own row only**; may never change `role`, `rewardPoints`, `organizationId` |
| `ProblemStatementProposal` | ✔ | ✔ | — | — | read `submitterId = self`; verdict is written by the system, never the student |
| `ProposalScore` / `ProposalRubricScore` | — | partial | — | — | per-rubric detail is **hidden from students by design** |
| `Project` (instance) | ✔ | ✔ | ✔ | archive | create via catalog claim; update/withdraw only if member |
| `Project` (template) | — | ✔ | — | — | catalog is read-only |
| `ProjectMember` | ✔ | ✔ | — | ✔ | add/remove within own project (**[ASSUMPTION]** lead-only) |
| `ProjectFeature` | ✔ | ✔ | ✔ | soft | own project |
| `ProjectPhase` | — | ✔ | ✔ | — | own project; may set `SUBMITTED`, never `APPROVED` |
| `PhaseSubmission` | ✔ | ✔ | — | — | `submittedById = self`; **may not review** |
| `DailyWorkLog` | ✔ | ✔ | ✔ | — | own row only, own project, today's date |
| `EvidenceUrl` | ✔ | ✔ | ✔ | ✔ | owner of the parent log/submission |
| `ExecutionDocument` + children | ✔ | ✔ | ✔ | — | own project |
| `ProjectLog*` (all 13) | indirect | ✔ | indirect | — | mutations go through lifecycle endpoints, never direct writes |
| `Task` / `Subtask` / `Comment` / `Label` | ✔ | ✔ | ✔ | ✔ | own project; comments editable only by author |
| `Team` | ✔ | ✔ | ✔ | — | update if lead |
| `TeamMember` | — | ✔ | — | ✔ | may remove self; **adding is ADMIN-only** |
| `TeamInvite` | ✔ | ✔ | ✔ | — | create for own team; accept/decline own |
| `TeamCollaboration` | ✔ | ✔ | ✔ | — | own team on either side |
| `TeamMessage` | ✔ | ✔ | ✔ | soft | own team; edit/delete own message |
| `EvaluationReport` + children | — | ✔ | — | — | own project only; **cannot trigger a run** |
| `GithubRepository` + children | — | ✔ | trigger | — | may trigger a refresh for own project |
| `Notification` | — | ✔ | ✔ | — | own; `readAt` only |
| `RewardTransaction` | — | ✔ | — | — | own ledger, read-only |
| `UserSkill` / `UserStreak` | — | ✔ | — | — | derived |
| `StoredFile` / `FileLink` | ✔ | ✔ | — | soft | own uploads, or files linked to own project |
| `ProjectOverlapFlag` / `StandoutProject` / `OpportunityRecommendation` | — | — | — | — | **no access** — admin triage surface |
| `AuditLog` / `ActivityLog` / `LoginHistory` / `ErrorLog` | — | — | — | — | none |
| `Role` / `Permission` / `RolePermission` / `UserRole` | — | — | — | — | none |

### 7.2 FACULTY

**Pages**: everything a student can see (read-only on execution surfaces) plus the review
controls in the Project Workspace. **[ASSUMPTION]** Faculty may read all projects in their
organization — there is no faculty↔project assignment table (**G-7**), so scoping is currently
org-wide.

| Table | C | R | U | D | Rule |
|---|:-:|:-:|:-:|:-:|---|
| `PhaseSubmission` | — | ✔ | ✔ | — | **review only**: `status`, `reviewNote`, `reviewedAt`, `reviewedById`; reviewer ≠ submitter |
| `ProjectPhase` | — | ✔ | ✔ | — | set `APPROVED` / `CHANGES_REQUESTED` |
| `ProjectReview` | ✔ | ✔ | ✔ | — | own reviews |
| `EvaluationReport` | — | ✔ | ✔ | — | may add `mentorFeedback`; **may not trigger a run** (ADMIN-only route) |
| `RewardTransaction` | indirect | ✔ | — | — | created as a side effect of approval |
| `Project` / `ProjectMember` / `Task` / `DailyWorkLog` / `ExecutionDocument` / `ProjectLog*` | — | ✔ | — | — | read-only across the org |
| `Notification` | ✔ | ✔ | ✔ | — | may notify students on their projects |
| `User` | — | ✔ | own | — | own profile only |
| `ProjectOverlapFlag` / `StandoutProject` | — | ✔ | — | — | **[ASSUMPTION]** read-only; triage stays with ADMIN |
| Admin tables, RBAC, logs | — | — | — | — | none |

### 7.3 ADMIN

**Pages**: all student and faculty pages, plus `/admin/top-teams`, `/admin/top-students`,
`/admin/overlaps`, `/admin/standouts`, `/admin/upload`.

| Table | C | R | U | D | Rule |
|---|:-:|:-:|:-:|:-:|---|
| `User` | ✔ | ✔ | ✔ | archive | including `role` changes — the one path to elevation |
| `Organization` | ✔ | ✔ | ✔ | — | |
| `Team` / `TeamMember` | ✔ | ✔ | ✔ | ✔ | `POST /teams/:id/members` is ADMIN-gated in the router |
| `Project` (template) | ✔ | ✔ | ✔ | archive | catalog authoring and publishing |
| `Project` (instance) | ✔ | ✔ | ✔ | archive | org-wide |
| `ProblemStatementProposal` | — | ✔ | ✔ | — | resolve `PENDING_ADMIN`, publish to catalog |
| `EvaluationReport` + children | ✔ | ✔ | ✔ | — | **only role that may run an evaluation** |
| `ProjectOverlapFlag` / `StandoutProject` / `OpportunityRecommendation` | via pipeline | ✔ | ✔ | — | triage: `status`, `reviewNote`; may trigger recompute |
| `AdminAchievement` | ✔ | ✔ | ✔ | ✔ | bulk upload supported |
| `RewardTransaction` | ✔ | ✔ | — | — | manual grants; corrections as negative rows, never edits |
| `Hackathon` / `LeetCodeContest` | ✔ | ✔ | ✔ | ✔ | |
| `GroupRanking` | recompute | ✔ | recompute | — | derived |
| `GithubRepository` + children | ✔ | ✔ | ✔ | ✔ | college-wide analytics is ADMIN-only |
| `BulkUploadBatch` / `BulkUploadRow` | ✔ | ✔ | — | — | |
| `StoredFile` / `FileLink` | ✔ | ✔ | ✔ | ✔ | org-wide |
| `Role` / `Permission` / `RolePermission` / `UserRole` | ✔ | ✔ | ✔ | ✔ | RBAC administration |
| `AuditLog` / `ActivityLog` / `LoginHistory` / `ErrorLog` | — | ✔ | — | — | **read-only for everyone, including admins** — an editable audit log is not an audit log |
| `ProjectLogEvent` | — | ✔ | — | — | append-only; not editable by anyone |

### 7.4 SYSTEM / AI (non-human principal)

Writes `ProjectLogEvent` (`actorUserId = "SYSTEM"` / `"AI"`), `EvaluationReport` + children,
`ProjectOverlapFlag`, `StandoutProject`, `OpportunityRecommendation`, `ProposalScore`,
`ProposalExtraction`, `ProjectFeature` (`addedBy = "AI"`), `ExecutionDocument` + children,
`GithubRepository` + children, `InsightsRun`, `Notification`.
Never writes: `User`, `RewardTransaction` (except via an approval path), `AuditLog`.

### 7.5 Cross-cutting ownership rules

1. **Row-level scoping is mandatory on every list endpoint.** The Dashboard bug in
   `db_change.md` — `projectsActive` counting org-wide instead of the user's projects — is
   exactly this class of defect. `/timeline` is a global route and carries the same risk.
2. **A student can only write their own `DailyWorkLog`**, for a project they are a member of.
3. **Reviewer ≠ submitter** on every review path.
4. **`role` elevation only through `PATCH /admin/users/:userId/role`**, always audited.
5. **Nothing is hard-deleted** on the student surface — withdraw, archive, or soft-delete.
6. **Rubric-level proposal scores are never returned to students**, at the API layer.

---

## 8. Storage Design

### 8.1 Current state and why it must change

- `POST /lifecycle/upload-asset` (multer, 10 MB memory limit) writes bytes to
  `server/uploads/assets/asset-<timestamp>-<name>` and returns `/uploads/assets/<file>` —
  **no database row is created**.
- `FileAsset` exists in the schema but has **no writer anywhere in the server**; only seed
  cleanup references it.
- Cloudinary is configured in `infrastructure/storage/cloudinary.ts` but is **never called**.
- Consequences: files have no owner, no access control (the path is publicly served), no link
  to the project or submission they belong to, no delete path, and no way to reclaim storage.
  Evidence files — the platform's integrity backbone — are the least protected asset it has.

### 8.2 What must be stored

| Asset | Produced by | Sensitivity |
|---|---|---|
| Execution document export (MD/PDF) | `GET /lifecycle/:projectId/document/download` | project-private |
| Phase submission evidence (screenshots, demo video, report) | Submit Phase modal | project-private |
| Daily log evidence attachments | Daily Log tab | project-private |
| Project review report | `ProjectReview.reportUrl` | staff + project |
| Bulk-upload source spreadsheets | `/admin/upload` | **admin-only, contains PII** |
| Rich-content images inside execution docs | `upload-asset` | project-private |
| User avatars | Profile | public within org |
| Team logos / banners | Team settings | public within org |
| Generated analytics/report exports | `Report` | project or admin |

### 8.3 Bucket / folder layout

Provider-agnostic (works for S3, Cloudinary, or local disk). **[ASSUMPTION]** on exact naming.

```
projectverse/
├── public/
│   ├── avatars/{userId}/{fileId}.{ext}
│   └── teams/{teamId}/{fileId}.{ext}
└── private/
    ├── projects/{projectId}/
    │   ├── execution-docs/{documentId}/{fileId}.{ext}
    │   ├── phase-evidence/{phaseId}/{submissionId}/{fileId}.{ext}
    │   ├── daily-log-evidence/{logId}/{fileId}.{ext}
    │   ├── assets/{fileId}.{ext}
    │   └── reports/{fileId}.{ext}
    └── admin/
        └── bulk-uploads/{batchId}/{fileId}.{ext}
```

Rules: the path is derived from `StoredFile` columns, never from the user-supplied filename;
the stored object name is always `{fileId}.{ext}` so a malicious filename cannot traverse or
collide; the original name is kept only as metadata.

### 8.4 `StoredFile` **[NEW]** — the file metadata table

| Column | Type | Req | Default | Notes |
|---|---|---|---|---|
| `id` | `TEXT` (cuid) | ! | `cuid()` | PK; also the object name |
| `organizationId` | `TEXT` | ! | — | FK → `Organization`; tenant scoping |
| `uploadedById` | `TEXT` | ! | — | FK → `User`, RESTRICT |
| `bucket` | `StorageBucket` | ! | `PRIVATE` | `PUBLIC \| PRIVATE \| ADMIN` |
| `storageKey` | `TEXT` | ! | — | full provider path; UNIQUE |
| `provider` | `StorageProvider` | ! | `LOCAL` | `LOCAL \| S3 \| CLOUDINARY` |
| `originalName` | `TEXT` | ! | — | as uploaded, display only |
| `mimeType` | `TEXT` | ! | — | validated against an allow-list |
| `sizeBytes` | `BIGINT` | ! | — | ≤ 10 MB today |
| `checksumSha256` | `TEXT` | ? | — | dedupe + tamper detection on evidence |
| `visibility` | `FileVisibility` | ! | `PRIVATE` | `PUBLIC \| ORG \| PROJECT \| PRIVATE` |
| `purpose` | `FilePurpose` | ! | — | `AVATAR \| TEAM_LOGO \| EXECUTION_DOC \| PHASE_EVIDENCE \| DAILY_LOG_EVIDENCE \| PROJECT_ASSET \| REVIEW_REPORT \| BULK_UPLOAD \| REPORT_EXPORT` |
| `scanStatus` | `ScanStatus` | ! | `PENDING` | `PENDING \| CLEAN \| INFECTED \| SKIPPED` — a file is not servable until `CLEAN` |
| `downloadCount` | `INTEGER` | ! | `0` | |
| `createdAt` | `TIMESTAMPTZ` | ! | `now()` | |
| `deletedAt` | `TIMESTAMPTZ` | ? | — | soft delete; a reclaim job removes bytes after 30 days |
| `purgedAt` | `TIMESTAMPTZ` | ? | — | set when the bytes are actually gone |

Indexes: `(organizationId, purpose)`, `(uploadedById)`, `(deletedAt) WHERE deletedAt IS NOT NULL`,
UNIQUE `(storageKey)`, UNIQUE `(checksumSha256, organizationId) WHERE checksumSha256 IS NOT NULL`
(optional dedupe).

### 8.5 `FileLink` **[NEW]** — file ↔ record relation

A single file can be attached to more than one record (a demo video cited by both a daily log
and a phase submission), so the relation is many-to-many through a link table rather than a
column on each parent.

| Column | Type | Req | Notes |
|---|---|---|---|
| `id` | `TEXT` | ! | PK |
| `fileId` | `TEXT` | ! | FK → `StoredFile`, CASCADE |
| `entityType` | `FileEntityType` | ! | `PROJECT \| PHASE_SUBMISSION \| DAILY_WORK_LOG \| EXECUTION_DOCUMENT \| PROJECT_REVIEW \| USER \| TEAM \| BULK_UPLOAD_BATCH \| REPORT` |
| `entityId` | `TEXT` | ! | id of that record |
| `role` | `TEXT` | ? | e.g. `"cover"`, `"evidence"`, `"export"` |
| `createdAt` | `TIMESTAMPTZ` | ! | |

UNIQUE `(fileId, entityType, entityId)`; index `(entityType, entityId)`.

**Why polymorphic here but not for `EvidenceUrl`**: a file may attach to any of nine entity
types, so nine link tables would be worse than one. `EvidenceUrl` has exactly two owners, and
those two are the platform's integrity records — there, real FKs are worth the duplication.
The polymorphic link is acceptable because deleting a parent deletes its links through
application code *and* the orphan is harmless: an unlinked `StoredFile` is caught by the reclaim
job, whereas an orphaned `EvidenceUrl` silently misrepresents a student's evidence.

### 8.6 Access rules

| Visibility | Who may read | How served |
|---|---|---|
| `PUBLIC` | anyone | CDN URL, long cache |
| `ORG` | any authenticated user in the same organization | signed URL, 1 h |
| `PROJECT` | `ProjectMember` of the linked project, plus FACULTY/ADMIN | signed URL, 15 min |
| `PRIVATE` | `uploadedById` only, plus ADMIN | signed URL, 15 min |

Rules: **no private file is ever served from a static path** (today's `/uploads/assets/*` is);
every download is authorized against `FileLink` → parent → membership; every evidence download
by staff is written to `AuditLog`; `ADMIN` bucket files (bulk-upload spreadsheets containing
student PII) are never signed for non-admins.

### 8.7 Delete / archive behaviour

| Event | File behaviour |
|---|---|
| Project withdrawn | files kept; `FileLink` retained — evidence must survive withdrawal |
| Project hard-deleted (admin) | `StoredFile.deletedAt` set on all linked files; bytes reclaimed after 30 days |
| Daily log deleted | its evidence files soft-deleted if no other link remains |
| Phase submission superseded | previous attempt's files **retained** — they are the record of what was reviewed |
| User archived | files retained; ownership reassigned to the organization |
| Execution doc new version | previous version's export retained (versions are immutable) |
| Bulk upload batch older than retention window | spreadsheet purged (PII), batch and row records kept |

A nightly job purges `StoredFile WHERE deletedAt < now() - 30 days`, and separately flags
`StoredFile` rows with zero `FileLink` rows older than 24 hours as abandoned uploads.

---

## 9. Authentication and Authorization Tables

### 9.1 Current state

- JWT only. `config/jwt.ts` exposes `signAccessToken` and `signRefreshToken`;
  `modules/auth/token.service.ts` issues both. **Neither is stored**, so a refresh token cannot
  be revoked and a stolen one is valid until expiry.
- `refreshSchema` exists in `auth.schemas.ts` but there is **no `/refresh` route** in
  `auth.routes.ts` — the refresh flow is half-built.
- Authorization is a single enum check (`middleware/requireRole.ts` against `User.role`) plus
  `requireProjectAccess` for membership.
- `Role` and `Permission` tables exist, are org-scoped, and are **connected to nothing**.
- `middleware/internalAuth.ts` authenticates service traffic by HMAC over
  `userId.role.timestamp` with a shared secret — no table backs it, and there is no per-client
  key rotation.

### 9.2 Table set

#### `User` — see §2.1. The authoritative principal.

#### `RefreshToken` **[NEW]**
| Column | Type | Req | Notes |
|---|---|---|---|
| `id` | `TEXT` | ! | PK |
| `userId` | `TEXT` | ! | FK → `User`, CASCADE |
| `tokenHash` | `TEXT` | ! | SHA-256 of the token — **never store the token itself** |
| `familyId` | `TEXT` | ! | rotation family; reuse of a rotated token revokes the whole family |
| `issuedAt` | `TIMESTAMPTZ` | ! | |
| `expiresAt` | `TIMESTAMPTZ` | ! | |
| `revokedAt` | `TIMESTAMPTZ` | ? | |
| `replacedById` | `TEXT` | ? | self-FK, rotation chain |
| `userAgent` / `ipAddress` | `TEXT` / `INET` | ? | shown on a "your sessions" screen |

UNIQUE `(tokenHash)`; index `(userId, revokedAt)`, `(expiresAt)`.

#### `PasswordResetToken` **[NEW]**
`id` PK, `userId!` FK CASCADE, `tokenHash!` UNIQUE, `expiresAt!`, `usedAt?`, `createdAt!`,
`requestedIp INET?`. Single-use; index `(userId, usedAt)`.
Also covers the `mustChangePassword` first-login flow.

#### `Role` (existing, to be completed)
`id` PK, `organizationId!`, `name!`. **[NEW]** `key TEXT!` (stable machine name),
`description?`, `isSystem BOOLEAN! default false` (system roles cannot be deleted),
UNIQUE `(organizationId, key)`.

#### `Permission` (existing, to be completed)
`id` PK, `organizationId!`, `key!`, `description?`.
**[NEW]** `resource TEXT!` + `action TEXT!` so a permission is a real `(resource, action)` pair
(`project:create`, `evaluation:run`, `overlap:triage`), UNIQUE `(organizationId, key)`.

#### `RolePermission` **[NEW]**
Composite PK `(roleId, permissionId)`, both FKs CASCADE. Pure M:N join.

#### `UserRole` **[NEW]**
Composite PK `(userId, roleId)`; `assignedById?`, `assignedAt!`, `expiresAt?`.
Allows a student to hold a temporary `TEAM_LEAD` or `REVIEWER` role without changing
`User.role`.

**Migration note**: keep `User.role` as the fast-path enum that middleware reads (it is on every
request), and treat `UserRole` as additive grants. Removing `User.role` would touch every route
guard for no immediate benefit.

### 9.3 Project- and team-level access

There is no separate ACL table; scope comes from membership:

| Scope | Table that grants it | Checked by |
|---|---|---|
| Organization | `User.organizationId` | every scoped query |
| Team | `TeamMember (teamId, userId)` | team routes |
| Project | `ProjectMember (projectId, userId)` | `requireProjectAccess` |
| Cross-team project | `Project.collaboratingTeamId` | project routes |
| Faculty→project | **missing (G-7)** | — |

**Recommendation for G-7**: add `ProjectMember` rows with `role = MENTOR` rather than a new
table. It reuses `requireProjectAccess` unchanged, gives faculty a "my projects" list, and
makes the mentor relationship auditable.

#### `InternalApiClient` **[NEW, ASSUMPTION]**
`id` PK, `name!`, `keyHash!` UNIQUE, `role!`, `isActive BOOLEAN! default true`,
`lastUsedAt?`, `createdAt!`, `revokedAt?`.
Replaces the single shared `INTERNAL_SECRET` in `internalAuth.ts` so that a compromised
automation client can be revoked individually and its calls attributed.

---

## 10. Audit, Logs, and History

### 10.1 What exists, honestly assessed

| Table | State |
|---|---|
| `ActivityLog` | **has no writer** — `docs/db_change.md` records that the Dashboard's activity feed always returned `[]` and was rewritten to merge `Task` and `PhaseSubmission` instead |
| `AuditLog` | exists; `details` is unstructured free text; coverage is unclear |
| `ProjectLogEvent` | the one genuinely working audit trail — append-only, sequenced, actor-stamped |
| `GithubSnapshot` | a real metric time series |
| `ProjectLogDurationHistory`, `ProjectLogMilestoneHistory` | real field-level history for the two fields that matter most |

### 10.2 Proposed log tables

#### `ActivityLog` (fix, don't replace)
`id` PK, `userId!`, `action!`, `entityType!`, `entityId!`, `createdAt!`.
**[NEW]** `organizationId!`, `projectId?`, `metadata JSONB?`, `visibility ActivityVisibility!`
(`PUBLIC|TEAM|PRIVATE`).
Indexes `(userId, createdAt DESC)`, `(projectId, createdAt DESC)`, `(entityType, entityId)`.
**Write it from one place** — a Prisma middleware hook on the mutations that matter — or delete
the table. A permanently empty audit table is a liability.

#### `AuditLog` (extend)
`id` PK, `userId!` (nullable for SYSTEM), `organizationId!`, `action!`, `entityType!`,
`entityId!`, `before JSONB?`, `after JSONB?`, `details?`, `ipAddress INET?`, `userAgent?`,
`createdAt!`.
Indexes `(organizationId, createdAt DESC)`, `(entityType, entityId, createdAt DESC)`,
`(userId, createdAt DESC)`.
**Must cover**: role changes, bulk imports, project claim/withdraw, phase approvals, reward
grants, evaluation runs, overlap/standout triage, catalog publishing, file deletion, permission
changes.

#### `EntityChangeHistory` **[NEW]** — field-level change history
`id` PK, `entityType!`, `entityId!`, `fieldName!`, `oldValue TEXT?`, `newValue TEXT?`,
`changedById?`, `changeSource ActorSource!` (`USER|AI|SYSTEM|IMPORT`), `changedAt!`.
Index `(entityType, entityId, changedAt DESC)`.
Apply selectively — to `Project.status`, `ProjectPhase.status`, `Task.status`,
`User.role`, `EvaluationReport.overallScore`, `ProblemStatementProposal.verdict` — not to
every column, or it will outgrow the rest of the database.

#### `LoginHistory` **[NEW]**
`id` PK, `userId?` (null on unknown-email attempts), `email!`, `success BOOLEAN!`,
`failureReason?`, `ipAddress INET?`, `userAgent?`, `createdAt!`.
Index `(userId, createdAt DESC)`, `(email, createdAt DESC)`, `(ipAddress, createdAt DESC)`.
Enables lockout after N failures and gives students a "recent sign-ins" view.

#### `ErrorLog` **[NEW]**
`id` PK, `level ErrorLevel!` (`WARN|ERROR|FATAL`), `source!` (module name), `message!`,
`stack TEXT?`, `context JSONB?`, `userId?`, `requestId?`, `createdAt!`.
Index `(level, createdAt DESC)`, `(source, createdAt DESC)`.
**Particularly needed for the AI paths**: `askMentor` currently swallows every error and returns
a 200 with a cheerful fallback string, so LLM failures are invisible in production.

#### `BulkUploadBatch` **[NEW]** / `BulkUploadRow` **[NEW]**
- Batch: `id` PK, `organizationId!`, `uploadedById!`, `kind BulkUploadKind!`
  (`STUDENTS|TEAMS|ACHIEVEMENTS`), `fileId!` FK → `StoredFile`, `status JobStatus!`,
  `totalRows INT!`, `successRows INT!`, `failedRows INT!`, `startedAt!`, `finishedAt?`,
  `errorSummary?`.
- Row: `id` PK, `batchId!` CASCADE, `rowNumber INT!`, `rawData JSONB!`,
  `status RowStatus!` (`CREATED|UPDATED|SKIPPED|FAILED`), `entityType?`, `entityId?`,
  `errorMessage?`. UNIQUE `(batchId, rowNumber)`.
- **Why**: an admin upload can create hundreds of users with no record of who did it or what the
  source file said. This is the provenance trail for the platform's most privileged operation.

#### `InsightsRun` **[NEW]** — see §2.9.

#### `MentorConversation` / `MentorMessage` **[NEW, ASSUMPTION]**
- Conversation: `id` PK, `projectId!` CASCADE, `startedById!`, `createdAt!`.
- Message: `id` PK, `conversationId!` CASCADE, `role MessageRole!` (`USER|ASSISTANT`),
  `content!`, `modelUsed?`, `tokensUsed?`, `createdAt!`.
- **Why**: `POST /lifecycle/:projectId/mentor/ask` returns an answer and discards it. Without
  persistence there is no conversation continuity, no cost attribution, no way to evaluate
  mentor quality, and no record if the AI gives bad guidance a student then acts on.

### 10.3 Retention

| Table | Retention | Reason |
|---|---|---|
| `AuditLog` | 7 years | academic record |
| `ProjectLogEvent` | forever | the lifecycle record itself |
| `EntityChangeHistory` | 2 years | |
| `LoginHistory` | 1 year | security investigation window |
| `ErrorLog` | 90 days | operational |
| `ActivityLog` | 1 year | feed data |
| `Notification` | 90 days after read | ephemeral |
| `GithubSnapshot` | forever (downsample >1 year to weekly) | trend analysis |
| `AdminChatHistory` | 1 year | |
| `BulkUploadRow` | 2 years; source file purged sooner | contains PII |

---

## 11. Final Database Schema

Column-level detail is in §2. This section is the **constraint contract**: primary key, foreign
keys, unique constraints, indexes, enums, and check constraints per table.
`[E]` marks a column that becomes an enum; `[N]` marks a nullable column worth calling out.

### 11.1 Enum catalog (3 existing + 17 proposed = 20)

```
-- existing
RoleType              = ADMIN | STUDENT | FACULTY
ProjectCategory       = MINI | FINAL_YEAR | RESEARCH
EvaluationFindingKind = MISSING_WORK | SUSPICIOUS | RECOMMENDATION

-- proposed [NEW]
UserStatus         = ACTIVE | SUSPENDED | ALUMNI
AcademicYear       = I | II | III | IV
SkillType          = PRIMARY | SECONDARY | SPECIALIZATION
TeamStatus         = ACTIVE | ARCHIVED | DISBANDED
InviteType         = INVITE | JOIN_REQUEST
InviteStatus       = PENDING | ACCEPTED | DECLINED | EXPIRED
CollaborationStatus= PENDING | ACCEPTED | DECLINED
ProjectStatus      = PLANNED | ACTIVE | SUBMITTED | COMPLETED | WITHDRAWN | ARCHIVED
ProjectMemberRole  = LEAD | MEMBER | MENTOR | REVIEWER
TaskStatus         = TODO | IN_PROGRESS | IN_REVIEW | DONE
TaskPriority       = LOW | MEDIUM | HIGH | URGENT
ProposalVerdict    = PENDING | ACCEPTED | REJECTED | PENDING_ADMIN | FAILED
PhaseStatus        = PLANNED | SUBMITTED | APPROVED | CHANGES_REQUESTED
SubmissionStatus   = PENDING | APPROVED | CHANGES_REQUESTED
TriageStatus       = OPEN | ACKNOWLEDGED | DISMISSED | SUPPRESSED
RiskLevel          = LOW | MEDIUM | HIGH
ActorSource        = USER | AI | SYSTEM | IMPORT

-- supporting proposed enums
WorkPackageStatus  = NOT_STARTED | IN_PROGRESS | DONE
LogMilestoneStatus = PENDING | DONE | MISSED
FlagType           = DELAY | INACTIVE_MEMBER | MISSING_DEPENDENCY | OVERLOAD | TIMELINE_RISK | TECH_DRIFT
OverlapSeverity    = PARTIAL_OVERLAP | SUBSTANTIAL_OVERLAP | NEAR_DUPLICATE
StandoutVerdict    = NOT_YET | PROMISING | STARTUP_WORTHY
Importance         = HIGH | MEDIUM | LOW
RubricFamily       = RUBRIC | INDUSTRY | PERSPECTIVE
ExtractionItemKind = OBJECTIVE | DELIVERABLE | TECH | CONSTRAINT
ProjectTypeKind    = SOFTWARE | HARDWARE | IOT
RewardSource       = PHASE_APPROVAL | DAILY_LOG | ADMIN_ACHIEVEMENT | MANUAL_GRANT | CORRECTION
OpportunityType    = HACKATHON | CONFERENCE | GRANT | INCUBATOR | COMPETITION
JobStatus          = QUEUED | RUNNING | SUCCESS | FAILED
SyncStatus         = IDLE | SYNCING | OK | ERROR
StorageBucket      = PUBLIC | PRIVATE | ADMIN
StorageProvider    = LOCAL | S3 | CLOUDINARY
FileVisibility     = PUBLIC | ORG | PROJECT | PRIVATE
FilePurpose        = AVATAR | TEAM_LOGO | EXECUTION_DOC | PHASE_EVIDENCE | DAILY_LOG_EVIDENCE | PROJECT_ASSET | REVIEW_REPORT | BULK_UPLOAD | REPORT_EXPORT
FileEntityType     = PROJECT | PHASE_SUBMISSION | DAILY_WORK_LOG | EXECUTION_DOCUMENT | PROJECT_REVIEW | USER | TEAM | BULK_UPLOAD_BATCH | REPORT
ScanStatus         = PENDING | CLEAN | INFECTED | SKIPPED
NotificationType   = DEADLINE | EVALUATION | TEAM_INVITE | PHASE_REVIEW | PROPOSAL_VERDICT | BROADCAST | MENTION
ErrorLevel         = WARN | ERROR | FATAL
BulkUploadKind     = STUDENTS | TEAMS | ACHIEVEMENTS
RowStatus          = CREATED | UPDATED | SKIPPED | FAILED
InsightKind        = OVERLAP | STANDOUT | OPPORTUNITY | ALL
```

### 11.2 Identity & team

| Table | PK | FKs | Unique | Indexes | Checks / nullable |
|---|---|---|---|---|---|
| `Organization` | `id` | — | `slug` | — | — |
| `User` | `id` | `organizationId`→Org RESTRICT, `teamId`→Team SET NULL | `email`, `regNo`, **`githubUsername`** | `(organizationId, role)`, `(teamId)`, `(deletedAt)`, `(email) lower()` | `rewardPoints ≥ 0`, `activityPoints ≥ 0`; `[N]` regNo, teamId, all profile fields |
| `Team` | `id` | `organizationId` RESTRICT, `leadId`→User SET NULL | `groupCode` | `(organizationId, status)`, `(domain)`, `(leadId)` | `maxMembers BETWEEN 1 AND 20`; `[N]` leadId, domain |
| `TeamMember` | `id` | `teamId` CASCADE, `userId` RESTRICT | `(teamId, userId)` | `(userId)`, `(teamId, isActive)` | — |
| `TeamInvite` | `id` | `teamId` CASCADE, `userId` SET NULL, `invitedBy` SET NULL | — | `(teamId, status)`, `(email, status)`, `(userId, status)` | `[E]` type, status; `[N]` userId |
| `TeamCollaboration` | `id` | `fromTeamId` CASCADE, `toTeamId` CASCADE | partial `(fromTeamId,toTeamId) WHERE status='PENDING'` | `(toTeamId, status)`, `(fromTeamId, status)` | `fromTeamId <> toTeamId` |
| `TeamMessage` | `id` | `teamId` CASCADE, `userId` RESTRICT | — | `(teamId, createdAt DESC)` | `[N]` deletedAt |
| `UserSkill` | `id` | `userId` CASCADE | `(userId, skillName)` | `(skillName, totalPoints DESC)` | `totalPoints ≥ 0` |
| `UserProfileLink` **[NEW]** | `id` | `userId` CASCADE | `(userId, platform)` | — | — |

### 11.3 Project & catalog

| Table | PK | FKs | Unique | Indexes | Checks |
|---|---|---|---|---|---|
| `Project` | `id` | `organizationId` RESTRICT, `teamId` SET NULL, `collaboratingTeamId` SET NULL, `parentProjectId` RESTRICT | `problemId` | **`(parentProjectId)` (G-9)**, **`(isTemplate, status)`**, `(organizationId, status)`, `(teamId)`, `(domain, sector)`, `(category)`, GIN `(technologies)`, GIN `(differentiationKeywords)`, GIN tsvector `(name, description, problemStatement)` | `maxTeams ≥ 1`; `suggestedDurationWeeks BETWEEN 1 AND 52`; `budgetEstimateInr ≥ 0`; `isTemplate = true ⇒ parentProjectId IS NULL`; `parentProjectId <> id` |
| `ProjectUseCase` / `ProjectDeliverable` | `id` | `projectId` CASCADE | — | `(projectId, order)` | `order ≥ 0` |
| `ProjectExpectedMetric` | `id` | `projectId` CASCADE | — | `(projectId)` | — |
| `ProjectCatalogPhase` | `id` | `projectId` CASCADE | — | `(projectId, week)` | `week ≥ 1` |
| `ProjectTypeSpecific` | `id` | `projectId` CASCADE | `projectId` | — | `[E]` kind |
| `ProjectMember` | `id` | `projectId` CASCADE, `userId` RESTRICT | `(projectId, userId)` | `(userId)`, `(projectId, isActive)` | `[E]` role → `ProjectMemberRole`; `allocationPercent BETWEEN 0 AND 100` |
| `ProjectReview` | `id` | `projectId` CASCADE, `reviewerId` RESTRICT, `reportFileId` SET NULL | — | `(projectId, createdAt DESC)`, `(reviewerId)` | `[E]` status |
| `ProjectFeature` | `id` | `projectId` CASCADE, `addedByUserId` SET NULL | — | `(projectId, status)` | `points ≥ 0`; `[E]` importance, addedBySource |
| `ProjectPhase` | `id` | `projectId` CASCADE | `(projectId, phaseNumber)` | `(projectId, status)`, `(targetDate)` | `phaseNumber ≥ 1`; `weekTarget ≥ 1`; `points ≥ 0` |
| `PhaseSubmission` | `id` | `phaseId` CASCADE, `projectId` CASCADE, `submittedById` RESTRICT, `reviewedById` SET NULL | `(phaseId, attemptNumber)` | `(phaseId, status)`, `(submittedById, createdAt DESC)`, `(status) WHERE status='PENDING'` | `status='PENDING' OR reviewedById IS NOT NULL`; `reviewedById <> submittedById` |

### 11.4 Proposals

| Table | PK | FKs | Unique | Indexes | Checks |
|---|---|---|---|---|---|
| `ProblemStatementProposal` | `id` | `submitterId` RESTRICT, `duplicateOfId` SET NULL, `publishedProjectId` SET NULL | — | **`(submitterId, createdAt DESC)`**, `(verdict, createdAt DESC)`, `(inputHash)` | `[E]` verdict; `length(rawText) BETWEEN 100 AND 5000` |
| `ProposalScore` | `id` | `proposalId` CASCADE | `proposalId` | — | all scores `BETWEEN 0 AND 10` |
| `ProposalRubricScore` | `id` | `scoreId` CASCADE | `(scoreId, family, dimension)` | `(scoreId, family)` | `[E]` family |
| `ProposalExtraction` | `id` | `proposalId` CASCADE | `proposalId` | — | — |
| `ProposalExtractionItem` | `id` | `extractionId` CASCADE | — | `(extractionId, kind)` | `[E]` kind |

### 11.5 Tasks & delivery

| Table | PK | FKs | Unique | Indexes | Checks |
|---|---|---|---|---|---|
| `Task` | `id` | `projectId` CASCADE, `assigneeId` SET NULL, `createdById` SET NULL | — | `(projectId, status)`, `(assigneeId, status)`, `(dueDate) WHERE deletedAt IS NULL`, `(projectId, category)` | `[E]` status, priority; `progress BETWEEN 0 AND 100`; `dueDate >= startDate`; `status='DONE' ⇔ completedAt IS NOT NULL` |
| `Subtask` | `id` | `taskId` CASCADE | — | `(taskId, order)` | — |
| `Board` | `id` | `projectId` CASCADE | partial `(projectId) WHERE isDefault` | — | — |
| `BoardColumn` | `id` | `boardId` CASCADE | `(boardId, position)` | — | `position ≥ 0`; `wipLimit > 0` |
| `ProjectLabel` **[CHANGE]** | `id` | `projectId` CASCADE | `(projectId, name)` | — | `color ~ '^#[0-9A-Fa-f]{6}$'` |
| `TaskLabel` **[NEW]** | `(taskId, labelId)` | both CASCADE | PK is the unique | `(labelId)` | — |
| `Comment` | `id` | `taskId` CASCADE, `userId` RESTRICT, `parentCommentId` CASCADE | — | `(taskId, createdAt)` | `length(body) ≥ 1` |
| `Sprint` | `id` | `projectId` CASCADE | — | `(projectId, startsAt)` | `endsAt > startsAt` |
| `Milestone` | `id` | `projectId` CASCADE | — | `(projectId, dueDate)`, `(dueDate) WHERE status='PENDING'` | — |
| `Meeting` | `id` | `projectId` CASCADE, `createdById` SET NULL | — | `(projectId, startsAt)` | `endsAt > startsAt` |
| `Report` | `id` | `projectId` CASCADE, `fileId` SET NULL, `generatedById` SET NULL | — | `(projectId, generatedAt DESC)` | — |

### 11.6 Project Log

| Table | PK | FKs | Unique | Indexes | Checks |
|---|---|---|---|---|---|
| `ProjectLog` | `id` | `projectId` CASCADE | `projectId` | — | `version ≥ 0` |
| `ProjectLogEvent` | `id` | `logId` CASCADE | `(logId, seq)` | `(logId, type)`, `(logId, createdAt DESC)`, `(actorUserId, createdAt DESC)` | `seq ≥ 0`; append-only (no UPDATE/DELETE grant) |
| `ProjectLogEventField` | `id` | `eventId` CASCADE | — | `(eventId, key)` | exactly one `value*` non-null |
| `ProjectLogDuration` | `id` | `logId` CASCADE | `logId` | — | `endDate > startDate`; `months ≥ 1` |
| `ProjectLogDurationHistory` | `id` | `logId` CASCADE | — | `(logId, at DESC)` | — |
| `ProjectLogMember` | `id` | `logId` CASCADE, `userId` RESTRICT **[CHANGE]** | `(logId, userId)` | `(logId)` | — |
| `ProjectLogMemberResponsibility` | `id` | `memberId` CASCADE, `workPackageId` CASCADE **[CHANGE, G-3]** | `(memberId, workPackageId)` | `(workPackageId)` | — |
| `ProjectLogTechnology` | `id` | `logId` CASCADE | `(logId, name)` | — | — |
| `ProjectLogWorkPackage` | `id` | `logId` CASCADE | `(logId, slug)` | `(logId, status)` | `percentage BETWEEN 0 AND 100`; `[E]` status |
| `ProjectLogMilestone` | `id` | `logId` CASCADE | `(logId, milestoneId)` | `(logId, dueDate)`, `(status, dueDate)` | `dueWeek ≥ 1`; `[E]` status |
| `ProjectLogMilestoneHistory` | `id` | `milestoneId` CASCADE | — | `(milestoneId, at DESC)` | — |
| `ProjectLogSkill` | `id` | `logId` CASCADE | `(logId, skill)` | — | — |
| `ProjectLogSkillGap` | `id` | `logId` CASCADE | `(logId, skill)` **[CHANGE]** | `(logId)` | — |
| `ProjectLogFlag` | `id` | `logId` CASCADE, `resolvedById` SET NULL | `(logId, flagId)` | `(logId, resolved)`, `(type, resolved)` | `[E]` type |
| `ProjectLogEvaluationRef` | `id` | `logId` CASCADE, `reportId` CASCADE **[CHANGE, G-2]** | `(logId, cycle)` | `(logId)` | `authenticity BETWEEN 0 AND 100`; `[E]` plagiarismRisk |

### 11.7 Execution documents

| Table | PK | FKs | Unique | Indexes | Checks |
|---|---|---|---|---|---|
| `ExecutionDocument` | `id` | `projectId` CASCADE, `createdById` SET NULL | `(projectId, version)`, partial `(projectId) WHERE isCurrent` | `(projectId, createdAt DESC)` | `version ≥ 1`; `[E]` generatedBy |
| `ExecutionDocOverview` | `id` | `executionDocumentId` CASCADE | `executionDocumentId` | — | — |
| `ExecutionDocObjective`, `…Deliverable`, `…Risk`, `…SuccessCriteria`, `…SkillRequired` | `id` | `executionDocumentId` CASCADE | — | `(executionDocumentId, order)` | `order ≥ 0` |
| `ExecutionDocWorkPackage` | `id` | `executionDocumentId` CASCADE | — | `(executionDocumentId, order)` | `percentage BETWEEN 0 AND 100` |
| `ExecutionDocMilestone` | `id` | `executionDocumentId` CASCADE | — | `(executionDocumentId, order)` | `completionWeek ≥ 1`; `rewardPoints ≥ 0` |
| `ExecutionDocLearningResource` | `id` | `executionDocumentId` CASCADE | — | `(executionDocumentId, order)` | — |
| `ExecutionDocFeature` | `id` | `executionDocumentId` CASCADE | — | `(executionDocumentId, order)` | `[E]` importance; `points ≥ 0` |
| `ExecutionDocTeamShare` | `id` | `executionDocumentId` CASCADE, `userId` SET NULL **[CHANGE, G-5]** | — | `(executionDocumentId, order)`, `(userId)` | `sharePercent BETWEEN 0 AND 100` |

### 11.8 Evaluation

| Table | PK | FKs | Unique | Indexes | Checks |
|---|---|---|---|---|---|
| `EvaluationReport` | `id` | `projectId` CASCADE, `generatedById` SET NULL | `(projectId, cycle)` | `(overallScore)`, `(projectId, cycle DESC)`, `(createdAt DESC)`, `(isFallback)` | `cycle ≥ 1`; `periodEnd > periodStart`; `overallScore BETWEEN 0 AND 100`; `[E]` plagiarismRisk |
| `EvaluationCategoryScore` | `id` | `reportId` CASCADE | `(reportId, category)` | `(reportId)` | `score BETWEEN 0 AND 100` |
| `EvaluationMemberScore` | `id` | `reportId` CASCADE, `userId` **RESTRICT [CHANGE]** | `(reportId, userId)` | `(userId, reportId)` | `score BETWEEN 0 AND 100` |
| `EvaluationFinding` | `id` | `reportId` CASCADE | — | `(reportId, kind)` | `[E]` kind (exists) |
| `EvaluationEvidence` | `id` | `reportId` CASCADE | — | `(reportId, category)` | — |

### 11.9 GitHub

| Table | PK | FKs | Unique | Indexes | Checks |
|---|---|---|---|---|---|
| `GithubRepository` | `id` | `projectId` CASCADE | `(owner, repository)`, `projectId` | `(lastSyncedAt)`, `(syncStatus)`, `(popularityScore DESC)` | all counters `≥ 0`; `[E]` syncStatus |
| `GithubCommit` | `id` | `repositoryId` CASCADE, `linkedUserId` SET NULL | `(repositoryId, sha)` | `(repositoryId, date DESC)`, `(linkedUserId, date DESC)`, `(authorLogin)` | — |
| `GithubContributor` | `id` | `repositoryId` CASCADE, `linkedUserId` SET NULL | `(repositoryId, username)` | `(linkedUserId)` | `contributions ≥ 0` |
| `GithubSnapshot` | `id` | `repositoryId` CASCADE | — | `(repositoryId, capturedAt DESC)` | counters `≥ 0` |
| `GithubRepositoryLanguage` | `id` | `repositoryId` CASCADE | `(repositoryId, language)` | `(repositoryId)` | `bytes ≥ 0` |
| `GithubRepositoryLabel` | `id` | `repositoryId` CASCADE | `(repositoryId, name)` | `(repositoryId)` | — |
| `GithubRepositoryMilestone` | `id` | `repositoryId` CASCADE | `(repositoryId, title)` | `(repositoryId)` | — |
| `GithubRepoStructure` | `id` | `repositoryId` CASCADE | `repositoryId` | — | counts `≥ 0` |

### 11.10 Insights, rewards, engagement

| Table | PK | FKs | Unique | Indexes | Checks |
|---|---|---|---|---|---|
| `ProjectOverlapFlag` | `id` | `reviewedById` SET NULL | `clusterHash` | `(status)`, `(domain, status)`, `(severity, status)`, `(createdAt DESC)` | `similarityScore BETWEEN 0 AND 1`; `confidence BETWEEN 0 AND 100`; `[E]` severity, status |
| `ProjectOverlapMember` | `id` | `flagId` CASCADE, `projectId` CASCADE | `(flagId, projectId)` | `(projectId)` | — |
| `StandoutProject` | `id` | `projectId` CASCADE, `reviewedById` SET NULL | `projectId` | `(verdict, status)`, `(evidenceScore DESC)` | `confidence BETWEEN 0 AND 100`; `[E]` verdict, status |
| `OpportunityRecommendation` | `id` | `projectId` CASCADE, `reviewedById` SET NULL | `projectId` | `(status)`, `(opportunityScore DESC)` | all fit scores `BETWEEN 0 AND 100` |
| `OpportunityRecommendationItem` | `id` | `recommendationId` CASCADE | — | `(recommendationId)`, `(deadline)` | `[E]` type; `deadline` → TIMESTAMPTZ |
| `InsightsRun` **[NEW]** | `id` | `triggeredById` SET NULL | — | `(kind, startedAt DESC)` | `[E]` kind, status |
| `RewardTransaction` | `id` | `userId` RESTRICT, `projectId` SET NULL | **`(source, sourceRefId)` (G-11)** | `(userId, createdAt DESC)`, `(projectId)` | `points <> 0`; `[E]` source |
| `DailyWorkLog` | `id` | `projectId` CASCADE, `userId` **RESTRICT [CHANGE]** | `(projectId, userId, date)` | `(projectId, date DESC)`, **`(userId, date DESC)`**, `(date)` | `hoursSpent BETWEEN 0 AND 24`; `date <= CURRENT_DATE` |
| `EvidenceUrl` | `id` | see **G-1** | — | `(ownerType, ownerId)` | `url ~ '^https?://'` |
| `UserStreak` | `id` | `userId` CASCADE | **`userId` [CHANGE]** | — | streaks `≥ 0` |
| `Notification` | `id` | `userId` CASCADE | — | `(userId, readAt)`, `(userId, createdAt DESC)` | `[E]` type |
| `NotificationPreference` **[NEW]** | `id` | `userId` CASCADE | `userId` | — | — |
| `AdminAchievement` | `id` | `recipientId` SET NULL, `teamId` SET NULL | — | `(recipientId)`, `(teamId)`, `(date DESC)` | exactly one of recipient/team non-null; `points ≥ 0` |
| `AdminChatHistory` | `id` | `userId` CASCADE | — | `(userId, sessionId, createdAt)` | — |
| `GroupRanking` | `id` | `teamId` CASCADE | `teamId` | `(rank)`, `(domain, rank)` | `rank ≥ 1`; `totalPoints ≥ 0` |
| `Hackathon` | `id` | `organizationId` SET NULL | — | `(startsAt)`, `(status)` | `endsAt > startsAt` |
| `LeetCodeContest` | `id` | `organizationId` SET NULL | — | `(startTime)`, `(status)` | — |

### 11.11 Storage, auth, logs

| Table | PK | FKs | Unique | Indexes | Checks |
|---|---|---|---|---|---|
| `StoredFile` **[NEW]** | `id` | `organizationId` RESTRICT, `uploadedById` RESTRICT | `storageKey` | `(organizationId, purpose)`, `(uploadedById)`, `(deletedAt) WHERE NOT NULL` | `sizeBytes BETWEEN 1 AND 10485760`; `[E]` bucket, provider, visibility, purpose, scanStatus |
| `FileLink` **[NEW]** | `id` | `fileId` CASCADE | `(fileId, entityType, entityId)` | `(entityType, entityId)` | `[E]` entityType |
| `RefreshToken` **[NEW]** | `id` | `userId` CASCADE, `replacedById` SET NULL | `tokenHash` | `(userId, revokedAt)`, `(expiresAt)` | `expiresAt > issuedAt` |
| `PasswordResetToken` **[NEW]** | `id` | `userId` CASCADE | `tokenHash` | `(userId, usedAt)` | single-use |
| `Role` | `id` | `organizationId` CASCADE | `(organizationId, key)` | — | — |
| `Permission` | `id` | `organizationId` CASCADE | `(organizationId, key)` | `(resource, action)` | — |
| `RolePermission` **[NEW]** | `(roleId, permissionId)` | both CASCADE | PK | `(permissionId)` | — |
| `UserRole` **[NEW]** | `(userId, roleId)` | both CASCADE | PK | `(roleId)` | `expiresAt > assignedAt` |
| `InternalApiClient` **[NEW]** | `id` | — | `keyHash` | `(isActive)` | — |
| `ActivityLog` | `id` | `userId` CASCADE, `projectId` CASCADE | — | `(userId, createdAt DESC)`, `(projectId, createdAt DESC)`, `(entityType, entityId)` | — |
| `AuditLog` | `id` | `userId` SET NULL, `organizationId` CASCADE | — | `(organizationId, createdAt DESC)`, `(entityType, entityId, createdAt DESC)`, `(userId, createdAt DESC)` | insert-only |
| `EntityChangeHistory` **[NEW]** | `id` | `changedById` SET NULL | — | `(entityType, entityId, changedAt DESC)` | `[E]` changeSource |
| `LoginHistory` **[NEW]** | `id` | `userId` SET NULL | — | `(userId, createdAt DESC)`, `(email, createdAt DESC)`, `(ipAddress, createdAt DESC)` | — |
| `ErrorLog` **[NEW]** | `id` | `userId` SET NULL | — | `(level, createdAt DESC)`, `(source, createdAt DESC)` | `[E]` level |
| `BulkUploadBatch` **[NEW]** | `id` | `organizationId` CASCADE, `uploadedById` RESTRICT, `fileId` RESTRICT | — | `(organizationId, startedAt DESC)` | `[E]` kind, status |
| `BulkUploadRow` **[NEW]** | `id` | `batchId` CASCADE | `(batchId, rowNumber)` | `(batchId, status)` | `[E]` status |
| `MentorConversation` **[NEW]** | `id` | `projectId` CASCADE, `startedById` SET NULL | — | `(projectId, createdAt DESC)` | — |
| `MentorMessage` **[NEW]** | `id` | `conversationId` CASCADE | — | `(conversationId, createdAt)` | `[E]` role |

---

## 12. ERD Explanation

### 12.1 Core entities (the five that everything hangs off)

```
Organization ──< User ──< ProjectMember >── Project ──< ProjectLog
     │            │                            │
     └──────────< Team ────────────────────────┘
```

1. **`Organization`** — tenant root. Owns users, teams, projects, roles, permissions, events.
2. **`User`** — the principal. Referenced by ~30 tables. Never cascade-deleted.
3. **`Team`** — the group. Owns projects, chat, invites, ranking, collaborations.
4. **`Project`** — the centre of gravity. It is simultaneously the catalog template and the
   claimed instance, and it is the parent of eleven separate subsystems.
5. **`ProjectLog`** — the lifecycle state machine, 1:1 with `Project`, expanded into 13 tables.

### 12.2 The eleven subsystems hanging off `Project`

```
                          ┌── ProjectUseCase / Deliverable / ExpectedMetric
                          │   / CatalogPhase / TypeSpecific        (catalog content, 5)
                          ├── ProjectMember                        (who)
                          ├── ProjectLog ──< ProjectLogEvent ──< ProjectLogEventField
                          │       └──< 12 materialized-state tables (lifecycle, 13)
                          ├── ExecutionDocument ──< 11 child tables (the plan, 12)
                          ├── ProjectFeature                       (scope)
                          ├── ProjectPhase ──< PhaseSubmission     (delivery)
   Project ───────────────┤
                          ├── DailyWorkLog ──< EvidenceUrl         (evidence)
                          ├── Task ──< Subtask / Comment / TaskLabel (work)
                          ├── GithubRepository ──< Commit / Contributor
                          │       / Snapshot / Language / Label
                          │       / Milestone / Structure          (proof, 8)
                          ├── EvaluationReport ──< CategoryScore
                          │       / MemberScore / Finding / Evidence (judgement, 5)
                          └── StandoutProject / OpportunityRecommendation
                              / ProjectOverlapMember                (insights)
```

### 12.3 Supporting entities

- **Catalog authoring**: `ProblemStatementProposal` → `ProposalScore`/`ProposalExtraction` →
  published back into `Project` as a template. The proposal pipeline *feeds* the catalog; it is
  not part of project execution.
- **Attribution bridge**: `User.githubUsername` → `GithubCommit.authorLogin` →
  `GithubCommit.linkedUserId`. This is the only path from external activity to an internal
  principal, and everything about individual ranking depends on it.
- **Points ledger**: `RewardTransaction` is written by three sources (phase approval, daily log,
  admin achievement) and summed into `User.rewardPoints` and `GroupRanking.totalPoints`.
- **Triage surfaces**: `ProjectOverlapFlag`, `StandoutProject`, `OpportunityRecommendation` all
  share the same shape — AI verdict + `isFallback` + `status` + `reviewedById` + `reviewNote`.
  That symmetry is deliberate and should be preserved in any new insight type.
- **Cross-cutting**: `Notification`, `AuditLog`, `ActivityLog`, `StoredFile`/`FileLink`,
  `LoginHistory`, `ErrorLog` attach to everything and are owned by nothing.

### 12.4 Relationship flow — the three chains that matter

**Chain A — evidence to judgement**
```
DailyWorkLog + GithubCommit + PhaseSubmission
        ↓ (aggregated over a 15-day window)
EvaluationReport ──< EvaluationMemberScore ──> User
        ↓
ProjectLogEvaluationRef  (denormalized pointer for the workspace)
        ↓
StandoutProject.avgScore / trendDelta  (cached rollup across cycles)
        ↓
OpportunityRecommendation.opportunityScore
```
Every step consumes the one before it. A break anywhere — an unattributed commit, a missing
daily log, a deleted evidence row — silently degrades every downstream verdict.

**Chain B — idea to execution**
```
ProblemStatementProposal (verdict = ACCEPTED)
        ↓ published as
Project (isTemplate = true) + 5 normalized catalog children
        ↓ claimed under an advisory lock, capped by maxTeams
Project (parentProjectId = template) + ProjectMember
        ↓ intake wizard
ProjectLog v0 + 12 state children
        ↓ AI generation
ExecutionDocument v1 + 11 children
        ↓ derived
ProjectFeature + ProjectPhase
        ↓ executed
PhaseSubmission → RewardTransaction → User.rewardPoints
```

**Chain C — access resolution**
```
JWT → User.role                    (coarse gate: requireRole)
    → User.organizationId          (tenant scope)
    → TeamMember (teamId, userId)  (team scope)
    → ProjectMember (projectId,userId) (project scope: requireProjectAccess)
    → row-level ownership          (own daily log, own proposal, own notification)
```
All four levels must be applied — the documented Dashboard defect was skipping level four.

### 12.5 Ownership flow

| Artifact | Owner | Ownership transfers when |
|---|---|---|
| `Project` (instance) | `Team` via `teamId` | never — withdraw sets status, keeps history |
| `Project` (template) | `Organization` | never |
| `DailyWorkLog` | the individual `User` | never — it is a personal claim of work |
| `PhaseSubmission` | `submittedById` | never |
| `EvaluationReport` | the `Project` | never |
| `GithubCommit` | the repository; attributed to a `User` | re-attribution when `githubUsername` changes |
| `StoredFile` | `uploadedById`, scoped by `FileLink` | reassigned to the org when the user is archived |
| `RewardTransaction` | the `User` | never — a correction is a new negative row |
| `TeamMessage` | the author | never |

### 12.6 Data lifecycle flow

| Stage | What happens |
|---|---|
| **Creation** | almost everything originates from a `Project` claim or a `User` action; AI-generated rows are stamped `isFallback` / `addedBy = AI` / `actorUserId = AI` |
| **Mutation** | lifecycle state is *never* mutated directly — an event is appended, then applied. Execution docs version rather than mutate. Evaluations are immutable except `mentorFeedback` |
| **Derivation** | `UserStreak`, `GroupRanking`, `User.rewardPoints`, `StandoutProject.avgScore`, `GithubRepository.*Score` are all **caches** with an upstream source of truth; each needs a documented recompute path |
| **Archival** | `Project.status = WITHDRAWN\|ARCHIVED`, `ProjectFeature.status = REMOVED`, `Team.status = ARCHIVED`, `User.status = ALUMNI` — no student-facing hard delete exists |
| **Deletion** | only admins hard-delete, and only cache/derived tables (`GithubRepository` and children, insights rows) — all re-derivable |
| **Purge** | `StoredFile` bytes 30 days after soft delete; `Notification` 90 days after read; `ErrorLog` 90 days; bulk-upload source spreadsheets on their PII retention schedule |

---

## 13. Indexing and Performance

### 13.1 Missing indexes that `db_change.md` explicitly names (apply first)

| Index | Query it serves | Consequence today |
|---|---|---|
| `Project(parentProjectId)` | catalog listing, claim capacity check, `/proposals/mine` `findClaimedTemplateIds` | **sequential scan of `Project` on every catalog page load** — the single worst index gap in the schema |
| `Project(isTemplate, status)` | the catalog query itself | full scan filtered in memory |
| `ProblemStatementProposal(submitterId, createdAt)` | `/proposals/mine` list | scan + sort per request |

### 13.2 Additional high-value indexes

**Hot read paths**

| Index | Serves |
|---|---|
| `DailyWorkLog(userId, date DESC)` | streak grid — the existing index leads with `projectId` and cannot serve a per-user query |
| `GithubCommit(linkedUserId, date DESC)` | per-student contribution (already present — Phase 1) |
| `GithubCommit(repositoryId, date DESC)` | repo activity chart (already present) |
| `EvaluationReport(projectId, cycle DESC)` | latest evaluation for the workspace |
| `EvaluationMemberScore(userId, reportId)` | Top Students ranking |
| `Task(projectId, status)` | Kanban board load |
| `Task(assigneeId, status)` | "my tasks" |
| `PhaseSubmission(status) WHERE status = 'PENDING'` | the faculty review queue — a **partial index**, small and always hot |
| `Notification(userId, readAt)` | unread badge on every page load |
| `ProjectMember(userId)` | "my projects" on the Dashboard |
| `ProjectLogEvent(logId, seq DESC)` | latest event / version check |

**Deadline merge (Dashboard)** — three sources, each needs a partial index:
`Task(dueDate) WHERE deletedAt IS NULL AND status <> 'DONE'`,
`Milestone(dueDate) WHERE status = 'PENDING'`,
`ProjectPhase(targetDate) WHERE status <> 'APPROVED'`.
The third is only possible once `targetDate` is stored rather than computed as
`createdAt + weekTarget × 7 days` — today that expression cannot use an index at all.

### 13.3 Composite index ordering rules

Lead with the equality column, then the range/sort column:

| Index | Why this order |
|---|---|
| `(projectId, date DESC)` | filter by project, sort by date |
| `(userId, createdAt DESC)` | same shape |
| `(status, dueDate)` | filter by status, range on date |
| `(organizationId, role)` | tenant filter first — always the most selective in a multi-college deployment |
| `(domain, status)` | matches the Admin Overlaps filter exactly |

A composite `(A, B)` also serves queries on `A` alone, so do not add a separate single-column
index on `A` — that is duplicated write cost for no read gain.

### 13.4 Search indexes

| Need | Index |
|---|---|
| Catalog full-text search | `GIN` on `to_tsvector('english', name ‖ description ‖ problemStatement ‖ soul)` on `Project` |
| Technology filter | `GIN` on `Project.technologies` (array) |
| Differentiation keyword overlap | `GIN` on `Project.differentiationKeywords` — this is what the similarity check scans |
| Skill search | `GIN` on `Project.skillsGained`, plus `UserSkill(skillName, totalPoints DESC)` |
| Fuzzy student lookup | `pg_trgm` GIN on `User.fullName` and `User.regNo` for the admin directory |
| Commit message search | **[ASSUMPTION]** not needed — none of the pages search commit text |

### 13.5 Pagination-friendly indexes

Use **keyset (cursor) pagination**, not `OFFSET`, on every list that can grow unbounded.
`OFFSET 10000` reads and discards 10,000 rows.

| List | Cursor | Index |
|---|---|---|
| Catalog | `(createdAt, id)` | `(isTemplate, status, createdAt DESC, id)` |
| My proposals | `(createdAt, id)` | `(submitterId, createdAt DESC, id)` |
| Daily logs | `(date, id)` | `(projectId, date DESC, id)` |
| Commits | `(date, id)` | `(repositoryId, date DESC, id)` |
| Notifications | `(createdAt, id)` | `(userId, createdAt DESC, id)` |
| Team chat | `(createdAt, id)` | `(teamId, createdAt DESC, id)` |
| Project log events | `seq` | `(logId, seq DESC)` — seq is already a perfect cursor |
| Audit log | `(createdAt, id)` | `(organizationId, createdAt DESC, id)` |

Appending `id` to the sort key makes the cursor total, so rows with identical timestamps cannot
be skipped or repeated across pages.

### 13.6 Frequently queried fields (index-worthy by traffic)

`User.email` (login), `User.organizationId` (every scoped query), `Project.parentProjectId`
(catalog), `Project.isTemplate` (catalog), `ProjectMember.userId` (my projects),
`Task.projectId` + `Task.status` (Kanban), `DailyWorkLog.userId` + `.date` (streak),
`GithubCommit.linkedUserId` (ranking), `EvaluationReport.projectId` (workspace),
`Notification.userId` + `.readAt` (badge), `PhaseSubmission.status` (review queue).

### 13.7 Performance risks

| # | Risk | Why | Mitigation |
|---|---|---|---|
| R-1 | **`Project(parentProjectId)` unindexed** | scanned on every catalog page, every claim, every proposals list | add the index (§13.1) |
| R-2 | **`GithubCommit` unbounded growth** | one row per commit per repo across the whole college; the highest-volume table by far | partition by `date` (monthly) once past ~10 M rows; keep only the two existing indexes |
| R-3 | **`ProjectLogEvent` unbounded growth** | append-only by design | no mitigation needed — but never add an unfiltered "all events" endpoint |
| R-4 | **JSON legacy columns still populated** | `Project.useCases/phases/…`, `ProjectLog.state`, `GithubSnapshot.metrics`, `EvaluationReport.content` duplicate the normalized children; every write pays twice and the row is wide enough to force TOAST | finish the migration and drop them (Phase 6 of §15) |
| R-5 | **Dashboard fan-out** | one page issues 8 endpoints, each aggregating a different table | materialized `DashboardSnapshot` per user refreshed every 15 min, **[ASSUMPTION]** |
| R-6 | **Similarity check is O(n²)** | every claim compares against every sibling's `differentiationKeywords` | GIN index + pre-filter by `domain` before scoring |
| R-7 | **`EvidenceUrl` polymorphic scan** | `(ownerType, ownerId)` is fine, but orphans accumulate forever with no FK to clean them | split the table (**G-1**) |
| R-8 | **Ranking recomputed per request** | Top Teams/Students aggregate across users × commits × evaluations | recompute on a schedule into `GroupRanking`; never compute in the request path |
| R-9 | **`User.rewardPoints` drift** | a cached sum with no reconciliation job | nightly reconcile against `RewardTransaction`; alert on mismatch |
| R-10 | **`Task` unfiltered global query on `/timeline`** | the route is not project-scoped | always filter by the user's project ids |
| R-11 | **10 MB in-memory uploads** | multer buffers the whole file in RAM; concurrent uploads multiply | stream to storage instead of buffering |
| R-12 | **N+1 on the workspace** | project → log → 12 children → members → users | one query with nested `include`, never a loop |

---

## 14. Data Integrity Rules

### 14.1 Unique constraints (complete list)

**Single column**: `User.email`, `User.regNo`, `User.githubUsername` **[NEW]**,
`Team.groupCode`, `Project.problemId`, `Project.slug` **[NEW]**, `Organization.slug` **[NEW]**,
`ProjectOverlapFlag.clusterHash`, `StoredFile.storageKey` **[NEW]**,
`RefreshToken.tokenHash` **[NEW]**, `PasswordResetToken.tokenHash` **[NEW]**.

**One-to-one enforcement**: `ProjectLog.projectId`, `GithubRepository.projectId`,
`GithubRepoStructure.repositoryId`, `ProjectTypeSpecific.projectId`,
`ExecutionDocOverview.executionDocumentId`, `ProposalScore.proposalId`,
`ProposalExtraction.proposalId`, `StandoutProject.projectId`,
`OpportunityRecommendation.projectId`, `GroupRanking.teamId`, `ProjectLogDuration.logId`,
`UserStreak.userId` **[NEW]**, `NotificationPreference.userId` **[NEW]**.

**Composite**: `(projectId, userId)` on `ProjectMember`; `(teamId, userId)` on `TeamMember`;
`(projectId, userId, date)` on `DailyWorkLog`; `(projectId, cycle)` on `EvaluationReport`;
`(projectId, version)` on `ExecutionDocument`; `(projectId, phaseNumber)` on `ProjectPhase`;
`(logId, seq)` on `ProjectLogEvent`; `(logId, slug)` on `ProjectLogWorkPackage`;
`(logId, milestoneId)` on `ProjectLogMilestone`; `(logId, name)` / `(logId, skill)` on the
technology/skill tables; `(logId, flagId)` on `ProjectLogFlag`; `(logId, cycle)` on
`ProjectLogEvaluationRef`; `(owner, repository)` on `GithubRepository`;
`(repositoryId, sha)` on `GithubCommit`; `(repositoryId, username)` on `GithubContributor`;
`(repositoryId, language|name|title)` on the three repo metadata tables;
`(reportId, category)` / `(reportId, userId)` on the evaluation scores;
`(flagId, projectId)` on `ProjectOverlapMember`; `(scoreId, family, dimension)` on
`ProposalRubricScore` **[NEW]**; **`(source, sourceRefId)` on `RewardTransaction` [NEW]**;
`(fileId, entityType, entityId)` on `FileLink` **[NEW]**;
`(batchId, rowNumber)` on `BulkUploadRow` **[NEW]**;
`(memberId, workPackageId)` on `ProjectLogMemberResponsibility` **[NEW]**;
`(userId, platform)` on `UserProfileLink` **[NEW]**.

**Partial unique**: `ExecutionDocument(projectId) WHERE isCurrent`;
`Board(projectId) WHERE isDefault`;
`TeamCollaboration(fromTeamId, toTeamId) WHERE status = 'PENDING'`.

### 14.2 Required (NOT NULL) constraints worth stating

- Every FK that defines existence is NOT NULL: `Project.organizationId`, `Task.projectId`,
  `DailyWorkLog.projectId/userId/date`, `EvaluationReport.projectId/cycle`,
  `ProjectLogEvent.logId/seq/type/actorUserId`.
- Every `status` column is NOT NULL with a default — a null status is unrepresentable state.
- Every `createdAt` is NOT NULL with `now()`.
- Nullable by design: `Project.teamId` (unclaimed template), `Task.assigneeId` (unassigned),
  `GithubRepository.projectId` (repo analyzed before being linked),
  `*.reviewedById` (untriaged), `GithubCommit.linkedUserId` (unattributed — **must stay
  nullable; guessing an owner is worse than admitting ignorance**).

### 14.3 Foreign key constraints

Summarized in §4. The three rules again: **CASCADE** for owned children, **RESTRICT** for
business entities, **SET NULL** for informational references. The five FKs that must be *added*
are G-1, G-2, G-3, G-5, G-6; the two whose behaviour must *change* from CASCADE to RESTRICT are
`EvaluationMemberScore.userId` and `DailyWorkLog.userId`.

### 14.4 Deletion rules

| Entity | Rule |
|---|---|
| `User` | never hard-delete — `status = ALUMNI` + `deletedAt`; anonymize PII on request while keeping the id |
| `Organization` | never delete |
| `Team` | archive; membership and messages retained |
| `Project` template | archive if any child claim exists (RESTRICT enforces it) |
| `Project` instance | withdraw (`status = WITHDRAWN`); hard delete is admin-only and cascades to ~40 tables |
| `DailyWorkLog` | edit-in-place; deletion only within 24 h and only if no evaluation cites the period |
| `PhaseSubmission` | never delete — a superseded attempt is the record of what was reviewed |
| `EvaluationReport` | never delete — regenerate creates a new cycle |
| `ProjectLogEvent` | never delete, never update |
| `RewardTransaction` | never delete — correct with a negative row |
| `GithubRepository` + children | freely deletable, fully re-derivable from the GitHub API |
| Insights rows | freely deletable, recomputable |
| `StoredFile` | soft delete then purge after 30 days |

### 14.5 Status transitions

```
Project:            PLANNED → ACTIVE → SUBMITTED → COMPLETED
                            ↘ WITHDRAWN → (terminal)
                                        → ARCHIVED (from COMPLETED or WITHDRAWN)

ProjectPhase:       PLANNED → SUBMITTED → APPROVED (terminal)
                                       ↘ CHANGES_REQUESTED → SUBMITTED (loop)

PhaseSubmission:    PENDING → APPROVED (terminal)
                            ↘ CHANGES_REQUESTED (terminal for this attempt;
                              a new attempt is a new row, attemptNumber + 1)

ProposalVerdict:    PENDING → ACCEPTED | REJECTED | PENDING_ADMIN | FAILED
                    PENDING_ADMIN → ACCEPTED | REJECTED   (human decision)
                    ACCEPTED/REJECTED are terminal

Task:               TODO ⇄ IN_PROGRESS ⇄ IN_REVIEW → DONE
                    DONE → any (reopen; must clear completedAt)

TeamInvite:         PENDING → ACCEPTED | DECLINED | EXPIRED   (all terminal)
TeamCollaboration:  PENDING → ACCEPTED | DECLINED            (all terminal)
Triage (overlap/standout/opportunity):
                    OPEN → ACKNOWLEDGED | DISMISSED | SUPPRESSED
                    ACKNOWLEDGED → DISMISSED   (nothing returns to OPEN)
WorkPackage:        NOT_STARTED → IN_PROGRESS → DONE  (regression allowed, logged as an event)
LogMilestone:       PENDING → DONE | MISSED
JobStatus:          QUEUED → RUNNING → SUCCESS | FAILED
```

Every transition on `Project`, `ProjectPhase`, `PhaseSubmission` and any triage status must
append an audit record. Illegal transitions must be rejected in the service layer — Postgres
cannot express a state machine in a CHECK constraint across rows.

### 14.6 Validation rules

| Field | Rule |
|---|---|
| `User.email` | RFC-valid, lowercased before store, UNIQUE |
| `User.password` | ≥ 8 chars, bcrypt cost ≥ 10, never stored in plaintext or logged |
| `User.githubUsername` | `^[A-Za-z0-9-]{1,39}$`, UNIQUE |
| `Team.groupCode` | `^[A-Z]#\d+$` |
| `Team.color` | `^#[0-9A-Fa-f]{6}$` |
| `Project.problemId` | `^[HS]\d{4}$` |
| `Project.differentiationApproach` | ≥ 30 characters (the platform's own rule) |
| `Project.maxTeams` | ≥ 1 |
| `Project.sdgAlignment` | each value 1–17 |
| `Project.courseOutcomes` / `programOutcomes` | `^CO\d+$` / `^PO\d+$` |
| `ProblemStatementProposal.rawText` | 100–5000 chars **[ASSUMPTION]** |
| `DailyWorkLog.hoursSpent` | 0–24 |
| `DailyWorkLog.date` | ≤ today; back-dating limited to 7 days **[ASSUMPTION]** |
| `Task.progress` | 0–100; `100 ⇒ status = DONE` |
| `Task.dueDate` | ≥ `startDate` |
| all scores | 0–100 (evaluation) or 0–10 (proposal rubric) |
| `sharePercent` | sums to 100 per execution document |
| `percentage` (work packages) | sums to 100 per log/document |
| `EvidenceUrl.url` | `^https?://` |
| file upload | MIME allow-list, ≤ 10 MB, filename sanitized, never trusted as a storage key |

---

## 15. Migration Plan

Six phases. Each is independently deployable and reversible. **Phase 0 is mandatory before
anything else** — the codebase does not currently compile.

### Phase 0 — Unblock (no migration; code only)

1. Remove the dead `tx.document.deleteMany(...)` call at `project.service.ts:372` and in the
   five seed/script files. `model Document` was deleted in the "Documents Section Removal"
   change, so this does not type-check and **project withdrawal throws at runtime today**.
2. Confirm `tsc --noEmit` is clean on both client and server.
3. Take a baseline migration snapshot — `db_change.md` notes a baseline migration is owed.

**Exit criteria**: clean typecheck, withdrawal works, baseline captured.

### Phase 1 — Core integrity and the named indexes (low risk, high value)

| Step | Change |
|---|---|
| 1.1 | Add `Project(parentProjectId)`, `Project(isTemplate, status)`, `ProblemStatementProposal(submitterId, createdAt)` — all three named in `db_change.md`, none applied. Build them `CONCURRENTLY` |
| 1.2 | Add `DailyWorkLog(userId, date DESC)` |
| 1.3 | Add UNIQUE `User.githubUsername` — **resolve duplicates first** (G-8) |
| 1.4 | Add UNIQUE `UserStreak.userId` — **dedupe first**, keeping the most recent row |
| 1.5 | Add UNIQUE `RewardTransaction(source, sourceRefId)` — **dedupe first**; each removed duplicate is a double-credit that must be reported, not silently dropped |
| 1.6 | Change `EvaluationMemberScore.userId` and `DailyWorkLog.userId` from CASCADE to RESTRICT |
| 1.7 | Add `deletedAt` to `User`, `Project`, `Team`, `Task`, `Comment`, `TeamMessage` |

**Risk**: 1.3–1.5 can fail on existing bad data. Run the detection queries in a read-only
transaction first and reconcile before migrating.
**Rollback**: drop the indexes/constraints; nothing is destructive.

### Phase 2 — Feature tables and enums

| Step | Change |
|---|---|
| 2.1 | **`TaskStatus` enum** — add the column as nullable, backfill (`on-track\|progress\|at-risk → IN_PROGRESS`, `completed\|done → DONE`, `in-review → IN_REVIEW`, else `TODO`), fix the remaining writer in `TeamDetailPage.tsx`, then swap and drop the old column. This closes the documented "tasks vanish from Kanban" defect at its source |
| 2.2 | Remaining status enums: `ProjectStatus`, `PhaseStatus`, `SubmissionStatus`, `ProposalVerdict`, `TriageStatus`, `InviteStatus`, `WorkPackageStatus`, `LogMilestoneStatus`, `FlagType`, `RiskLevel` — same add/backfill/swap pattern |
| 2.3 | Add the five missing FKs: G-2 (`ProjectLogEvaluationRef.reportId`), G-3 (`ProjectLogMemberResponsibility.workPackageId`), G-5 (`ExecutionDocTeamShare.userId`), G-6 (`PhaseSubmission.projectId`), `RewardTransaction.projectId`. **Clean dangling values first** |
| 2.4 | Split `EvidenceUrl` into `DailyWorkLogEvidence` + `PhaseSubmissionEvidence` (G-1); migrate rows by `ownerType`; drop orphans after reporting them |
| 2.5 | Replace `Label` with `ProjectLabel` + `TaskLabel`; dedupe by `(projectId, name)` |
| 2.6 | Split overloaded columns: `ProjectFeature.addedBy` → `addedBySource` + `addedByUserId`; `ProjectLogEvent.actorUserId` → `actorSource` + nullable `actorUserId` (G-4) |
| 2.7 | Add `ProjectPhase.targetDate` and backfill from `project.createdAt + weekTarget × 7 days` |
| 2.8 | `Hackathon.dateRange` → `startsAt` + `endsAt`; parse existing strings, flag unparseable rows for manual fix |
| 2.9 | `OpportunityRecommendationItem.deadline` → `TIMESTAMPTZ` |
| 2.10 | New tables: `InsightsRun`, `NotificationPreference`, `UserProfileLink`, `MentorConversation`, `MentorMessage` |

**Risk**: 2.1 and 2.8 touch live data with ambiguous values. Both need a dry-run report of what
each row will become, reviewed before the migration runs.

### Phase 3 — Permissions / RBAC

| Step | Change |
|---|---|
| 3.1 | Complete `Role` (`key`, `isSystem`) and `Permission` (`resource`, `action`) |
| 3.2 | Create `RolePermission` and `UserRole` |
| 3.3 | Seed system roles (`ADMIN`, `FACULTY`, `STUDENT`, `TEAM_LEAD`, `MENTOR`) and the permission catalog |
| 3.4 | Backfill `UserRole` from the existing `User.role` values |
| 3.5 | Add `ProjectMemberRole` and migrate `ProjectMember.role` off `RoleType` |
| 3.6 | Add faculty→project `ProjectMember` rows with `role = MENTOR` (G-7) |
| 3.7 | Extend middleware to check permissions, keeping `User.role` as the fast path |

**Risk**: an authorization regression is the worst outcome here. Ship the new checks in
shadow mode first — evaluate and log the decision without enforcing it — and compare against
the current behaviour before switching over.

### Phase 4 — Storage

| Step | Change |
|---|---|
| 4.1 | Create `StoredFile` and `FileLink` |
| 4.2 | Backfill from the files already on disk in `uploads/assets/`, marking any with no discoverable owner as `ORPHANED` |
| 4.3 | Rewrite `upload-asset` to write a `StoredFile` row and stream to the configured provider (Cloudinary is already configured but never called) |
| 4.4 | Add signed-URL serving; **stop serving private files from the static path** |
| 4.5 | Add `fileId` columns to `ProjectReview`, `Report`, `TeamMessage`, and the two evidence tables |
| 4.6 | Wire the `/files` page to `StoredFile` |
| 4.7 | Add `BulkUploadBatch` / `BulkUploadRow` and register uploaded spreadsheets as `StoredFile` |
| 4.8 | Deprecate `FileAsset` once the backfill is verified |
| 4.9 | Add the reclaim job (purge soft-deleted after 30 days; flag abandoned uploads after 24 h) |

**Risk**: 4.4 changes URLs. Keep the old paths readable for one release while the new signed
URLs roll out.

### Phase 5 — Logs and audit

| Step | Change |
|---|---|
| 5.1 | Extend `AuditLog` with `entityType`, `entityId`, `before`, `after`, `ipAddress`, `userAgent` |
| 5.2 | Create `LoginHistory`, `ErrorLog`, `EntityChangeHistory` |
| 5.3 | Add a central Prisma middleware hook that writes `AuditLog` for the mutations listed in §10.2 |
| 5.4 | Decide `ActivityLog`: wire it up from the same hook, or drop it. Do not leave it empty |
| 5.5 | Replace the swallowed error in `askMentor` (and the other AI paths) with a real `ErrorLog` write |
| 5.6 | Create `RefreshToken` and `PasswordResetToken`; implement the missing `/auth/refresh` route (`refreshSchema` already exists, the route does not) |
| 5.7 | Add retention jobs per §10.3 |

### Phase 6 — Indexes, optimization, legacy cleanup

| Step | Change |
|---|---|
| 6.1 | Add the remaining indexes from §13.2 — all `CONCURRENTLY` |
| 6.2 | Add GIN indexes for catalog search, `technologies`, `differentiationKeywords`, `skillsGained` |
| 6.3 | Add `pg_trgm` indexes for the admin student directory |
| 6.4 | Convert list endpoints to keyset pagination (§13.5) |
| 6.5 | **Drop the legacy JSON columns** once the normalized children are verified complete: `Project.useCases/expectedMetrics/deliverables/phases/typeSpecific`, `ProjectLog.state`, `GithubSnapshot.metrics`, `GithubRepository.languages/labels/milestones/structure`, `EvaluationReport.content`, `ProblemStatementProposal.scores/extracted`, `DailyWorkLog.evidenceUrls`, `PhaseSubmission.evidenceUrls`, `OpportunityRecommendation.recommendations`. Verify with a row-count and spot-value comparison per column before each drop |
| 6.6 | Add all CHECK constraints from §14.6 (`NOT VALID` first, validate in the background) |
| 6.7 | Add the reconciliation job for `User.rewardPoints` vs `RewardTransaction` |
| 6.8 | Consider partitioning `GithubCommit` by month if it approaches 10 M rows |
| 6.9 | Revoke UPDATE/DELETE on `ProjectLogEvent`, `AuditLog`, `LoginHistory` at the role level |

**Note on 6.5**: this is the phase that actually completes the normalization work
`db_change.md` describes. Until the JSON columns are dropped, every write pays for both
representations and the two can silently diverge.

### Phase ordering rationale

Phase 0 unblocks compilation. Phase 1 is pure addition with immediate performance payoff and no
behaviour change. Phase 2 changes behaviour and needs the most care. Phase 3 touches
authorization and must ship in shadow mode. Phase 4 is self-contained. Phase 5 is additive.
Phase 6 is cleanup that is only safe once everything above is verified.

---

## 16. Assumptions Register

Everything below is **not** derivable from `db_change.md`, the schema, or the routes, and was
inferred. Each should be confirmed before implementation.

| # | Assumption | Where it applies |
|---|---|---|
| A-1 | Faculty read scope is org-wide; there is no faculty→project assignment today | §1.3, §7.2, G-7 |
| A-2 | Faculty may read but not triage insight flags | §7.2 |
| A-3 | Removing a project member is lead/admin only | §5.9, §7.1 |
| A-4 | Phases are sequential — N cannot be submitted before N-1 is approved | §6/F9 |
| A-5 | A phase submission requires at least one evidence URL | §6/F9 |
| A-6 | Proposal `rawText` is bounded at 100–5000 characters | §14.6 |
| A-7 | Daily-log back-dating is limited to 7 days | §6/F8 |
| A-8 | `POST /catalog/session/start` implies a catalog session that should be persisted | §5.6 |
| A-9 | Mentor Q&A should be persisted (`MentorConversation`/`MentorMessage`) | §10.2 |
| A-10 | Storage bucket/folder naming | §8.3 |
| A-11 | Commit attribution falls back `authorLogin` → `authorEmail` → NULL | §2.8 |
| A-12 | A `DashboardSnapshot` materialization would be worth its complexity | R-5 |
| A-13 | Commit-message full-text search is not needed | §13.4 |
| A-14 | `InternalApiClient` should replace the single shared HMAC secret | §9.3 |
| A-15 | Retention windows in §10.3 | §10.3 |

### Findings carried forward from the change logs (not assumptions — documented facts)

1. `project.service.ts:372` calls `tx.document.deleteMany(...)` against a deleted model —
   **project withdrawal is broken and the server does not type-check**.
2. `Task.status` has three writer vocabularies; `TeamDetailPage.tsx` still writes `progress`,
   and the root cause is unfixed.
3. `Project(parentProjectId)`, `Project(isTemplate, status)` and
   `ProblemStatementProposal(submitterId, createdAt)` are queried constantly and unindexed.
4. `ActivityLog` has no writer; the Dashboard activity feed was rewritten around it.
5. `FileAsset` has no writer; uploads land on disk with no database row.
6. `PATCH /tasks/gantt/:taskId` has no frontend caller.
7. The insights scheduler's status is in-memory only.
8. `askMentor` swallows all errors and returns HTTP 200 with a fallback string.
9. `refreshSchema` exists but there is no `/auth/refresh` route.
10. `Role` and `Permission` are connected to nothing; authorization is the `User.role` enum.

---

## 17. Derived Metrics & Analytics Subsystem

> Covers `server/src/modules/metrics/` (9 services, 972 lines) and
> `server/src/modules/intelligence/`. This subsystem computes every score the platform shows
> and **persists none of them**. The tables below close that gap.
> **14 new tables**, bringing the design total to **126**.

### 17.1 What the module does today

| Service | LOC | Nature | Reads | Persists |
|---|---:|---|---|---|
| `northStar.ts` | 99 | constant `NORTH_STAR_TREE` — 1 north-star + leading/lagging metric definitions | nothing | **no** |
| `riskModel.ts` | 124 | pure `teamRisk(RiskInput) → RiskResult`; `RISK_WEIGHTS` hardcoded; `calibrateRiskModel()` exists | nothing | **no** |
| `selectionFit.ts` | 93 | pure `computeFit(FitInput) → FitResult`; `DOMAIN_REQUIRED_SKILLS` hardcoded for 8 domains | nothing | **no** |
| `authenticity.ts` | 106 | `auditProjectAuthenticity(projectId)` — cross-correlates daily logs vs commits vs doc activity | `DailyWorkLog`, `GithubRepository`, `ProjectMember` | **no** |
| `blockerEscalation.ts` | 87 | `detectPersistentBlockers(projectId)` — blockers recurring ≥ `ESCALATION_DAYS` (3) | `DailyWorkLog.blockers` | **no** |
| `workload.ts` | 75 | `teamWorkload(projectId)` — per-member task counts + Gini imbalance | `ProjectMember`, `Task` | **no** |
| `benchmarks.ts` | 48 | pure `wrapBenchmark(value, population)` — median, percentile, z-score, outlier at \|z\| ≥ 1.96 | nothing | **no** |
| `cohortMetrics.ts` | 247 | 6 org-wide aggregates: `onboardingFunnel`, `formationHealth`, `cohortSegmentation`, `earlyWarningBoard`, `catalogDemand`, `cohortRoiReport` | `User`, `Team`, `Project`, `TeamInvite` — full-table scans | **no** |
| `intervention.ts` | 93 | `analyzeInterventionEffectiveness(orgId)` — risk delta 14 days after an admin nudge | `ProjectLogEvent WHERE type='INTERVENTION_LOGGED'` | **no** |

### 17.2 Defects found in this module

These are code findings, not design opinions. Each is verifiable at the cited line.

**M-1 — `intervention.ts` fabricates its own success metric.**
```ts
const initialRiskScore   = Number(data.initialRiskScore   || 50);
const post14DayRiskScore = Number(data.post14DayRiskScore || 40);
const riskDelta = initialRiskScore - post14DayRiskScore;   // positive = risk reduced
```
When the event JSON lacks these keys the fallbacks are `50` and `40`, so `riskDelta` is
**always `+10`** — a guaranteed "risk reduced" result. Every intervention with missing data is
silently scored as a success, and `successRatePct` is biased upward by construction. This is the
same class of defect `db_change.md` called out on the Dashboard streak (hardcoded values
masquerading as measurement), and it is worse here because the number is used to judge whether
staff intervention works.

**M-2 — `intervention.ts` uses the wrong identifier.**
`records` is built with `projectId: e.logId`. `ProjectLogEvent.logId` is the **`ProjectLog` id**,
not the `Project` id. Any join or grouping on that field silently mismatches.

**M-3 — Post-intervention risk is structurally unmeasurable.**
`analyzeInterventionEffectiveness` needs the risk score 14 days after the nudge, but
`teamRisk()` is pure and nothing stores its output. There is no historical risk to read, which
is *why* M-1's fallbacks exist. `ProjectRiskScore` (§17.4) is the actual fix; M-1 is the symptom.

**M-4 — `DOMAIN_REQUIRED_SKILLS` is a hardcoded map of 8 domains.**
A `Project.domain` outside that map yields an empty `requiredSkills` array, so `skillCoverage`
is computed against nothing and the fit score becomes meaningless rather than erroring. Adding
or retuning a domain requires a code deploy.

**M-5 — `wrapBenchmark` reports a confident verdict on an empty cohort.**
With `population.length === 0` it returns `percentile: 50, zScore: 0, isOutlier: false` — an
"average performer" verdict derived from no data. It needs an explicit `insufficientData` flag
so callers can suppress the badge instead of rendering a fake median.

**M-6 — `RISK_WEIGHTS` are hardcoded while `calibrateRiskModel()` exists.**
Calibration implies weights change over time. Without versioning, a risk score computed last
month is not comparable to one computed today, and no stored score can be reproduced.

**M-7 — `cohortMetrics.ts` scans whole tables per request.**
Six functions each issue unindexed org-wide `findMany` calls over `User`, `Team`, `Project`,
`TeamInvite`. At one college this is slow; at cohort scale it is the platform's first hard
performance wall. These must become scheduled rollups (§17.4 `CohortMetricSnapshot`).

### 17.3 Persist-vs-compute decision

The rule applied: **persist when the value is an input to another decision, is shown as a trend,
or must be defensible after the fact.** Compute when it is cheap, current-state-only, and
nothing downstream depends on yesterday's answer.

| Service | Decision | Reason |
|---|---|---|
| `northStar` | **persist definitions** | metric config, admin-editable, referenced by snapshots |
| `riskModel` | **persist every computation** | trend, intervention measurement, early-warning board |
| `selectionFit` | **persist at claim time** + persist the skill map | the score justifies a claim decision and must be defensible later |
| `authenticity` | **persist audits and signals** | academic-integrity evidence; must survive the log being edited |
| `blockerEscalation` | **persist escalations** | has a lifecycle (raised → acknowledged → resolved) |
| `workload` | **compute on demand**; persist only `imbalanceGini` into the risk snapshot | cheap, current-state-only, no trend shown |
| `benchmarks` | **persist the population distribution**, not the wrapper | percentile must not shift between two reads in one session |
| `cohortMetrics` | **persist as scheduled snapshots** | full-table scans; also the only way to show cohort trend |
| `intervention` | **persist as a first-class table** | currently a JSON blob inside an event, which is what enables M-1 |

### 17.4 New tables

#### `MetricDefinition` — reference
Replaces the hardcoded `NORTH_STAR_TREE`.

| Column | Type | Req | Default | Notes |
|---|---|---|---|---|
| `id` | `TEXT` | ! | `cuid()` | PK |
| `organizationId` | `TEXT` | ? | — | FK → `Organization`; NULL = platform-wide default |
| `key` | `TEXT` | ! | — | `NS_01`, `L_LOG_COMPLIANCE`, `L_COMMIT_CADENCE` |
| `name` | `TEXT` | ! | — | |
| `metricType` | `MetricType` | ! | — | `NORTH_STAR \| LEADING \| LAGGING` |
| `unit` | `TEXT` | ! | — | `%`, `commits/week` |
| `description` | `TEXT` | ! | — | |
| `targetExpression` | `TEXT` | ? | — | `> 85%` — kept as text; it is a display target, not a computed bound |
| `scope` | `MetricScope` | ! | `PROJECT` | `ORG \| COHORT \| TEAM \| PROJECT \| USER` |
| `isActive` | `BOOLEAN` | ! | `true` | |
| `displayOrder` | `INTEGER` | ! | `0` | |
| timestamps | | ! | | |

PK `id`; UNIQUE `(organizationId, key)`; index `(metricType, isActive)`.

#### `MetricSnapshot` — generic metric time series

| Column | Type | Req | Notes |
|---|---|---|---|
| `id` | `TEXT` | ! | PK |
| `definitionId` | `TEXT` | ! | FK → `MetricDefinition`, CASCADE |
| `scope` | `MetricScope` | ! | matches the definition's scope |
| `subjectId` | `TEXT` | ! | project / team / user / org id per `scope` |
| `organizationId` | `TEXT` | ! | FK, denormalized for cohort queries |
| `value` | `DOUBLE PRECISION` | ! | |
| `periodStart` / `periodEnd` | `TIMESTAMPTZ` | ! | window the value covers |
| `sampleSize` | `INTEGER` | ! | rows the value was computed from |
| `insufficientData` | `BOOLEAN` | ! | default `false` — the M-5 fix, surfaced at the storage layer |
| `computeRunId` | `TEXT` | ? | FK → `MetricComputeRun` |
| `computedAt` | `TIMESTAMPTZ` | ! | `now()` |

PK `id`; UNIQUE `(definitionId, scope, subjectId, periodStart)` — makes recompute idempotent;
indexes `(scope, subjectId, computedAt DESC)`, `(organizationId, definitionId, periodStart)`.
`subjectId` is intentionally polymorphic (see §17.7).

#### `RiskModelVersion` — the M-6 fix

| Column | Type | Req | Notes |
|---|---|---|---|
| `id` | `TEXT` | ! | PK |
| `version` | `INTEGER` | ! | monotonic |
| `weightSlip` / `weightLogs` / `weightCommits` / `weightFlags` / `weightFairness` | `DOUBLE PRECISION` | ! | defaults `0.30 / 0.25 / 0.15 / 0.20 / 0.10` — today's `RISK_WEIGHTS` |
| `amberThreshold` / `redThreshold` | `INTEGER` | ! | band cutoffs |
| `calibratedFrom` | `INTEGER` | ? | sample size `calibrateRiskModel()` used |
| `isActive` | `BOOLEAN` | ! | exactly one active |
| `notes` | `TEXT` | ? | why it was recalibrated |
| `createdAt` / `createdById` | | | FK → `User` SET NULL |

PK `id`; UNIQUE `version`; partial UNIQUE `(isActive) WHERE isActive`;
CHECK: the five weights sum to `1.0 ± 0.001`; CHECK `redThreshold > amberThreshold`.

#### `ProjectRiskScore` — the M-3 fix

| Column | Type | Req | Notes |
|---|---|---|---|
| `id` | `TEXT` | ! | PK |
| `projectId` | `TEXT` | ! | FK → `Project`, CASCADE |
| `modelVersionId` | `TEXT` | ! | FK → `RiskModelVersion`, RESTRICT — a stored score must stay reproducible |
| `score` | `INTEGER` | ! | 0–100 |
| `band` | `RiskBand` | ! | `GREEN \| AMBER \| RED` |
| *inputs* `percentTimeElapsed`, `percentMilestonesDone`, `logComplianceRate`, `commitVelocityTrend`, `openFlagSeverity`, `contributionGini` | `DOUBLE PRECISION` | ! | the exact `RiskInput` — stored so the score can be recomputed and audited |
| *components* `slippage`, `logNonCompliance`, `commitDrop`, `flagSeverity`, `contributionImbalance` | `DOUBLE PRECISION` | ! | the `RiskResult.components` breakdown |
| `computedAt` | `TIMESTAMPTZ` | ! | `now()` |
| `computeRunId` | `TEXT` | ? | FK → `MetricComputeRun` |

PK `id`; UNIQUE `(projectId, computedAt)`; indexes `(projectId, computedAt DESC)` (trend),
`(band, computedAt DESC)` (early-warning board), `(computedAt)` (the 14-day lookback that M-3
needs). CHECK `score BETWEEN 0 AND 100`; all rates `BETWEEN 0 AND 1`;
`commitVelocityTrend BETWEEN -1 AND 1`.

**Storing the inputs alongside the score is the point.** It is what makes a risk score
defensible to a student, reproducible after a recalibration, and usable as the "before" value
in intervention analysis.

#### `ProjectRiskDriver` — normalized top drivers
`id` PK, `riskScoreId!` FK CASCADE, `driverKey RiskDriverKey!`
(`MILESTONE_SLIPPAGE | LOG_NONCOMPLIANCE | OPEN_FLAGS | COMMIT_DECLINE | CONTRIBUTION_IMBALANCE`),
`weightPct INTEGER!`, `rank INTEGER!`.
UNIQUE `(riskScoreId, driverKey)`; index `(driverKey, weightPct DESC)`.
Today `drivers` is a formatted `string[]` (`"Milestone slippage (30% risk weight)"`) — unusable
for "what is the most common risk driver this term". Normalizing makes that a one-line query.

#### `DomainSkillRequirement` — the M-4 fix
`id` PK, `organizationId?` FK (NULL = platform default), `domain TEXT!`, `skillName TEXT!`,
`weight DOUBLE PRECISION!` default `1.0`, `isRequired BOOLEAN!` default `true`, timestamps.
UNIQUE `(organizationId, domain, skillName)`; index `(domain)`.
Seed from the existing 8-domain map. Admin-editable, so a new domain no longer needs a deploy.

#### `ProjectFitScore` — selection fit, persisted at claim time
`id` PK, `projectId!` FK CASCADE, `teamId!` FK CASCADE, `score DOUBLE PRECISION!`,
`skillCoverage DOUBLE PRECISION!`, `timeFit`, `perfFit`, `avgPerformance`, `weeksAvailable INT!`,
`difficultyTier INT!`, `weightSkillCoverage`/`weightTimeFit`/`weightPerfFit` (the weights in
force), `reasons` → normalized child `ProjectFitReason(id, fitScoreId, text, order)`,
`computedAt!`.
UNIQUE `(projectId, teamId, computedAt)`; index `(teamId, computedAt DESC)`.
CHECK `difficultyTier BETWEEN 0 AND 4`, `skillCoverage BETWEEN 0 AND 1`.

#### `AuthenticityAudit` — per project per run
`id` PK, `projectId!` FK CASCADE, `overallConfidence INTEGER!` (0–100),
`signalCount INT!`, `suspiciousCount INT!`, `periodStart!`, `periodEnd!`,
`evaluationReportId?` FK → `EvaluationReport` SET NULL (links the audit to the cycle that used
it), `computeRunId?`, `createdAt!`.
UNIQUE `(projectId, periodStart, periodEnd)`; index `(projectId, createdAt DESC)`,
`(overallConfidence)`.

#### `AuthenticitySignal` — per member per date
`id` PK, `auditId!` FK CASCADE, `userId!` FK RESTRICT, `date DATE!`,
`logClaimed BOOLEAN!`, `hoursClaimed DOUBLE PRECISION!` default `0`,
`commitCount INT!` default `0`, `docActivityCount INT!` default `0`,
`suspicious BOOLEAN!` default `false`, `reason TEXT?`.
UNIQUE `(auditId, userId, date)`; index `(userId, date)`, `(auditId, suspicious)`.
**RESTRICT on `userId`** for the same reason as `EvaluationMemberScore` — this is integrity
evidence about a person and must not vanish with an account.

#### `BlockerEscalation` — persistent blockers with a lifecycle
`id` PK, `projectId!` FK CASCADE, `userId!` FK RESTRICT, `summary TEXT!`,
`firstSeenDate DATE!`, `lastSeenDate DATE!`, `recurrenceCount INT!`,
`severity INT!` (0–100), `status BlockerStatus!` default `OPEN`
(`OPEN | ACKNOWLEDGED | RESOLVED | STALE`), `acknowledgedById?`, `acknowledgedAt?`,
`resolvedAt?`, `resolutionNote?`, `projectLogFlagId?` FK → `ProjectLogFlag` SET NULL,
timestamps.
UNIQUE `(projectId, userId, firstSeenDate)`; index `(projectId, status)`,
`(status, severity DESC)`.
CHECK `lastSeenDate >= firstSeenDate`; CHECK `recurrenceCount >= ESCALATION_DAYS` (3).
The optional `projectLogFlagId` links an escalation to the `ProjectLogFlag` it raised, so the
workspace flag and the analytics record are the same fact rather than two.

#### `CohortBenchmark` — the population distribution behind a percentile
`id` PK, `organizationId!` FK CASCADE, `definitionId!` FK → `MetricDefinition` CASCADE,
`cohortKey TEXT!` (e.g. `year=II&cluster=CS`), `periodStart!`, `periodEnd!`,
`populationSize INT!`, `median`, `mean`, `stdDev`, `p25`, `p75`, `p90` (all
`DOUBLE PRECISION!`), `insufficientData BOOLEAN!` default `false`, `computedAt!`.
UNIQUE `(organizationId, definitionId, cohortKey, periodStart)`;
index `(definitionId, periodStart DESC)`.
Storing the distribution — not the wrapper output — means two users reading the same percentile
in the same session get the same number, and `wrapBenchmark` becomes a pure formatter over a
stable population.

#### `CohortMetricSnapshot` — the M-7 fix
`id` PK, `organizationId!` FK CASCADE, `reportKind CohortReportKind!`
(`ONBOARDING_FUNNEL | FORMATION_HEALTH | SEGMENTATION | EARLY_WARNING | CATALOG_DEMAND | ROI`),
`cohortKey TEXT?`, `periodStart!`, `periodEnd!`, `payload JSONB!`, `sampleSize INT!`,
`computeRunId?`, `computedAt!`.
UNIQUE `(organizationId, reportKind, cohortKey, periodStart)`;
index `(organizationId, reportKind, computedAt DESC)`.
**`payload` is JSONB by deliberate exception** — these six reports have six different shapes,
they are read whole and never filtered by inner field, and they are regenerable. That is the
narrow case where JSONB is correct, and it is the opposite of the legacy JSON columns in §13.7
R-4, which duplicate queryable normalized data.

#### `Intervention` — the M-1 / M-2 fix
Promotes the JSON-in-event record to a real table.

| Column | Type | Req | Notes |
|---|---|---|---|
| `id` | `TEXT` | ! | PK |
| `projectId` | `TEXT` | ! | FK → `Project` CASCADE — **a real project id**, fixing M-2 |
| `organizationId` | `TEXT` | ! | FK, for the org-scoped report |
| `actorUserId` | `TEXT` | ! | FK → `User` RESTRICT — who intervened |
| `kind` | `InterventionKind` | ! | `GENERAL_NUDGE \| MENTOR_MEETING \| DEADLINE_EXTENSION \| TEAM_RESHUFFLE \| SCOPE_REDUCTION \| ESCALATION` |
| `note` | `TEXT` | ? | |
| `baselineRiskScoreId` | `TEXT` | ? | FK → `ProjectRiskScore` SET NULL — the score at intervention time |
| `followUpRiskScoreId` | `TEXT` | ? | FK → `ProjectRiskScore` SET NULL — the score 14 days later |
| `followUpDueAt` | `TIMESTAMPTZ` | ! | `loggedAt + 14 days` |
| `riskDelta` | `DOUBLE PRECISION` | ? | **NULL until both scores exist — never defaulted** |
| `outcome` | `InterventionOutcome` | ! | `PENDING \| IMPROVED \| UNCHANGED \| WORSENED \| INCONCLUSIVE` default `PENDING` |
| `loggedAt` | `TIMESTAMPTZ` | ! | `now()` |

PK `id`; index `(projectId, loggedAt DESC)`, `(organizationId, kind, outcome)`,
`(followUpDueAt) WHERE outcome = 'PENDING'` (the follow-up job's queue).

**The nullable `riskDelta` is the whole fix.** M-1 exists because the code had nowhere to say
"we don't know yet", so it invented `50 → 40`. With `NULL` + `outcome = PENDING`, an
unmeasured intervention is excluded from `successRatePct` instead of counted as a win, and
`INCONCLUSIVE` covers the case where the follow-up window passed without a computed score.

#### `MetricComputeRun` — job tracking
`id` PK, `kind MetricRunKind!` (`RISK | AUTHENTICITY | BLOCKERS | COHORT | BENCHMARK | ALL`),
`organizationId?` FK, `status JobStatus!`, `startedAt!`, `finishedAt?`,
`subjectsProcessed INT!` default `0`, `snapshotsWritten INT!` default `0`, `errorMessage?`,
`triggeredById?` FK → `User` SET NULL.
Index `(kind, startedAt DESC)`.
Same shape as `InsightsRun` (§2.9) — deliberately, so both pipelines are observable the same way.

### 17.5 Enums added (11)

```
MetricType          = NORTH_STAR | LEADING | LAGGING
MetricScope         = ORG | COHORT | TEAM | PROJECT | USER
RiskBand            = GREEN | AMBER | RED
RiskDriverKey       = MILESTONE_SLIPPAGE | LOG_NONCOMPLIANCE | OPEN_FLAGS
                    | COMMIT_DECLINE | CONTRIBUTION_IMBALANCE
BlockerStatus       = OPEN | ACKNOWLEDGED | RESOLVED | STALE
CohortReportKind    = ONBOARDING_FUNNEL | FORMATION_HEALTH | SEGMENTATION
                    | EARLY_WARNING | CATALOG_DEMAND | ROI
InterventionKind    = GENERAL_NUDGE | MENTOR_MEETING | DEADLINE_EXTENSION
                    | TEAM_RESHUFFLE | SCOPE_REDUCTION | ESCALATION
InterventionOutcome = PENDING | IMPROVED | UNCHANGED | WORSENED | INCONCLUSIVE
MetricRunKind       = RISK | AUTHENTICITY | BLOCKERS | COHORT | BENCHMARK | ALL
AnomalyType         = HIGH_OUTLIER | LOW_OUTLIER
FitTier             = POOR | MARGINAL | GOOD | STRONG
```

Total enums: 20 (§11.1) + 11 = **31**.

### 17.6 Relationship map

| Parent | Child | FK | Type | Cascade | Reason |
|---|---|---|---|---|---|
| `Organization` | `MetricDefinition` | `organizationId` | 1→N | CASCADE | NULL = platform default |
| `MetricDefinition` | `MetricSnapshot` | `definitionId` | 1→N | CASCADE | snapshot is meaningless without its definition |
| `MetricDefinition` | `CohortBenchmark` | `definitionId` | 1→N | CASCADE | |
| `Project` | `ProjectRiskScore` | `projectId` | 1→N (time series) | CASCADE | |
| `RiskModelVersion` | `ProjectRiskScore` | `modelVersionId` | 1→N | **RESTRICT** | a stored score must stay reproducible; never delete a model version that scores reference |
| `ProjectRiskScore` | `ProjectRiskDriver` | `riskScoreId` | 1→N | CASCADE | |
| `ProjectRiskScore` | `Intervention` | `baselineRiskScoreId`, `followUpRiskScoreId` | 1→N ×2 | SET NULL | the intervention record outlives a purged score |
| `Project` | `Intervention` | `projectId` | 1→N | CASCADE | |
| `User` | `Intervention` | `actorUserId` | 1→N | RESTRICT | who intervened is an accountability record |
| `Project` | `AuthenticityAudit` | `projectId` | 1→N | CASCADE | |
| `AuthenticityAudit` | `AuthenticitySignal` | `auditId` | 1→N | CASCADE | |
| `User` | `AuthenticitySignal` | `userId` | 1→N | **RESTRICT** | integrity evidence about a person |
| `EvaluationReport` | `AuthenticityAudit` | `evaluationReportId` | 1→N | SET NULL | links the audit to the cycle that consumed it |
| `Project` / `User` | `BlockerEscalation` | `projectId` / `userId` | 1→N | CASCADE / RESTRICT | |
| `ProjectLogFlag` | `BlockerEscalation` | `projectLogFlagId` | 1→1 | SET NULL | one fact, two surfaces |
| `Project` / `Team` | `ProjectFitScore` | `projectId` / `teamId` | 1→N | CASCADE | |
| `ProjectFitScore` | `ProjectFitReason` | `fitScoreId` | 1→N | CASCADE | |
| `Organization` | `CohortMetricSnapshot`, `CohortBenchmark` | `organizationId` | 1→N | CASCADE | |
| `MetricComputeRun` | `MetricSnapshot`, `ProjectRiskScore`, `CohortMetricSnapshot` | `computeRunId` | 1→N ×3 | SET NULL | provenance survives run purging |

### 17.7 Design notes

**On `MetricSnapshot.subjectId` being polymorphic.** It carries no FK, which §4.12 G-1 argues
against for `EvidenceUrl`. The difference is consequence: an orphaned metric snapshot is stale
analytics caught by the next recompute, whereas an orphaned evidence row misrepresents a
student's work. Four typed snapshot tables would quadruple the schema for a value that is
regenerable. The polymorphic key is the right trade here, and the asymmetry is deliberate.

**On retention.** `ProjectRiskScore` is written per project per run — the highest-volume table
in this subsystem. Keep daily granularity for 90 days, then downsample to weekly, matching the
`GithubSnapshot` policy in §10.3. `MetricComputeRun` keeps 90 days. `AuthenticityAudit` and
`AuthenticitySignal` are **kept indefinitely** — they are academic-integrity records, not
telemetry.

**On compute cadence.** Risk, authenticity and blockers run nightly per active project.
Cohort snapshots and benchmarks run weekly per organization. Intervention follow-up is a job
scanning `Intervention WHERE outcome = 'PENDING' AND followUpDueAt <= now()`, resolving
`followUpRiskScoreId` from the nearest `ProjectRiskScore` and setting the outcome. None of this
belongs in a request path.

**On reproducibility.** Every stored score carries its inputs and its model version. That is
what lets the platform answer "why was my team RED in week 6" six months later — which, for a
system that grades students on these numbers, is not optional.

### 17.8 Migration — Phase 7

Runs after Phase 6 (§15); it depends on the enum and index work landing first.

| Step | Change |
|---|---|
| 7.1 | Create `MetricDefinition`; seed from `NORTH_STAR_TREE`. Point `northStar.ts` at the table |
| 7.2 | Create `RiskModelVersion`; seed v1 from the current `RISK_WEIGHTS` and mark active |
| 7.3 | Create `ProjectRiskScore` + `ProjectRiskDriver`; make `teamRisk()` persist while staying pure (compute in the function, write in a thin service around it) |
| 7.4 | Create `DomainSkillRequirement`; seed the 8 domains; add the "unknown domain" guard that M-4 currently lacks |
| 7.5 | Create `ProjectFitScore` + `ProjectFitReason`; write one at claim time |
| 7.6 | Create `AuthenticityAudit` + `AuthenticitySignal`; persist audit output and link it to the evaluation cycle |
| 7.7 | Create `BlockerEscalation`; backfill from `DailyWorkLog.blockers`; link to `ProjectLogFlag` |
| 7.8 | Create `CohortBenchmark` + `CohortMetricSnapshot`; move the six cohort functions behind them |
| 7.9 | Create `Intervention`; **migrate from `ProjectLogEvent WHERE type='INTERVENTION_LOGGED'`, mapping `logId → ProjectLog.projectId` (M-2), and setting `riskDelta = NULL` / `outcome = PENDING` wherever the JSON lacked real scores rather than carrying the fabricated `50/40` forward (M-1)** |
| 7.10 | Create `MetricComputeRun`; add the nightly and weekly schedules |
| 7.11 | Add `insufficientData` handling to `wrapBenchmark` and its callers (M-5) |
| 7.12 | Add the indexes in §17.4; build `CONCURRENTLY` |

**Step 7.9 is the one to review before running.** The migration must report how many historical
interventions had real scores versus fabricated ones — that count is the correction to any
effectiveness figure previously reported to staff.

### 17.9 Coverage after this section

| Service | Covered by |
|---|---|
| `northStar.ts` | `MetricDefinition`, `MetricSnapshot` |
| `riskModel.ts` | `RiskModelVersion`, `ProjectRiskScore`, `ProjectRiskDriver` |
| `selectionFit.ts` | `DomainSkillRequirement`, `ProjectFitScore`, `ProjectFitReason` |
| `authenticity.ts` | `AuthenticityAudit`, `AuthenticitySignal` |
| `blockerEscalation.ts` | `BlockerEscalation` |
| `workload.ts` | compute-on-demand; `contributionGini` persisted into `ProjectRiskScore` |
| `benchmarks.ts` | `CohortBenchmark` |
| `cohortMetrics.ts` | `CohortMetricSnapshot` |
| `intervention.ts` | `Intervention` |
| all | `MetricComputeRun` |

**Still outstanding** (not in scope for this section): data traces for the ten endpoints listed
in the §16 audit — `/teams/:id/coordination`, `/teams/:id/insights`,
`/projects/recommend-technology`, `/projects/recommend-catalog`, `/catalog/tree`,
`/catalog/allocate-team`, `/catalog/mentor`, `/catalog/:id/check-approach`, `/admin/stats`,
`/internal/browser-token`.
