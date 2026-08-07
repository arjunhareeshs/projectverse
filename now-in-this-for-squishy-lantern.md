# AI-Driven Feature Extraction, Reward Points & Phase Execution for Project Selection

## Context

ProjectVerse already has a surprisingly complete "propose idea" pipeline (`runProposalEvaluation` in
`project.catalog.controller.ts`) that scores a free-text proposal on 7 rubrics, checks for duplicates via
Jaccard similarity + LLM judgement, and extracts catalog metadata — and a parallel "pick an existing catalog
project" pipeline (`checkApproachUniqueness` + `selectProject`) that already gates selection on an
AI-scored uniqueness check of the team's `differentiationApproach`. Both are real, wired end-to-end, and
share one LLM client (`modules/ai/llm.service.ts`, Groq, `chatJSON`/`chatJSONWithMeta` + Zod schema +
deterministic-fallback idiom used consistently across the codebase).

What's missing is everything downstream of "the idea was accepted": there is no multi-perspective validation
(feasibility / effectiveness / student potential / business potential / project potential), no AI-driven
feature extraction with reward points, and no real phase-execution system. The shapes for this were already
*scaffolded* and abandoned: `FeatureAllocationItem` / `TeamShareAllocationItem` /
`ExecutionDocContent.features` / `.teamShare` exist in `shared/projectLog.types.ts` but are never populated
by any engine, and the client already has a full, pixel-complete mockup for this exact feature
(`client/src/components/projects/ProjectExecutionTemplate.tsx`) — "1. Team & Features Allocation" +
"2. Phase-by-Phase Execution Plan & Reviews" tabs, feature table with per-feature points, a 4-phase default
plan, and a "Claim +N Pts to DB" button per phase — but it's pure `useState` with hardcoded
`DEFAULT_FEATURES`/`DEFAULT_PHASES`, and the one real backend call it does make
(`claimPhaseReward`) is a **security hole**: `lifecycle.controller.ts:584-624` awards whatever `points`
value the client sends in the request body, with zero server-side validation that the phase was ever
reviewed. There's also no faculty role that actually exists in the DB (`RoleType` enum is only
`ADMIN | STUDENT`; the `FACULTY_GUIDE` checks scattered in `lifecycle.middleware.ts` are dead code).

This plan wires all of that up for real: extends the existing idea-validation call with multi-perspective
scoring + AI feature extraction (reused for *both* the propose-new-idea path and the pick-existing-project
path, since the user explicitly wants the same extraction+phase-setup for static catalog selections), adds
a real 4-phase execution/approval/reward system backed by new tables instead of a client-trusted integer,
and fixes the missing `FACULTY` role so "faculty approves, then the team claims" is an actual server-enforced
gate rather than a UI label.

**Two design decisions locked in with the user before writing this plan:**
1. **Feature points are a potential/scorecard only** — they calibrate how many points each of the 4 phases
   is worth, but nothing is credited to `User.rewardPoints` until a faculty approves a phase submission.
   This avoids double-crediting and keeps one single source of truth for real rewards.
2. **Add a real `FACULTY` role** to `RoleType`, and use it (alongside `ADMIN`) as the only roles that can
   review/approve phase submissions.

---

## 1. Data model changes

`server/database/prisma/schema.prisma` — additive only, one new migration:

