# PART 2 — AI Engines: Doc Generator, Personalization, 15-Day Verification, AI Mentor, Admin AI

> Prerequisite: `00-OVERVIEW.md` (contracts §3) and a completed **PART 1** (this part imports
> `projectLogService`, the shared types, and the Prisma models it created).
> All LLM calls go through `server/src/modules/ai/llm.service.ts` (`chat`, `chatJSON<T>`,
> `isLlmConfigured`). **Every engine must degrade gracefully**: when the LLM is unavailable or
> returns garbage, return a deterministic fallback — never a 500, never a broken flow.

## Layout

Extend the `lifecycle` module from Part 1:

```
server/src/modules/lifecycle/
  engines/
    docGenerator.engine.ts      // Engine 1 (+ Engine 2 folded in)
    personalization.ts          // Engine 2: similarity retrieval + variation directives
    evaluation.engine.ts        // Engine 3
    mentor.engine.ts            // Engine 4 (+ intake advisories)
  prompts/
    docGenerator.prompt.ts
    personalization.prompt.ts
    evaluation.prompt.ts
    mentor.prompt.ts
    adminAssistant.prompt.ts
  render/
    docMarkdown.ts              // ExecutionDocContent -> markdown
    docPdf.ts                   // markdown -> PDF buffer
  evaluation.scheduler.ts       // 15-day cron
```

Admin AI lives in the existing admin module: `server/src/modules/admin/adminAi.controller.ts`
(+ route in the admin router).

**Prompt files** export functions returning `ChatMessage[]` (system + user). System prompts are
adapted from the spec document (`Project Document.pdf`) — its "AI Prompt" sections are the base
system instructions for each engine; tighten them for JSON output. Never inline prompts in
controllers/services.

**Context discipline:** engines get their input from
`projectLogService.getContext(projectId, view)` — never the raw full state, never chat history.

---

## 1. Engine 1 — Project Planning & Documentation Generator

`POST /api/lifecycle/:projectId/document/generate` (team member or admin; replaces Part 1 stub
if one exists).

### Preconditions
Intake complete: state has ≥1 member, duration set. Else 422 listing what's missing.

### Pipeline (`docGenerator.engine.ts`)

1. `ctx = getContext(projectId, 'planning')` — title, category, department, duration, members
   + their `UserSkill` skills, technologies.
2. `variation = personalization.getVariationDirectives(projectId, ctx)` (see Engine 2). May be
   `null` when nothing similar exists.
3. One `chatJSON<ExecutionDocContent>` call. System prompt (in `docGenerator.prompt.ts`), built
   from the spec: *"You are an experienced engineering project mentor with expertise across
   Computer Science, AI, Mechanical, Electrical, Electronics, Biotechnology, Civil, Chemical,
   Agriculture, Robotics, IoT and interdisciplinary engineering projects. Convert the student
   project title into a practical academic execution plan for a <duration>-month undergraduate
   project. The document is the execution blueprint, not a topic explanation. Suitable for
   undergraduates — neither too simple nor too advanced. Practical; no textbook theory; focus
   on execution."* Plus strict output rules:
   - Return ONLY JSON matching `ExecutionDocContent` (spell out the schema in the prompt).
   - `workBreakdown`: 3–5 packages **adapted to the project's discipline** (software vs
     mechanical vs IoT vs biotech vs research — give the spec's examples as guidance, forbid
     fixed packages), percentages sum to exactly 100, include Project Management ~10% and
     Documentation/IPR ~10%.
   - `objectives` measurable; `deliverables` and `skillsRequired` only applicable items;
     `milestones` with `completionWeek` fitting inside the duration; `risks` likely ones only;
     `learningResources` few and important; `successCriteria` concrete.
   - If `variation` present: append its directives and require `uniquenessNotes` describing
     what genuinely differs.
