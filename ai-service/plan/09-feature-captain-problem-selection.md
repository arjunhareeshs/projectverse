# Stage 9 — Feature 1 ⭐: Captain Problem-Statement Selection & Registration

> Ref: master plan Part K. This is the flagship feature and the reason the whole agent/tool/RAG stack was
> built in that order — every dependency this stage needs already exists by Stage 8.

## Goal

Complete the `captain_agent` scaffolded in Stage 8 into the full end-to-end flow: read a team's real
composition and skills, semantically shortlist the top 5 *available* problem statements, converse with the
captain to refine the choice, generate a unique approach/method/value thesis, and atomically claim +
register the chosen problem so no other team — human or AI — can take it afterward.

## Why this comes ninth

It's explicitly the feature you asked to be built first in the product, but it's *architecturally* last in
this build order because it's the first place every subsystem (LLM, prompts, RAG, memory, tools, LangGraph
interrupts) has to work correctly together under a real business constraint (atomic claiming). Building it
earlier would mean building all those subsystems inline and untested.

## Dependencies

Stage 4 (RAG, for the semantic shortlist), Stage 7 (tools, for the Node round trip), Stage 8 (the
`captain_agent` scaffold + working `interrupt()` support).

## Data prerequisite — 🔵 your side, needed before this stage's AI logic can run for real

New Prisma model (source: the "Final Groups and Project Registration" data already in `data/`):
```prisma
model ProblemStatement {
  id            String  @id @default(cuid())
  code          String  @unique
  title         String
  description   String
  domain        String
  core          String
  sector        String
  type          String        // "hardware" | "software" | "hardware+software"
  difficulty    String?
  requiredSkills String[]     @default([])
  sourceOrg     String?
  status        String  @default("available")   // available | claimed | taken
  claimedByTeamId String?
  claimedAt     DateTime?
  lockExpiresAt DateTime?      // TTL soft-lock while captain deliberates
  uniquenessNotes String?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}
```
🔵 Node endpoints (transactional — this is the safety-critical part):
- `GET  /internal/problems?status=available&domain=&core=&sector=&type=`
- `POST /internal/problems/:id/claim {teamId}` — atomic `available → claimed` inside a DB transaction, sets
  `lockExpiresAt`; returns **409** if already claimed/taken. A sweeper job releases expired soft-locks back
  to `available`.
- `POST /internal/problems/:id/register {teamId, thesis}` — `claimed → taken`, creates the `Project` row.

This stage's Python code can be developed against a stubbed version of these endpoints, but the atomicity
guarantee only actually holds once the real transactional implementation lands — flag this dependency
clearly to whoever is building the Node side.

## Files to create

```
app/schemas/problem.py                     # ShortlistRequest/Response, FinalizeRequest, CandidateModel
app/api/problem_selection.py               # POST /problem-selection/{shortlist,chat,finalize}
app/agents/captain_agent.py                # (extends Stage 8 scaffold) full subgraph nodes below
app/tools/backend/problem_tools.py         # claim_problem_statement, register_project
```
(Prompts `skills/problem_shortlist.md` and `skills/problem_uniqueness.md` already exist from Stage 2 — this
stage is where they're actually called with real data for the first time.)

## Key design details — the captain_agent subgraph, node by node

1. **assemble_team_profile.** Calls `list_team_members(teamId)` (Stage 7 tool) → for each member, their
   `UserSkill` rows (with ranks), their `ssgDomain` (Hardware/Software), their vault `interests.md`
   (Stage 5/6), and their `teamRole` (captain/vice-captain/strategist/member). Produces a structured
   **team-capability profile** — this is the input to the shortlist skill.
2. **fetch_candidates.** `GET /internal/problems?status=available` filtered by the team's inferred type lean
   (hardware/software/hardware+software), `domain`, `core`, `sector`. **Hard rule, enforced here in code, not
   just in the prompt:** the query parameter is always `status=available` — claimed/taken problems are never
   fetched, period. If a candidate the model is discussing flips to `taken` mid-conversation (checked again
   at finalize time), it's dropped and the next-best candidate is pulled in.
3. **semantic_shortlist.** Embed the team-capability profile, hybrid-search `kb_problems` (Stage 4's
   `RagQuery.search`, namespace-scoped, filtered by the same domain/core/sector/type constraints), rerank,
   then run `skills/problem_shortlist.md` (Stage 2) to score fit and produce **exactly 5** ranked candidates
   with per-candidate "why this fits your team" reasoning — this is the "high profile problem statements"
   step from the spec.
4. **converse.** `respond_node` (Stage 8) presents the 5 candidates; the graph calls `interrupt()` and waits
   for the captain's reaction — questions about feasibility, specific members, or a request to see different
   candidates loop back to step 3 with adjusted filters.
5. **uniqueness_pass.** Once the captain is leaning toward one candidate, run `skills/problem_uniqueness.md`
   to produce a concrete **unique approach + unique method + unique value** thesis — the "unique positioning
   & value provider" trait made concrete for this specific problem and this specific team's skills.
6. **finalize.** Calls `claim_problem_statement(teamId, problemId)` (new tool, this stage):
   - **200** → calls `register_project(teamId, problemId, thesis)`; the problem is now `taken`; the decision
     (problem + thesis) is written to the captain's and team's vaults (Stage 5 writer) and indexed into
     `kb_teams` (Stage 4) so it's retrievable later; a `nav.to("project")` UI event is emitted.
   - **409 (conflict)** → tell the captain plainly "another team just took that one," loop back to step 3
     with that problem excluded from the candidate pool.

## Concurrency guarantee (why this design is actually safe)

Availability and single-ownership are enforced **only** by the Node claim endpoint's DB transaction — never
by anything the AI service believes or caches. Two captains racing for the same problem: whichever `claim`
call reaches Postgres first wins the transaction; the second gets a 409 and the AI treats that as ground
truth, re-shortlisting automatically. A problem that becomes `taken` disappears from every other team's
`fetch_candidates` call (because it always filters `status=available`) and therefore from every other
captain's AI conversation — no separate "sync" step needed, because availability is read fresh every time.

## What NOT to build yet

No student-copilot or admin-analyst feature logic (Stage 10) — this stage is scoped entirely to the captain
flow. No weekly-report job.

## Acceptance criteria

- A captain with a real team (skills populated) gets exactly 5 shortlisted candidates, each with a distinct,
  team-specific "why this fits" explanation — not generic boilerplate repeated across candidates.
- Mid-conversation, manually flip one shortlisted problem to `taken` via the Node endpoint directly; the
  captain's next message referencing that problem triggers a graceful "that one was just taken" response
  and a re-shortlist, not a stale reference to it.
- Two simulated concurrent `finalize` calls for the same `problemId` from two different teams: exactly one
  succeeds with a created `Project`; the other receives the 409 path and a coherent re-shortlist — verified
  by actually running both calls concurrently, not just reasoning about the code.
- After a successful `finalize`, the problem statement no longer appears in a fresh `shortlist` call for any
  other team, and the captain's vault (`project.md`) reflects the finalized choice and thesis.