```prisma
enum RoleType {
  ADMIN
  STUDENT
  FACULTY
}

model ProjectFeature {
  id                    String   @id @default(cuid())
  projectId             String
  project               Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  name                  String
  description           String
  importance            String   // 'High' | 'Medium' | 'Low'
  implementationMethod  String?  // e.g. "Custom-trained OCR model", "Direct LLM API call", "PyMuPDF + rule-based cleanup"
  points                Int      // one of 50,100,150,200,250,300 — enforced server-side, never trusted from client
  aiRationale           String?
  addedBy               String   // 'AI' | userId of the student who proposed/edited it
  status                String   @default("ACTIVE") // 'ACTIVE' | 'REMOVED'
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt

  @@index([projectId, status])
}

model ProjectPhase {
  id                    String   @id @default(cuid())
  projectId             String
  project               Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  phaseNumber           Int      // 1-4
  title                 String
  expectedDeliverables  String
  weekTarget            Int
  points                Int      // server-computed at generation time, editable by ADMIN/FACULTY only
  hardwareNote          String?
  status                String   @default("PLANNED") // PLANNED | SUBMITTED | APPROVED | CHANGES_REQUESTED
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt
  submissions           PhaseSubmission[]

  @@unique([projectId, phaseNumber])
}

model PhaseSubmission {
  id             String       @id @default(cuid())
  phaseId        String
  phase          ProjectPhase @relation(fields: [phaseId], references: [id], onDelete: Cascade)
  projectId      String
  submittedById  String
  submissionNote String
  evidenceUrls   Json?        // string[] — repo links, doc links, demo links
  status         String       @default("PENDING") // PENDING | APPROVED | CHANGES_REQUESTED
  reviewedById   String?
  reviewNote     String?
  reviewedAt     DateTime?
  createdAt      DateTime     @default(now())

  @@index([phaseId, status])
}

model RewardTransaction {
  id          String   @id @default(cuid())
  userId      String
  projectId   String?
  source      String   // 'PHASE_APPROVAL' | 'DAILY_LOG' | 'ADMIN_ACHIEVEMENT'
  sourceRefId String?  // e.g. PhaseSubmission.id
  points      Int
  note        String?
  createdAt   DateTime @default(now())

  @@index([userId])
  @@index([projectId])
}
```

Add the inverse relations on `Project` (`features ProjectFeature[]`, `phases ProjectPhase[]`) and on `User`
(`rewardTransactions RewardTransaction[]`).

This also finally gives `User.rewardPoints` an audit trail — today it's a bare `Int` mutated directly from
three different call sites with no history. Going forward, **every** increment to `rewardPoints` (phase
approval now; daily-log +20 and admin achievements can be backfilled later) should insert a matching
`RewardTransaction` row in the same `$transaction` as the `User.update`.

Extend `ProjectLogEventType` in `shared/projectLog.types.ts` with:
`'FEATURE_ADDED' | 'FEATURE_UPDATED' | 'FEATURE_REMOVED' | 'PHASE_SUBMITTED' | 'PHASE_APPROVED' | 'PHASE_CHANGES_REQUESTED'`
so these actions show up in the existing event-sourced project log/timeline for free.

---

## 2. New shared module: `server/src/modules/intelligence/`