4. **Validate + repair**: check percentages sum (auto-normalize if off by ≤5, else one retry
   with the error appended), milestone weeks ≤ duration weeks, 3–5 packages. If the LLM is
   unconfigured/fails: deterministic fallback doc from a category-based template (generic but
   valid), flagged `fallback: true` in the response.
5. **Skills gap**: `required` minus the union of team `UserSkill`s (case-insensitive,
   normalize simple synonyms). For each missing skill ensure `learningResources` has an entry
   (ask for it in the same LLM call by passing team skills in; fallback: "search official docs
   /freeCodeCamp/NPTEL for <skill>"). Write gaps into log state via the `DOC_GENERATED` event.
6. Persist `ExecutionDocument` (version = previous + 1), render markdown (`docMarkdown.ts` —
   clean headings per §3.4 section order, milestone table with Milestone | Expected Output |
   Completion Week).
7. `appendEvent(DOC_GENERATED, { workPackages, milestones, skillsRequired, gaps,
   uniquenessNotes, version })` — the Part 1 reducer maps these into state.

### Reads & download
- `GET /document` → latest `{ version, content, markdown, generatedAt }` (404 if none).
- `GET /document/download?format=md|pdf` → `Content-Disposition` attachment
  `<project-title>-execution-plan-v<version>.<ext>`. PDF via a pure-JS lib (`pdfkit` or
  `md-to-pdf`-style pipeline; pick one, add to `server/package.json`; keep styling minimal —
  headings, tables, page numbers).
- Regeneration allowed (team lead/admin); appends `DOC_REGENERATED`; old versions remain
  queryable by version.

---

## 2. Engine 2 — Project Personalization (uniqueness)

`personalization.ts` — not an endpoint; a step inside doc generation.

### `getVariationDirectives(projectId, planningCtx)`

1. **Retrieve similar projects** (deterministic, no LLM): other `Project`s in the same
   domain/category with an `ExecutionDocument`, scored by word-overlap on title + problem
   statement — reuse/extract the existing `normalize`/`wordOverlapRatio` helpers in
   `project.catalog.controller.ts` (export them from a shared util rather than duplicating).
   Take the top 3 with overlap above threshold (start 0.45, constant in one place).
2. If none → return `null` (no artificial variation for genuinely distinct projects).
3. Else build directives via one `chatJSON` call (`personalization.prompt.ts`), system prompt
   from the spec: *"A new project resembles existing projects. Preserve the core objective but
   introduce meaningful variation in one or more of: problem scope, target users, dataset,
   deployment environment, algorithms, sensors, hardware platform, performance goals,
   evaluation methodology, features, constraints, experimental setup, testing strategy. At
   least 30–40% of the execution scope must genuinely differ while remaining academically
   valid. Wording-only differences are forbidden — the execution path must differ."* Input:
   the new project's planning context + compact summaries (title, objectives, work-package
   names, dataset/algorithm mentions) of the similar docs. Output JSON:
   `{ dimensionsToVary: string[], directives: string[], summaryOfSimilarProjects: string }`.
4. Fallback (LLM down): pick 3 dimensions round-robin seeded by projectId hash, with generic
   directives ("use a different dataset source than <other team>'s", …). Deterministic per
   project so regeneration is stable.

Engine 1 folds directives into its generation call and records `uniquenessNotes`.

---

## 3. Engine 3 — Daily Work Log Verification (15-day reports)

### Trigger
- `evaluation.scheduler.ts`: cron (use `node-cron`; register at server boot from `index.ts` or
  wherever background jobs start — check for an existing jobs pattern first). Daily at a fixed
  hour: for each active project with a log, if `daysSince(startDate) / 15` has crossed a new
  integer cycle with no `EvaluationReport` for that cycle → run.
- Manual: `POST /api/lifecycle/:projectId/evaluation/run` (admin only) runs the current cycle
  immediately (idempotent: re-running a cycle overwrites its report).

### Inputs compiled (`evaluation.engine.ts`)
1. `ctx = getContext(projectId, 'evaluation')` (approved plan: packages, milestones,
   responsibilities, timeline).
