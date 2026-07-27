# ProjectVerse AI — Implementation Plan (Features + Engineering)

> **Author intent:** a senior-level, end-to-end plan covering (1) the product features to
> introduce across student selection, student management, admin chat, evaluation, and admin
> analytics, and (2) the engineering hardening underneath them.
>
> **Two hard constraints that govern the entire plan:**
>
> 1. **No model training, no embeddings/vector DB, no API-key/billing work.** Everything is
>    prompt-, heuristic-, and product-logic engineering on the current stack.
> 2. **🚫 ZERO Prisma schema / DB migrations.** Do **not** edit `schema.prisma`, do **not**
>    run `migrate dev` or `db push`, do **not** add tables or columns. Every feature below is
>    designed to fit existing storage. *How that's possible is the single most important
>    section of this document — read [Part 0.2](#02-persistence-strategy-zero-migrations) before anything else.*

---

# Part 0 — Foundations

## 0.1 How data flows today

The AI never queries Prisma ad-hoc. One funnel feeds every feature:

```
projectLogService.getContext(projectId, view)   // view: planning | evaluation | mentor | admin
        │
        ├─ reads event-sourced ProjectLogState  (projectLog.service.ts:259)
        ├─ joins live tables per view           (dailyWorkLog, executionDocument, userSkill…)
        └─ returns a view-shaped JSON payload ──► prompt builder ──► llm.service (chat/chatJSON)
                                                                        │
                                                    (no key OR error) ──┴──► hand-written fallback
```

| Layer | File |
|---|---|
| LLM adapter | `server/src/modules/ai/llm.service.ts` |
| Context builder ("log JSON per question") | `server/src/modules/lifecycle/projectLog.service.ts:259` |
| Engines | `server/src/modules/lifecycle/engines/*.ts` |
| Prompts | `server/src/modules/lifecycle/prompts/*.ts` |
| Admin Q&A | `server/src/modules/admin/adminAi.controller.ts` |
| Ranking (cohort analytics source) | `server/src/modules/ranking/ranking.service.ts` |
| Shared types | `server/src/shared/projectLog.types.ts` |

**Golden rule:** if a fact can be computed deterministically from the log JSON, compute it in
code and hand the model the answer as a *given* — never ask the model to derive an auditable number.

## 0.2 Persistence strategy: ZERO migrations

This is what makes the "don't touch the DB" rule practical rather than limiting. Four existing
mechanisms absorb almost every feature below **without a schema change**:

| Mechanism | What it already is | How new features use it |
|---|---|---|
| **Event-sourced log** | `ProjectLog.state` is a JSON blob mutated by `applyEvent` in `projectLog.reducer.ts`; `ProjectLogEvent` is an append-only stream. | Add **new event *types*** and **new fields inside the JSON state** — no column changes. Severity, dependencies, snapshots, overrides all live here. |
| **JSON content columns** | `EvaluationReport.content`, `ExecutionDocument.content` are `Json`. | Add sub-objects (`evidence`, `dependsOn`, `trend`, `status`) freely — the column type never changes. |
| **Compute-on-read** | Rankings, cohort digest, health signals. | Analytics, fit scores, briefings, early-warning are **derived at request time** from data that already exists. Nothing to store. |
| **In-memory / cache layer** | `mentorEngine.narrationCache` pattern. | Briefings, cohort-digest cache, health pulses cached with TTL. Ephemeral by design — a restart just recomputes. |

**Rule of thumb for every feature:** *Derive it on read, or append it to JSON state via an
event.* If a feature genuinely cannot be expressed either way, it is **out of scope for this
phase** and is listed in [Part 5](#part-5--explicitly-deferred-needs-schema--do-not-build-now).

## 0.3 Core architectural principle (never violate)

The codebase already nails this and every task must preserve it:

> **Deterministic code decides. The LLM only narrates.**
> Flags, scores, risk floors, plagiarism thresholds, fit percentages — computed in code and
> auditable. The model turns those facts into readable language. Never move an auditable
> decision into the model.

---

# Part 1 — Engineering Hardening (the substrate)

These land first; the product features in Part 2 depend on them.

## 1.1 LLM Adapter (`ai/llm.service.ts`)
- **Retry-once with jitter** on network/5xx/429 only (never on 4xx — a 400 is a bad prompt).
- **Zod-validate `chatJSON`** output against an expected schema; on miss, log + return fallback so "model returned garbage" is observable, not silent (`llm.service.ts:55`).
- **Per-call temperature** (default stays `0.4`): evaluation/classification drop toward `0`; mentor/doc prose can go higher.
- **Typed `degraded` signal** so the UI can show "AI unavailable — baseline shown" instead of pretending.
- **Do NOT** remove fallbacks; make them honest (see 3.6).

## 1.2 Context typing (`projectLog.service.ts:259`)
- Replace `Record<string, unknown>` with four explicit return types — `PlanningContext`,
  `EvaluationContext`, `MentorContext`, `AdminContext` — in `projectLog.types.ts`, overloaded per `view`.
- Removes the `any` casts (`mentorCtx: any`, `evalCtx: any`) across all engines. **Highest maintainability win; do this first.**
- **Do NOT** fatten payloads — keep each view lean.

## 1.3 Shared utilities
- Extract `shared/skillMatch.ts` (word-boundary + synonym map) — replaces the naive substring
  matching duplicated in `docGenerator.engine.ts:51` and `mentor.engine.ts` member suggestion.

---

# Part 2 — Product Features

Each feature: **what & business value → how it should behave → backend logic → where it plugs
in → persistence (no-migration) → do / don't.**

---

## A. Student — Project Selection

### A1. Fit Score before commitment
- **Value:** fewer abandoned projects; selection becomes a decision, not a guess. Admin gains a demand signal per domain.
- **Behaviour:** on any statement card, show a `0–100` fit % against the team's combined skills, prior performance, and available weeks, with a one-line "why".
- **Backend logic (deterministic; no LLM needed for the number):**
  1. Gather team's `userSkill` set + `performanceScore` (already available via existing queries).
  2. Derive the statement's `requiredSkills` from its category/domain metadata (catalog data already seeded).
  3. `fit = weighted( skillCoverage%, avgPerformance, timeAvailableVsDifficulty )`. Compute in a new `selection.fit.ts` helper.
  4. LLM (optional) only phrases the "why" string from the computed sub-scores.
- **Plug-in:** catalog controller (`projects/project.catalog.controller.ts`) response enrichment.
- **Persistence:** none — computed on read.
- **Do:** cache per (teamId, statementId) for a request cycle. **Don't:** let the model produce the score — it must be reproducible and explainable.

### A2. Difficulty & effort transparency
- **Value:** students self-select correctly; reduces late-semester blame.
- **Behaviour:** each statement shows a difficulty tier + realistic weekly-hours band.
- **Logic:** derive tier heuristically from statement metadata (domain complexity table you maintain in code) + historical completion rate (compute-on-read from existing projects in that domain). No per-statement storage.
- **Persistence:** none. **Don't:** hardcode tiers in the DB — keep the mapping in a code config so it's tunable without a migration.

### A3. Novelty guarantee at selection time
- **Value:** turns your existing anti-duplication engine into a *pre-emptive* selling point.
- **Behaviour:** "3 teams are doing something similar — here's how to differentiate" **before** picking.
- **Logic:** reuse `personalizationEngine.getVariationDirectives` logic, but run it against the *candidate* statement at selection instead of at doc-generation. Compare WBS/title overlap with existing `ExecutionDocument`s.
- **Plug-in:** selection flow, calling the existing personalization path read-only.
- **Persistence:** none. **Don't:** duplicate the overlap logic — extract it once and share with the doc generator.

### A4. Shortlist & compare
- **Value:** matches how teams actually decide; increases engagement.
- **Behaviour:** shortlist up to 3, side-by-side on fit / difficulty / novelty.
- **Logic:** pure frontend state + the A1–A3 read endpoints. **Persistence:** client-side (Redux) or, if it must survive refresh, a `MANUAL_NOTE`-style event on a draft — *but prefer client state to avoid touching persistence at all.*

### A5. Guided custom-idea proposal
- **Value:** platform as mentor, not gatekeeper; captures ambitious students instead of rejecting them.
- **Behaviour:** conversational scope/feasibility interview → "greenlight readiness score".
- **Logic:** extend the existing feasibility-interview prompt flow; readiness score is deterministic (coverage of required rubric points), narrated by the LLM.
- **Persistence:** the resulting approved statement already flows through existing intake — no new storage.

---

## B. Student — Project Management

### B1. Weekly health pulse (traffic light)
- **Value:** early self-correction; the metric a coordinator trusts.
- **Behaviour:** one GREEN/AMBER/RED signal per team with a one-line reason.
- **Logic:** you already compute `percentTimeElapsed` vs `percentMilestonesDone` and open-flag counts in `getContext('admin')` (`projectLog.service.ts:354`). Wrap those into a single deterministic classifier. Zero new data.
- **Persistence:** compute-on-read (optionally cache 15 min).

### B2. Personalized next-3-actions
- **Value:** kills "what do I do now" paralysis; raises throughput.
- **Behaviour:** each member sees the 3 highest-leverage actions that unblock the team.
- **Logic:** upgrade of `mentor.engine.ts` `nextTasks` (currently generic, `:161`): rank by highest-severity flag touching that member's assigned WBS packages; LLM only phrases.
- **Persistence:** none (mentor narration already cached).

### B3. Skill-gap → timeline-aligned learning path
- **Value:** converts a project into a portfolio/placement outcome — a leadership-grade selling point.
- **Behaviour:** "you need PyTorch by week 6 — here's the sequence."
- **Logic:** the doc generator already computes `missingGaps` (`docGenerator.engine.ts:47`). Sequence each gap against milestone weeks; map to a maintained `skill → resource` table (code config, not DB).
- **Persistence:** already stored inside `ExecutionDocument.content` JSON — extend that sub-object, no migration.

### B4. Auto-drafted deliverables (reports / demo script)
- **Value:** removes the most-hated task; huge perceived value; a marketing headline.
- **Behaviour:** one-click IEEE report / mid-review / demo-script draft from the team's own log history.
- **Logic:** a new `deliverable.engine.ts` that assembles context from existing `getContext` + evaluation history + execution doc, then a single `chatJSON`/`chat` render. Output as markdown/PDF via the **existing** `render/docMarkdown.ts` and `render/docPdf.ts`.
- **Persistence:** return on the fly; if a draft must persist, store as a new **event type** (`DELIVERABLE_DRAFTED`) carrying the markdown in the event `data` JSON — no schema change.
- **Don't:** auto-submit anything; drafts are student-owned.

### B5. Viva / defense practice mode
- **Value:** unique differentiator; directly reduces exam anxiety.
- **Behaviour:** generate examiner-style questions from the team's own project, grade typed answers.
- **Logic:** mentor context already has full project grounding. New prompt builder generates Q&A; grading is LLM-narrated over a deterministic rubric-coverage check.
- **Persistence:** ephemeral session; optionally log attempts as a `MANUAL_NOTE` event. Prefer ephemeral.

### B6. Private contribution-fairness view
- **Value:** freeloading self-corrects before it becomes a grading dispute.
- **Behaviour:** each member privately sees their participation vs the team.
- **Logic:** reuse the per-member log/commit stats already computed in `evaluation.engine.ts` (`logsGroupedByMember`). Expose read-only, per-user scoped.
- **Persistence:** none. **Don't:** expose others' individual numbers — privacy is the point.

---

## C. Admin Chat (decision co-pilot)

Builds on the already-strong `adminAi.controller.ts`.

### C1. Answers with receipts + charts
- **Value:** trust in AI output comes from showing numbers, not prose.
- **Behaviour:** "which teams are at risk" → ranked list + evidence + a chart spec the frontend renders.
- **Logic:** have the admin answer path return a **structured result** (`{ narrative, table, chartSpec }`) via `chatJSON`, grounded in the existing `buildCohortDigest` payload. Frontend renders the chart; no charting on the server.
- **Persistence:** none.

### C2. Fuzzy project/team matching (parity with people)
- **Value:** eliminates "insufficient data" dead-ends from a misspelled project name.
- **Logic:** mirror `findStudentByFuzzyName` (`adminAi.controller.ts:36`) with a `findProjectByFuzzyName`, run in the `matched.length === 0` branch before the classifier fallback.
- **Persistence:** none.

### C3. Conversational memory
- **Value:** "what about their timeline?" works after a team question — feels intelligent.
- **Logic:** `AdminChatHistory` is **already persisted** (`:143`) but never read back. Load the last 2–3 turns for the `sessionId` and prepend to `buildAdminAnswerPrompt`.
- **Persistence:** uses the existing table — **no migration**.
- **Don't:** load more than ~3 turns (token budget + drift).

### C4. Classifier owns context flags
- **Value:** "how's their code coming along" correctly loads GitHub without keyword luck.
- **Logic:** drop the brittle keyword heuristic (`:288`) on the classified path; let the already-invoked LLM classifier set `needsGithub`/`needsEvaluations`. Keep keywords only on the verbatim fast-path.

### C5. Digest caching
- **Value:** snappy multi-question sessions; less DB load.
- **Logic:** cache `buildCohortDigest` output with a 2–5 min TTL (cohort-wide key), mirroring `narrationCache`.
- **Persistence:** in-memory.

### C6. From insight to action (draft-only)
- **Value:** turns analytics into outcomes — the highest-value admin feature.
- **Behaviour:** every risk answer offers "draft intervention email to guide / schedule review".
- **Logic:** LLM drafts text from the loaded team context; return as a draft object. Sending/scheduling is a **separate explicit admin action** through existing notification infra (`notificationService`).
- **Persistence:** notifications already exist. **Don't:** ever auto-send; admin approves every outbound.

---

## D. Evaluation (defensible grading)

### D1. Evidence-backed scores
- **Value:** liability shield against grade disputes.
- **Logic:** attach deterministic evidence (`logCount`, `commitCount`, `maxOverlap%`) to each score object inside `EvaluationReportContent`.
- **Persistence:** goes inside `EvaluationReport.content` JSON — **no migration**.

### D2. GitHub ↔ log correlation (authenticity)
- **Value:** "claimed X, zero commits that day" — far stronger than counting; sells plagiarism resistance.
- **Logic:** build a per-day `{ commits, logClaims }` map in `evaluation.engine.ts`; contradiction → deterministic note on `technicalProgress`. Data already fetched (`:52`, `:85`).

### D3. Category-weighted scoring
- **Value:** research vs mini graded fairly → credible.
- **Logic:** replace the equal-÷6 average (`:157`) with a weight map keyed on `evalCtx.category`, kept in a code config object.

### D4. Self-plagiarism + low-effort detectors
- **Value:** catches paste-the-same-log-daily and one-line logs that word-overlap misses.
- **Logic:** deterministic day-over-day self-similarity + log-specificity check; feed into `suspiciousBehaviour` / `documentationQuality`. Reuse `wordOverlapRatio`.

### D5. Trend across cycles
- **Value:** rewards consistency; catches decline early.
- **Logic:** `getContext('evaluation')` already exposes `recentEvaluations`; compute a delta and include a `trend` object in the report `content` JSON.
- **Persistence:** inside existing JSON.

### D6. Honest fallback
- **Value:** an AI-down cycle must not silently emit confident 80s (`getFallbackReport:218`).
- **Logic:** mark fallback content `status: "UNVERIFIED_AI_UNAVAILABLE"`, null/zero subjective scores; the UI already receives `fallback: true` (`:214`) — surface it.

### D7. Human override with audit trail
- **Value:** a human stays accountable — precondition for real academic adoption.
- **Logic:** admin adjusts a score with a reason. Persist as a **new event type** `EVALUATION_OVERRIDDEN` on the project log (`data: { cycle, field, oldScore, newScore, reason, actorUserId }`) via the existing `appendEvent` path.
- **Persistence:** event stream — **no migration**. The report can read the latest override on load.
- **Do:** keep the original AI score visible alongside the override. **Don't:** mutate the AI's score in place — audit requires both.

---

## E. Admin Visibility / Dashboards

All **compute-on-read** from existing tables + rankings. No storage.

### E1. Cohort command center
- One screen: total projects, risk distribution, on-track %, plagiarism flags, top/bottom teams.
- **Logic:** `buildCohortDigest` already assembles most of this — expose it as a structured dashboard endpoint (cached per E-C5).

### E2. Drill-down
- Every metric clicks through to teams → members → evidence, reusing existing `AdminService.getTeamDetail` / `getStudentDetail`.

### E3. Domain & department analytics
- **Logic:** aggregate existing project/ranking data by `domain`/`department` on read. Pure query composition — no new tables.

### E4. Early-warning board (predictive, no ML)
- **Value:** intervene before a team fails.
- **Logic:** a deterministic risk score from log cadence + commit velocity + milestone slippage (all already in context). "Predictive" via trend extrapolation, **not** a trained model. Rank teams by risk.

### E5. Catalog intelligence
- "No one is doing GovTech", "these 40 statements are near-duplicates", "most/least chosen".
- **Logic:** aggregate selections across teams + reuse the overlap logic from A3/personalization. Compute-on-read.

### E6. Exportable reports
- One-click cohort PDF/Excel for accreditation.
- **Logic:** reuse existing `render/docPdf.ts`; assemble from the dashboard payloads. **Don't:** build a new PDF stack — extend the one that exists.

---

## F. Cross-cutting differentiators
- **Proactive over reactive:** daily/weekly auto-briefings (cached compute-on-read + existing `notificationService`). Biggest perceived-value jump.
- **Every insight ends in an artifact or action:** draft email, report, learning path, practice session.
- **Trust by transparency:** every AI number carries visible evidence and is human-overridable (D1, D7).
- **Portfolio/placement angle:** B3 + B4 reframe the platform from "tracker" to "career-outcome engine" — the strongest leadership pitch.

---

# Part 3 — Recommended sequencing

| Phase | Items | Rationale | Migration? |
|---|---|---|---|
| **0 — Substrate** | 1.1 retry/Zod, 1.2 typed contexts, 1.3 skillMatch | Unblocks safe edits everywhere | No |
| **1 — Defensibility** | D1 evidence, D6 honest fallback, D2 correlation | Grading trust = adoption precondition | No |
| **2 — Student value** | B1 health pulse, B2 next-actions, A1 fit score | Retention + completion; visible fast | No |
| **3 — Admin co-pilot** | C2 fuzzy, C3 memory, C5 cache, C1 receipts | Turns chat into a decision tool | No |
| **4 — Differentiators** | B4 deliverables, B5 viva, E4 early-warning, C6 actions | Market-defining; press-release features | No* |
| **5 — Polish** | E1 command center, E6 exports, F briefings | Stakeholder-facing ROI | No |

*Phase 4 persists only via event types / JSON — still no schema change.

---

# Part 4 — Universal DO / DON'T

**DO**
- ✅ Compute every auditable number in code; hand the model the number; validate what comes back.
- ✅ Persist new state by **appending event types** or **extending JSON `content`** — nothing else.
- ✅ Derive analytics **on read**; cache with TTL where hot.
- ✅ Reuse existing renderers (`docMarkdown`, `docPdf`), summarizers (`summarizeTeamForPrompt`), and notification infra.
- ✅ Keep fallbacks — make them honest and labeled.

**DON'T**
- 🚫 **Touch `schema.prisma`, run `migrate dev`/`db push`, or add tables/columns.** If a feature seems to need it, redesign it around event types + JSON, or defer it (Part 5).
- 🚫 Move an auditable decision (flag, score, risk floor, fit %) into the LLM.
- 🚫 Dump raw Prisma rows into a prompt — summarize first.
- 🚫 Widen a context payload without a proven need (token budget + quality).
- 🚫 Change idempotency keys (`EvaluationReport.projectId_cycle`, `ExecutionDocument.version`).
- 🚫 `JSON.parse` a model reply without a schema check (post 1.1).
- 🚫 Auto-send anything outbound (emails, notifications) — admin/student approves every action.

---

# Part 5 — Explicitly deferred (needs schema — do NOT build now)

Listed so nobody quietly adds a migration. Each is achievable later, but **not in this phase**:

- Dedicated tables for viva attempts, deliverable version history, or long-term briefing archives
  (currently handled ephemerally or via event `data`).
- First-class `AiUsageLog` / token metering (belongs to the future API-key phase you've reserved).
- Any per-user encrypted API-key storage.

If a stakeholder requests one of these, treat it as a **separate schema-change proposal**,
reviewed on its own — never smuggled into a feature PR.

---

# Part 6 — Business-angle improvements (friction & operations)

> **Why this part exists.** Parts 1–5 make the *AI* smarter. This part makes the *product*
> smoother — the un-glamorous logic that decides whether students actually finish selection
> without dropping off, and whether an admin can run a 300-student cohort without a spreadsheet.
> These are mostly **plain product logic**, not AI. Same two constraints still apply: **no schema
> migration** (everything lives in existing tables / JSON `content` / event `data` / compute-on-read)
> and **deterministic code decides, the model only narrates**.

## 6.0 What the current flow actually leaves on the table

Grounded in the real code, not hypotheticals:

| Gap today | Where | Business cost |
|---|---|---|
| Selection is **stateless & client-driven** (`project.catalog.controller.ts:94`) — a refresh mid-flow loses mentor chat, checklist, shortlist. | Catalog flow | Teams restart the funnel, drop off, or "just pick anything". |
| Catalog list carries only `childProjects` count — **no scarcity, no fit, no filter-by-my-team**. | `getCatalog:112` | Herd behaviour onto a few statements; late blame. |
| Capacity rule "**max 4 teams**" is enforced only *at submit* (`selectProject:613`) — the student sees it after investing in the mentor chat. | `:611` | Wasted effort, frustration at the finish line. |
| `groupRegistered` / `skillsRegistered` / `teamId` completeness exists per-user but is **never surfaced as a cohort funnel**. | `User` fields | Admin can't see who's stuck *before* selection even opens. |
| `DailyWorkLog.blockers` is captured but **not escalated** anywhere. | `DailyWorkLog:640` | A blocked team stays silently blocked for a week. |
| Task load per member (`Task.assigneeId`) is never aggregated into a **balance view**. | `Task` | Uneven load → the freeloading dispute D2/B6 tries to fix *after the fact*. |

Each row below closes one of these with existing data.

---

## G. Student — Selection, made smoother (friction, not AI)

### G1. Persist the selection draft (kill the refresh-loses-everything problem)
- **Value:** the single biggest silent drop-off in the funnel. A team spends 10 min in the mentor
  chat, refreshes, loses the checklist, and gives up.
- **Behaviour:** mentor history, `checklist`, `readinessScore`, shortlist, and chosen category
  survive refresh and device change for the *team*.
- **Logic:** the flow is already keyed to a team the moment `selectProject` runs. Before that, persist
  the draft on the **team's future ProjectLog is not available yet** — so store it as a
  `SELECTION_DRAFT` **event on a lightweight per-team draft log**, *or* (preferred, zero-risk) keep it
  client-side in Redux + `localStorage` keyed by `teamId`. Only promote to server state if cross-device
  is a hard requirement.
- **Persistence:** client-first; if server-side is required, event `data` on the project log created
  lazily — **no migration**. **Don't:** create a Project row for a draft (pollutes catalog counts).

### G2. Scarcity & availability, shown *before* the mentor chat
- **Value:** stops herd pile-ups and the "max 4 teams reached" wall at submit time.
- **Behaviour:** every catalog card shows `slots left (4 − childProjects)`, a
  `Filling fast / Open / Full` tag, and disables "select" when full.
- **Logic:** `getCatalog` already includes `_count.childProjects` — derive `slotsLeft` and status in
  the response. Pre-flight the same `childCount >= 4` check the submit path already does (`:613`) so the
  wall shows on the card, not after the chat.
- **Persistence:** none (compute-on-read). **Don't:** duplicate the capacity constant — extract
  `MAX_TEAMS_PER_STATEMENT = 4` to one shared config used by both card and submit.

### G3. Team-readiness gate with a visible checklist
- **Value:** removes the "must belong to a team" 401 dead-end (`selectProject:573`) that students hit
  with no explanation.
- **Behaviour:** before selection opens, show a checklist — *team formed (≥ min members)*, *skills
  registered (`skillsRegistered`)*, *group registered (`groupRegistered`)* — with a direct fix link per
  unchecked item.
- **Logic:** all three are existing `User`/`Team` booleans + `TeamMember` count vs `Team.maxMembers`.
  Pure read. Gate the "Start selection" CTA on it.
- **Persistence:** none. **Don't:** hard-block silently — always say *why* and *how to fix*.

### G4. Sort/filter catalog by *my team's* fit
- **Value:** turns A1 (fit score) from a per-card afterthought into the **primary sort** — the team
  sees "best matches for us" first.
- **Logic:** reuse the A1 `selection.fit.ts` helper; sort `getCatalog` results by fit when a `teamId`
  is present. Filters already exist for `type/domain/sector` (`:114`) — add `?minFit=` and
  `?onlyOpen=true`.
- **Persistence:** none. **Don't:** compute fit N times — batch the team's skill set once per request.

### G5. Consensus lock (captain selects, members confirm)
- **Value:** prevents the captain unilaterally committing the team to a statement nobody else wanted —
  a real source of mid-project conflict.
- **Behaviour:** captain proposes → members get a lightweight thumbs-up/down → lock only on majority.
- **Logic:** `TeamMessage` + a `SELECTION_VOTE` marker, *or* reuse `TeamInvite`-style status rows
  conceptually. Simplest zero-migration path: a `SELECTION_VOTE` event on the draft log; tally
  deterministically.
- **Persistence:** event `data`. **Don't:** block a solo/2-person team on quorum — scale the threshold
  to roster size.

---

## H. Student — Project management, made smoother

### H1. One-tap daily log with GitHub prefill
- **Value:** log compliance is the input *everything* downstream (evaluation, ranking, health) depends
  on. Friction here starves the whole system.
- **Behaviour:** the daily-log form pre-fills `workDone` from that day's commit messages and offers a
  one-tap "confirm". `hoursSpent`/`blockers` optional.
- **Logic:** `GithubCommit` rows are already synced per repo with `author` + `date`. Match the member's
  `githubUsername` to the day's commits and draft the prefill. Student edits before save — never
  auto-submit (Part 4).
- **Persistence:** writes the existing `DailyWorkLog` row. **Don't:** treat a commit as a log — it's a
  *draft*, the human confirms.

### H2. Blocker escalation ladder
- **Value:** closes the "blocked silently for a week" gap. `blockers` is captured and then ignored.
- **Behaviour:** a non-empty `DailyWorkLog.blockers` unresolved for N days raises an AMBER on the team
  health pulse (B1) and lands on the admin early-warning board (E4).
- **Logic:** deterministic: scan recent `DailyWorkLog.blockers`; "unresolved" = same/similar blocker
  text recurring, or no later log clearing it. Feed the existing B1/E4 classifiers — no new surface.
- **Persistence:** compute-on-read. **Don't:** notify the admin on the first blocker — that's normal
  work; escalate on *persistence*, not occurrence.

### H3. Team workload-balance view
- **Value:** makes uneven load visible *while it's fixable*, not at grading time (complements B6/D2).
- **Behaviour:** a simple bar per member — open tasks, in-progress, done, overdue — with a "reassign"
  hint when one member holds most of the open load.
- **Logic:** aggregate `Task` by `assigneeId` + `status` + `dueDate` for the project. Pure query.
  The captain sees names; each member sees their own bar highlighted.
- **Persistence:** none. **Don't:** expose it as a leaderboard — it's a balancing tool, not a ranking.

### H4. Milestone timeline vs today (slippage at a glance)
- **Value:** the "are we behind?" question answered visually, feeding self-correction.
- **Logic:** `Milestone.dueDate` + `Task.completedAt` already exist. Render a timeline with a "today"
  marker and flag milestones whose dependent tasks aren't done. This is the visual layer under the
  deterministic `percentTimeElapsed vs percentMilestonesDone` you already compute (`projectLog.service.ts:354`).
- **Persistence:** none. **Reuse:** the exact numbers B1 uses, so the chart and the traffic-light never disagree.

### H5. Streak-driven log nudge (use what's already there)
- **Value:** `UserStreak` exists but does no behavioural work. A streak-at-risk nudge is the cheapest
  lever on daily-log compliance (the H1/evaluation input).
- **Logic:** if `currentStreak > 0` and no `DailyWorkLog` yet today, surface a "keep your N-day streak"
  prompt via existing `notificationService`. Deterministic; student-facing only.
- **Persistence:** existing `UserStreak` + `Notification`. **Don't:** spam — one nudge, late in the day.

---

## I. Admin — clear stats to actually run the cohort

All **compute-on-read** from existing tables. This is the "clear all details and stats to look after
students, groups and teams" the request asks for, expressed as concrete deterministic panels.

### I1. Onboarding funnel (before projects even start)
- **Value:** the admin's #1 pre-semester question — *who is stuck and where* — with no spreadsheet.
- **Behaviour:** a funnel: `students → groupRegistered → skillsRegistered → in a team → team at min
  size → project selected → project approved`, with the drop count and a drill-down list at each stage.
- **Logic:** every stage is an existing boolean/relation on `User`/`Team`/`Project`
  (`groupRegistered`, `skillsRegistered`, `teamId`, `TeamMember` count vs `maxMembers`,
  `Project.status`). Pure aggregation.
- **Persistence:** none. Cache per E-C5 TTL.

### I2. Team-formation health board
- **Value:** under-filled and orphaned teams are the quiet failure mode before selection.
- **Behaviour:** teams below `maxMembers`, teams with pending `TeamInvite`/`JOIN_REQUEST` piling up,
  students in **no** team, teams with a captain but no members.
- **Logic:** `Team` + `TeamMember` counts + `TeamInvite.status='pending'` aggregation. All present.
- **Persistence:** none. **Action hook:** each row offers C6-style draft nudge to the captain — never
  auto-sent.

### I3. Cohort segmentation analytics
- **Value:** accreditation and equity questions answered on read — the `User` profile fields are rich
  and currently unused for reporting.
- **Behaviour:** slice completion / risk / selection by `department`, `deptCode`, `cluster` (CS vs
  Non-CS), `year`, `gender`, `resident`, `ssgDomain`. "Non-CS teams lag on GitHub linkage", etc.
- **Logic:** join existing rankings/health to these `User`/`Team` dimensions. Pure query composition
  (this is E3 made concrete against your real columns).
- **Persistence:** none. **Don't:** build per-segment tables — group on read.

### I4. Engagement pulse (log & commit cadence)
- **Value:** the leading indicator of a cohort in trouble, weeks before grades.
- **Behaviour:** cohort-wide daily-log submission rate, streak distribution, teams with 0 logs in K
  days, commit-velocity trend.
- **Logic:** aggregate `DailyWorkLog` by date + `UserStreak` + `GithubCommit` counts. Feeds E4's
  early-warning ranking.
- **Persistence:** none (cache the heavy aggregation with TTL).

### I5. Selection-demand & catalog intelligence (this is E5, grounded)
- **Value:** rebalance the catalog *this* cycle — "40 teams on 3 statements, 200 statements untouched".
- **Logic:** aggregate `Project.parentProjectId` → template selection counts (you already carry
  `childProjects`), cross with `domain`/`sector`/`type`. Surface most/least chosen, near-full
  (`slotsLeft ≤ 1`), and zero-demand domains. Reuse the A3 overlap logic for "these N statements are
  near-duplicates".
- **Persistence:** none. **Action:** admin can retire/merge a dead statement (existing catalog CRUD).

### I6. One roster export
- **Value:** the artifact registrars actually ask for; reuse E6's renderer.
- **Logic:** assemble I1–I3 payloads into the existing `render/docPdf.ts` / an Excel export (you already
  depend on `xlsx` in `admin.service.ts`). **Don't:** add a new export stack.

---

## 6.7 Sequencing these against the existing plan

Slot into the Part 3 phases without disruption — most are cheap, high-visibility wins:

| When | Items | Rides on |
|---|---|---|
| **Phase 2 (student value)** | G2 scarcity, G3 readiness gate, H1 log prefill, H4 timeline | Same phase as B1/A1; shares their reads |
| **Phase 3 (admin co-pilot)** | I1 funnel, I2 formation board, I4 engagement | Same digest/cache work as C-series |
| **Phase 4/5** | G1 draft persistence, G5 consensus, H2 escalation, I3 segmentation, I5 demand, I6 export | Reuses E4 early-warning + E6 export |

**Highest ROI, do first:** G2 + G3 (selection stops leaking teams) and I1 + I2 (admin stops needing a
spreadsheet) — all four are pure reads on data you already have, zero AI, zero migration.