A new cross-cutting module (not nested under `projects/` or `lifecycle/`, since it's used by both) housing
everything that reasons about "problem statement → validation → features → phases". Follows the exact
`chatJSON` + Zod schema + deterministic-fallback idiom already used everywhere else in the codebase.

```
server/src/modules/intelligence/
  ideaIntelligence.schemas.ts     — Zod schemas (extends the existing ProposalEvaluationSchema shape)
  ideaIntelligence.service.ts     — validateIdea(), extractOrRescoreFeature(), generatePhasePlan()
  prompts/ideaValidation.prompt.ts
  prompts/featureChange.prompt.ts
  prompts/phasePlan.prompt.ts
```

Move the existing `runProposalEvaluation` (currently inline in `project.catalog.controller.ts:140-301`)
into `ideaIntelligence.service.ts` as `validateIdea()`, extended with the new fields below. The controller
imports it instead of defining it locally — this is the natural home for it now that `selectProject` needs
the same feature/phase generation the propose-idea path uses.

### 2.1 `validateIdea()` — multi-perspective validation + feature extraction

Extends the existing `ProposalEvaluationSchema` additively (nothing existing removed, so
`proposeProblemStatement`'s current consumption of `verdict`/`rubrics`/`extracted`/`duplicate` keeps
working unchanged):

```ts
const PerspectiveScore = z.object({ score: z.number().min(0).max(100), rationale: z.string() });

const FEATURE_POINT_BUCKET = [50, 100, 150, 200, 250, 300] as const;

const ExtractedFeatureSchema = z.object({
  name: z.string(),
  description: z.string(),
  importance: z.enum(['High', 'Medium', 'Low']),
  implementationMethod: z.string(),      // what the student described (train vs API vs script)
  points: z.union(FEATURE_POINT_BUCKET.map((n) => z.literal(n)) as any),
  aiRationale: z.string(),
});

const IdeaValidationSchema = ProposalEvaluationSchema.extend({
  perspectives: z.object({
    feasibility: PerspectiveScore,       // can this team realistically build it?
    effectiveness: PerspectiveScore,     // does it actually solve the stated problem?
    studentPotential: PerspectiveScore,  // learning value / skill-building depth
    businessPotential: PerspectiveScore, // market/adoption/monetization angle
    projectPotential: PerspectiveScore,  // overall ceiling: could this become a standout/startup-worthy project?
  }),
  hardwareConstraints: z.object({
    componentAvailability: z.string(),
    budgetRealism: z.string(),
    integrationComplexity: z.string(),
  }).nullable(),
  features: z.array(ExtractedFeatureSchema).min(1).max(8),
});
```

**Server-side guardrails applied after the LLM call** (same pattern as the existing `isDuplicate` hard
override and `clampMilestoneWeeks`/`validateAndNormalizePercentages` in `docGenerator.engine.ts`):
- Clamp every `points` value to the nearest entry in `FEATURE_POINT_BUCKET`.
- If `sum(points) > 1000`, scale every feature's points down proportionally and re-clamp to the bucket
  (mirrors the existing work-breakdown-percentage normalizer) — the LLM is guided to stay under 1000 but is
  never trusted to enforce it.
- `hardwareConstraints` is required to be non-null when `extracted.type` is `Hardware`/`IoT`/`Hybrid`, and
  forced `null` otherwise (deterministic post-process, not left to the model).

### 2.2 The prompt (`prompts/ideaValidation.prompt.ts`)

This is the "super prompt" — it replaces the current system message in `runProposalEvaluation` with an
extended version. Key additions are the perspectives block, feature-extraction rules, and the explicit
"don't pad feature count" instruction the user asked for (a paper-evaluator idea should get 2 features worth
250-300 each, not 5 filler features worth 60 each):

```ts
export function buildIdeaValidationPrompt(rawText: string, nearest: NearestEntry[]): ChatMessage[] {
  const system = `You are an expert evaluator and technical architect for student engineering project
proposals, reviewing this idea from FIVE independent perspectives before anything else:

1. FEASIBILITY — can a 3-5 person undergraduate team realistically build this in one semester with
   commonly available tools, APIs, and (if hardware) affordable components?
2. EFFECTIVENESS — does the proposed solution actually address the stated problem, or is it a vague
   restatement of the problem with no real mechanism?
3. STUDENT POTENTIAL — how much genuine skill-building (system design, ML, hardware integration, etc.)
   does building this require? Trivial CRUD apps score low here even if "feasible".
4. BUSINESS POTENTIAL — is there a plausible market, user base, or monetization/adoption path if this were
   taken further than a college project?
5. PROJECT POTENTIAL — the ceiling: could this realistically become a standout portfolio piece, publishable
   result, or startup-worthy product with strong execution? This is about upside, not current polish.

Score each perspective 0-100 with a one-sentence rationale grounded in specifics from the proposal text —
never a generic sentence that could apply to any project.

Then extract the FEATURES that make up this project and assign each a reward-point value from EXACTLY this
set: {50, 100, 150, 200, 250, 300}. This is the single most important part of your output — read it twice:

- A "feature" is a distinct, independently buildable capability (e.g. "Resume content extractor",
  "Resume generator with formatting", "ATS compatibility scorer" — NOT "backend", "frontend", "database",
  which are implementation layers, not features).
- DO NOT pad the feature list to hit a target count. A narrow, high-leverage idea (e.g. "AI paper evaluator:
  handwriting extraction + rubric-based scoring") should produce 2-3 features worth 250-300 points each
  rather than 5 diluted features worth 60 points each. A broad idea (e.g. "smart campus platform") may
  genuinely have 6-8 features. Feature COUNT follows the idea's real structure; POINTS follow technical
  depth. Between 1 and 8 features total.
- Points reflect BOTH the feature's value to the product AND how the student says they'll build it
  (implementationMethod). The same feature can be worth very different points depending on the approach:
    * Training/fine-tuning a custom model, building a non-trivial algorithm from scratch, or deep hardware
      integration (custom PCB, sensor fusion, real-time firmware) → 250-300.
    * Meaningful engineering on top of an existing model/library (prompt-engineered pipelines, non-trivial
      OCR post-processing, a tuned traditional ML model) → 150-200.
    * Calling a hosted API/LLM directly with light glue code, or using a library close to out-of-the-box
      (e.g. "PyMuPDF extraction with a few field adjustments") → 50-100.
  If the student hasn't described HOW they'll build a feature yet, infer the most likely default approach
  from context and note that assumption in aiRationale.
- Total points across all features MUST NOT exceed 1000. If your natural scoring would exceed it, scale the
  weaker features down rather than every feature uniformly — the standout feature should stay near its true
  value.

If the project type is Hardware, IoT, or Hybrid, ALSO fill hardwareConstraints:
- componentAvailability: are the implied components (sensors, actuators, MCUs, etc.) realistically sourceable
  by a student team, or exotic/expensive/import-only?
- budgetRealism: is a typical student project budget (roughly ₹3,000-₹15,000 unless the proposal states
  otherwise) plausible for what's described?
- integrationComplexity: soldering/PCB/firmware/real-time constraints the team should be warned about.
For pure Software proposals, hardwareConstraints must be null — do not invent hardware concerns.

[... existing rubric + duplicate + extracted JSON contract from the current prompt is preserved unchanged,
with "perspectives", "hardwareConstraints", and "features" added to the JSON shape ...]`;

  return [
    { role: 'system', content: system },
    { role: 'user', content: JSON.stringify({ rawText, nearestCatalogEntries: nearest }) },
  ];
}
```

Implementation note: keep the existing rubric/duplicate/extracted JSON contract text from
`project.catalog.controller.ts:224-255` verbatim inside this prompt (just append the new sections) — it's
already been hardened by a real bug fix (the comment about the model inventing a wrapper object), no reason
to rewrite working prompt engineering.

### 2.3 Single-feature re-scoring on add/edit (`prompts/featureChange.prompt.ts`)

This is the trigger the user described explicitly: *"if in execution they add or change a feature, the LLM
node must be triggered with the stored problem statement paragraph plus the new/modified feature, and the
potential + reward points must be found again."*

```ts
const FeatureChangeSchema = z.object({
  points: z.union(FEATURE_POINT_BUCKET.map((n) => z.literal(n)) as any),
  importance: z.enum(['High', 'Medium', 'Low']),
  aiRationale: z.string(),
  duplicateOfFeatureId: z.string().nullable(),   // flags near-duplicate of an existing feature
});
```

Prompt input: `Project.problemStatement` (the stored paragraph — already a field on `Project`, no new
storage needed), `Project.type`/`hardwareComponents` for hardware framing, the list of the project's other
ACTIVE `ProjectFeature` rows (for duplicate-avoidance and remaining-budget context), and the proposed
feature's `{ name, description, implementationMethod }` from the student.

System prompt (short — this is a single-feature judgement call, not a full evaluation):

```
You are scoring ONE feature being added to an already-accepted student project. You are given the
project's original problem statement, its current feature list with their existing point values, and the
new/edited feature the student is proposing.

Score it using the same rules as initial feature extraction: points from {50,100,150,200,250,300} based on
technical depth AND the described implementation method (trained/custom-built > tuned-existing >
direct-API/library-default). If this feature substantially duplicates an existing one in the list, set
duplicateOfFeatureId to that feature's id and score it low (50) — do not let two features double-count the
same capability.
```

**Server-side budget enforcement** (`ideaIntelligence.service.ts`): compute
`remaining = 1000 - sum(other ACTIVE features' points)`. If the AI-scored `points` exceeds `remaining`,
clamp down to the nearest bucket value ≤ `remaining` (minimum 50; if `remaining < 50`, reject the add with a
clear "feature budget exhausted, remove or shrink another feature first" error rather than silently
awarding 0). Return `{ ...result, budgetClamped: boolean }` to the client so the UI can show why the number
differs from what the AI initially reasoned.

### 2.4 Phase plan generation (`prompts/phasePlan.prompt.ts`)

Runs once, right after a project is created (both from a fresh proposal publish AND from a catalog
selection — see §3), using the now-finalized feature list.

Output shape (matches `PhaseExecutionItem` already designed in the client mockup, so no client-side
reshaping is needed):

```ts
const PhasePlanSchema = z.object({
  phases: z.array(z.object({
    phaseNumber: z.number().int().min(1).max(4),
    title: z.string(),
    weekTarget: z.number().int().min(1),
    expectedDeliverables: z.string(),
    points: z.number().int().min(50),
    hardwareNote: z.string().nullable(),
  })).length(4),
});
```

System prompt:

```
Generate the 4 mandatory execution-review phases for this student project. Every project — software or
hardware — goes through exactly these 4 checkpoints, but WHAT counts as the deliverable at each checkpoint
depends on project type:

Phase 1 — Planning & Architecture: a complete implementation plan (system architecture, chosen stack, data/
API/circuit design) plus a first slice of working code for at least one low-risk feature. For Hardware/IoT
projects, substitute "working code" with a concrete component/BOM selection and circuit schematic, or an
early breadboard-level improvement over the baseline design.
Phase 2 — Initial Implementation: visible, running progress on the highest-priority features — partial but
real functionality, not just planning artifacts. For hardware, this is firmware/sensor-loop progress on the
breadboard build.
Phase 3 — Base Prototype: a working end-to-end prototype covering the core feature set, even if rough at
the edges. For hardware, this is the assembled physical prototype with its main sensing/actuation loop
functioning.
Phase 4 — Full-Grade System: the complete, polished, demo-ready system — all committed features present,
tested, and (for hardware) in a finished enclosure/field-ready state.

Distribute `points` across the 4 phases proportional to how much of the total feature-potential
(sum of feature points = ${featureTotal}) each phase is expected to deliver. Typical shape: Phase 1 ~15%,
Phase 2 ~30-35%, Phase 3 ~30-35%, Phase 4 ~15-20% of a total phase-reward pool roughly double the feature
total (so a ${featureTotal}-point feature plan yields a phase pool around ${featureTotal * 2}). Space
weekTarget values sensibly across the project's duration (${weeks} weeks total).
```

Server-side guardrails: enforce exactly 4 phases with `phaseNumber` 1-4 (re-derive if the model returns
fewer/more — same defensive pattern as `clampMilestoneWeeks`), and re-normalize `points` so they don't
wildly exceed the `featureTotal * 2` guidance (soft cap, not hard-clamped, since phase rewards are reviewed/
editable by ADMIN/FACULTY before they're ever claimable anyway).

---

## 3. Endpoint changes

### Extended (existing routes, additive response fields / new side effects)

- **`POST /proposals/evaluate`, `POST /projects/catalog/validate-proposal`** (preview, unauthenticated
  scoring) → now call `ideaIntelligence.validateIdea()`; response gains `perspectives`, `hardwareConstraints`,
  `features[]` alongside the existing `verdict`/`rubrics`/`duplicate`/`extracted`.
- **`POST /proposals/`, `POST /projects/catalog/propose`** (`proposeProblemStatement`) → after the existing
  `Project` + `ProblemStatementProposal` creation, inside the same `$transaction`: bulk-insert
  `ProjectFeature` rows from `extracted.features` (`addedBy: 'AI'`), then call
  `ideaIntelligence.generatePhasePlan()` and insert the 4 `ProjectPhase` rows.
- **`POST /projects/catalog/:id/select`** (`selectProject`) → after the existing child-`Project`
  creation (still inside its advisory-locked transaction), run the SAME feature-extraction +
  phase-generation using `template.problemStatement + "\n\nTeam's unique approach:\n" + differentiationApproach`
  as the combined context, persisted against the new child project's id. This is the "same extraction of
  feature and phase-wise setup" the user asked for on the static-project path — it reuses
  `ideaIntelligence.validateIdea()`'s feature-extraction half (not the duplicate/verdict half, which was
  already resolved by `checkApproachUniqueness`) plus `generatePhasePlan()`.

### New — `server/src/modules/lifecycle/` (features & phases live alongside the existing intake/doc/daily-log
routes since they're all per-project execution concerns, guarded by the same `requireProjectAccess`):

| Method & path | Guard | Behavior |
|---|---|---|
| `GET /:projectId/features` | `requireProjectAccess` | List ACTIVE `ProjectFeature` rows + running point total |
| `POST /:projectId/features` | `requireProjectAccess` | `{ name, description, implementationMethod }` → runs featureChange prompt → creates row, appends `FEATURE_ADDED` |
| `PATCH /:projectId/features/:featureId` | `requireProjectAccess` | Same fields → re-runs featureChange prompt → updates row, appends `FEATURE_UPDATED` |
| `DELETE /:projectId/features/:featureId` | `requireProjectAccess` | Soft-delete (`status: REMOVED`), appends `FEATURE_REMOVED` |
| `GET /:projectId/phases` | `requireProjectAccess` | List phases with latest submission status |
| `POST /:projectId/phases/:phaseId/submit` | `requireProjectAccess` | `{ submissionNote, evidenceUrls[] }` → creates `PhaseSubmission(PENDING)`, `phase.status = SUBMITTED`, appends `PHASE_SUBMITTED`, notifies ADMIN/FACULTY |
| `POST /:projectId/phases/:phaseId/review` | `requireRole(['ADMIN','FACULTY'])` | `{ decision: 'APPROVED'\|'CHANGES_REQUESTED', reviewNote }`. On APPROVED: single `$transaction` that reads `phase.points` (never from the request body), splits it across active team members by their `TeamShareAllocationItem.sharePercent` (equal split if no share data), inserts one `RewardTransaction` per member + increments each `User.rewardPoints`, sets `submission.status`/`phase.status = APPROVED`, appends `PHASE_APPROVED`. On CHANGES_REQUESTED: resets both statuses, appends `PHASE_CHANGES_REQUESTED`, notifies the team with `reviewNote`. |

**Remove** `POST /:projectId/claim-phase-reward` (`lifecycle.controller.ts:584-624`) entirely — it's the
client-trusted hole this whole system replaces. Its one caller
(`ProjectExecutionTemplate.tsx:handleClaimPhaseReward`) is rewired in §5.

### Faculty role provisioning

Check `admin.service.ts`/`admin.controller.ts` for an existing user-role-update endpoint; if none exists,
add a minimal `PATCH /admin/users/:userId/role` (`requireRole('ADMIN')`) accepting `{ role: 'ADMIN'|'STUDENT'|'FACULTY' }`
so admins can promote a user to `FACULTY` — this is the only way the new role becomes usable.

---

## 4. Hardware constraints — how they actually get modeled

Hardware isn't a separate code path bolted on afterward; it's a context flag threaded through the same
prompts, matching how `Project.type`/`hardwareComponents`/`budgetEstimateInr` already exist on the schema
but are currently unused by any scoring logic (confirmed — today they only affect the `H`/`S`/`HS` catalog-id
prefix). Concretely:

- **Feasibility perspective** (§2.2) explicitly reasons about component sourcing and budget for
  Hardware/IoT/Hybrid types.
- **`hardwareConstraints`** block (componentAvailability / budgetRealism / integrationComplexity) is only
  populated for non-Software types — this is where "think about constraints in building a project" lives.
- **Feature `implementationMethod` vocabulary** naturally shifts for hardware (e.g. "custom PCB + firmware"
  vs "breakout board + vendor library") — the prompt doesn't need hardware-specific feature rules because
  the same depth-of-build heuristic (trained/custom > tuned-existing > off-the-shelf) already applies.
  `budgetEstimateInr` is passed into context so the model can sanity-check "custom PCB" against a ₹3,000
  budget and flag the mismatch in `aiRationale` rather than silently awarding 300 points to something that
  can't actually be built.
- **Phase deliverables** (§2.4) are explicitly branched per phase in the prompt text itself (breadboard →
  assembled prototype → field-ready build) rather than as a hardcoded if/else in TypeScript — this keeps
  one phase-generation code path for both project types, consistent with how `docGenerator.prompt.ts`
  already handles Hardware/Software/interdisciplinary projects with one shared prompt.

---

## 5. Client changes

- **`client/src/pages/ProposeProblem.tsx`** (+ `proposal.service.ts` types): render the new `perspectives`
  block (5 score cards — Feasibility/Effectiveness/Student/Business/Project Potential) and a `features[]`
  preview table with points, above the existing verdict/rubric display, before the student confirms publish.
- **`ProjectDetailModal.tsx`**: no structural change to the claim flow itself (`checkApproachUniqueness` →
  `selectProject` stays as-is) — after a successful `selectProject`, route into
  `ProjectExecutionTemplatePage` where features/phases are now real, freshly-generated data instead of an
  empty template.
- **`client/src/components/projects/ProjectExecutionTemplate.tsx`** — the mockup becomes real:
  - Replace `DEFAULT_FEATURES`/`DEFAULT_PHASES` local state seeding with `GET :projectId/features` and
    `GET :projectId/phases` fetched on mount.
  - "Add Feature" modal gains an `implementationMethod` text field (currently missing); the `points` field
    becomes AI-suggested/read-only after the featureChange call resolves, with the `aiRationale` shown
    inline (mirrors how `checkApproachUniqueness`'s `reason`/`suggestions` are already surfaced elsewhere).
    Same for editing an existing feature.
  - `handleClaimPhaseReward` → replaced with a submission flow: a small form (note + evidence links) posts
    to `POST :projectId/phases/:phaseId/submit`; the button becomes "Submit for Faculty Review" while
    `PLANNED`, "Pending Faculty Review" while `SUBMITTED`, and "Approved — +N pts awarded" once `APPROVED`
    (driven by real `ProjectPhase.status`/`PhaseSubmission.status`, not the current local `claimedPhases`
    state).
- **New minimal faculty-review surface**: a page/tab (e.g. `client/src/pages/Admin/PhaseReviewPage.tsx`,
  visible to ADMIN/FACULTY only, following the existing admin routing pattern) listing PENDING
  `PhaseSubmission`s with Approve / Request-Changes actions calling the new `/review` endpoint.

---

## 6. Verification

- `npx prisma migrate dev` for the new models/enum value; confirm `prisma generate` picks up the new
  `RoleType.FACULTY` and new models without breaking existing seed scripts (`scripts/seed.ts` etc. only
  ever write `ADMIN`/`STUDENT`, so they're unaffected).
- With `GROQ_API_KEY` unset, exercise the full flow (propose → publish, and catalog select) and confirm the
  deterministic fallbacks produce valid `perspectives`/`features`/phase plans (same "degrade gracefully"
  guarantee every other engine in this codebase has) — this is the fast path to test without burning API
  calls.
- With a key configured: propose a narrow, high-leverage idea (e.g. the paper-evaluator example) and confirm
  the model returns 2-3 high-point features rather than 5 padded ones; propose a broad idea and confirm more
  features, lower average points, total ≤ 1000.
- Add a feature via the execution UI describing a "trained model" approach vs a "direct API call" approach
  for otherwise-identical feature text, and confirm the point values differ as expected.
- Submit a phase as a STUDENT and confirm a non-FACULTY/ADMIN user gets 403 on `/review`; approve as
  FACULTY and confirm `User.rewardPoints` increments correctly split across team members and a
  `RewardTransaction` row is written; confirm the old `/claim-phase-reward` route is gone (404/removed) and
  the client no longer calls it.
- Manually run the ProjectExecutionTemplate page end-to-end in the browser (dev server) to confirm the
  feature/phase tables render real server data and the submit → pending → approved status transitions show
  correctly.