2. Daily logs for the 15-day window, grouped per member; plus per-member totals (entry count,
   hours). Cap the text fed to the LLM (~6 KB): truncate long entries, keep counts exact.
3. **GitHub evidence** if linked: commit count/authors/messages in window from the stored
   `GithubCommit`/`GithubSnapshot` data via the existing `github.service` (do not call GitHub
   API directly from this engine).
4. Previous cycle's report summary (scores + recommendations) for trend comparison.
5. **Cross-team similarity** (duplicate behaviour): compare this window's log texts against
   (a) this team's previous windows and (b) other teams' current-window logs, using the shared
   word-overlap util per entry-pair; feed only the top suspicious pairs (>0.7 overlap) with
   both texts, as candidates for the LLM to judge.

### LLM call
One `chatJSON<EvaluationReportContent>` (`evaluation.prompt.ts`), system prompt from the spec:
*"You are an experienced engineering project evaluator. Evaluate whether the work genuinely
matches the approved execution plan"* — analyse scope adherence, progress, responsibility
match, technical consistency (logged tech vs approved design), timeline consistency, duplicate
behaviour, missing work, suspicious behaviour (repeated generic logs, copied wording, no
measurable output, unrelated tasks, artificial progress, contradictory entries), authenticity
0–100, plagiarism risk LOW/MEDIUM/HIGH, mentor feedback, next-15-day recommendations, and the
six /100 parameter scores. Require exact `EvaluationReportContent` JSON.

**Deterministic guardrails** (computed in code, passed as facts and enforced after):
- 0 log entries for a member → that member's participation score forced ≤ 20.
- 0 commits despite GitHub linked and software work packages in progress → note injected.
- Overlap pairs >0.85 → plagiarism risk floor MEDIUM.

Fallback (LLM down): report from the deterministic stats only (participation from entry
counts, timeline from milestone status vs elapsed time, other scores null-noted "LLM
unavailable"), `fallback: true`.

### Persist & propagate
Upsert `EvaluationReport(projectId, cycle)`; `appendEvent(EVALUATION_ADDED, {summary})`;
create `Notification`s (existing model/module) for team members and mentors/admins: "15-day
evaluation ready". Reads: `GET /evaluations` (summaries), `GET /evaluations/:reportId` (full).
Students on the team and admins can read; other students 403.

---

## 4. Engine 4 — AI Mentor (continuous)

### `GET /api/lifecycle/:projectId/mentor/status`
`mentor.engine.ts` computes **deterministic signals** from `getContext(projectId, 'mentor')`:

| Signal | Rule → flag type |
|---|---|
| Milestone past due, not DONE | `DELAY` |
| Member with 0 daily logs in last 7 days | `INACTIVE_MEMBER` |
| Work package X IN_PROGRESS while its prerequisite NOT_STARTED (encode a small default
  dependency map: e.g. deployment→backend, model-training→data-collection; derived from
  package ids/names, best-effort) | `MISSING_DEPENDENCY` |
| One member assigned >50% of total percentage | `OVERLOAD` |
| % time elapsed − % milestones done > 25 points | `TIMELINE_RISK` |
| Latest evaluation flagged tech inconsistency | `TECH_DRIFT` |

Diff against `state.flags`: raise new (`FLAG_RAISED`), resolve cleared (`FLAG_RESOLVED`).
Then, **only if signals changed or cache is stale (>6h)**, one `chat` call to narrate:
suggested next tasks per member, on-time likelihood (ON_TRACK / AT_RISK / LIKELY_LATE),
2–3 line summary. Cache the narration (in the response of the last computation stored on the
log state or a small table — implementer's choice, document it). Response:
`{ flags, nextTasks, onTimeEstimate, summary, learningSuggestions }` where
`learningSuggestions` come from unresolved skill gaps in state.

### `POST /api/lifecycle/:projectId/mentor/ask`
Body `{ question }`. Prompt = mentor system prompt + `mentor` view + latest evaluation summary
+ the question. Plain `chat` (not JSON). Refuse questions about other teams (system prompt
rule). Fallback: "AI mentor is not configured" message, 200 not 500.

### Intake advisories (replace Part 1 stubs)
- **`POST /intake/duration-check`** `{ months }` → deterministic bounds first (MINI: 1–3
  typical, FINAL_YEAR: 4–6, RESEARCH: 6–12 — constants); if outside, `advisory` from one short
  `chat` call explaining why shorter/longer fits the category and title; inside → `{ ok: true,
  advisory: null }`. Always `available: isLlmConfigured()`.
- **`POST /intake/suggest-members`** `{ desiredCount?, requiredSkills? }` → candidates =
  Students not already on an active project team (query existing models), joined with
  `UserSkill`; deterministic rank by skill match; optional single `chatJSON` to pick a balanced
  team with reasons. Return `{ suggestions: [{ userId, name, skills, reason }] }`.

---

## 5. Admin AI assistant

`POST /api/admin/ai/ask` (admin role guard — reuse the admin router's existing guard). Body
`{ question }`.

**Routing pipeline (the point: never load everything):**
1. **Classify + resolve targets** — one `chatJSON` call (`adminAssistant.prompt.ts`) given the
   question and a lightweight index (id, title, team name, category of active projects — cheap
   query, cached 5 min): return `{ scope: 'single' | 'compare' | 'cohort',
   projectIds: string[], needsGithub: boolean, needsEvaluations: boolean }`. Deterministic
   pre-pass first: if the question names a project/team verbatim (case-insensitive substring
   match against the index), resolve without the LLM.
2. **Load only what's needed**: for `single`/`compare` (cap 5 projects) →
   `getContext(id, 'admin')` per project; plus latest `EvaluationReport` content if
   `needsEvaluations`; plus GitHub summary (repo, commit count 30d, top contributors, last
   commit date) from stored github data if `needsGithub`. For `cohort` → aggregate stats query
   (counts by category, avg latest scores, open-flag counts) — never per-project payloads.
3. **Answer** — one `chat` call: system prompt "You are the admin analytics assistant. Answer
   ONLY from the provided data; if the data is insufficient, say what's missing. Be concise;
   cite project titles." + the loaded payloads + question.
4. Response `{ answer, scope, projectsUsed: [{id,title}] }` so the UI can show provenance.

Log each Q&A into `AdminChatHistory` (model exists — inspect its shape and reuse).
Fallback: without LLM, handle only verbatim-resolvable single-project questions by returning
the admin view data formatted as text; otherwise explain the assistant needs AI configured.

---

## 6. Definition of done (Part 2)

- [ ] Doc generation: valid `ExecutionDocContent` for a software-type and a hardware-type
      project; percentages 100; markdown + PDF download work; `DOC_GENERATED` reflected in log
      state; skill gaps computed against `UserSkill`.
- [ ] Personalization: two projects with near-identical titles in the same domain → second
      doc's directives/uniquenessNotes present and work packages differ beyond wording;
      distinct project → no variation applied.
- [ ] Evaluation: seeded 15 days of logs (one active member, one silent) → report has forced
      low participation for the silent member; report persisted, event appended,
      notifications created; cron triggers exactly once per cycle; manual re-run overwrites.
- [ ] Mentor status raises/resolves flags per the rules table; ask endpoint answers from log
      JSON only.
- [ ] Duration advisory + member suggestions return the documented shapes (stub shapes gone).
- [ ] Admin ask: single-project, comparison, and cohort questions load only the documented
      payloads (assert via logging in dev); provenance returned.
- [ ] Every engine returns a sane fallback with `GROQ_API_KEY` unset (test this explicitly).
- [ ] `npx tsc --noEmit` clean; server boots; Part 1 tests still pass.
