# Plan — Chat-Driven Project Selection on Real Catalog Data

## 0. Guiding principle

Project selection is a **conversational process in the chat** ([ProjectSelectionChat.tsx](client/src/pages/ProjectSelectionChat.tsx),
reached from the navbar **New Project → `/projects/recommend`**). The user is
walked through the decision tree — **Category → Domain → Subdomain → Problem
Statement** — one step at a time with option pills. It must **never** dump a
blind static dropdown or a giant flat list. The old static screens
(`/projects` browse grid, `/projects/propose` form) become the secondary
"propose / browse" path, not the primary entry.

The chat's decision tree is only as good as the data behind it. Today the data
is wrong, so the chat has nothing correct to walk through. Fixing the data is
Phase 1; wiring the chat to it is Phase 3.

---

## 1. Root-cause diagnosis (verified against the live DB)

| Aspect | In DB now (wrong) | Source of truth: `data/Combined_Problem_Statements.xlsx` |
|---|---|---|
| Catalog rows (`isTemplate=true, status=CATALOG`) | **443** | **1436** |
| Distinct domains | **2** — `AI` (394), `General` (49) | **26** (AgriTech, Biomedical & HealthTech, Mechanical & Manufacturing, GovTech / e-Governance, AI/ML, Web Development, …) |
| Sector / Niche | all `"Technology"` | real niches (Precision Farming / Smart Irrigation, Water Resources, Livestock / Dairy, …) |
| Problem IDs | `2026ODD5`, `2026ODD6`, … | `H0001`, `S0001`, `HS0001`, … |
| Names | fabricated ("LearnFlow", "CuraNet") | real SRP short names |
| Category split | — | Soft 1034 / Hard 311 / Hard & Soft 91 |

**Conclusion:** the 443 rows are a rogue dataset (no seed script in the repo
produces `2026ODD*` IDs — it was imported manually/externally). The correct
adapter, [seedProblemStatements.ts](server/src/scripts/seedProblemStatements.ts),
was never successfully applied against this DB. That is why the chat/browse
groups everything under one **"AI"** bucket.

**Secondary bugs (independent of the data):**
- [ProjectProposalForm.tsx:170-177](client/src/components/projects/ProjectProposalForm.tsx#L170-L177)
  — Domain `<select>` is **hardcoded** to 6 fake domains.
- [AllProjects.tsx:83-111](client/src/pages/AllProjects.tsx#L83-L111) — groups
  by `domain` only, ignores `sector`; type bucketing exists but has nothing to
  bucket while all rows are `AI`.

### Excel → DB column adapter (the mapping)

Sheet: **`All Problem Statements`** (ignore the `Summary` sheet).

| Excel column | `Project` field | Transform |
|---|---|---|
| `Problem ID` | `problemId` | trim; unique key |
| `Category (Hard/Soft/Hard&Soft)` | `type` | `Hard→Hardware`, `Soft→Software`, `Hard & Soft→Hardware & Software` |
| `Domain` | `domain` | trim |
| `Sector / Niche` | `sector` | trim |
| `Short Name` | `name` + `shortName` | trim; fallback to `problemId` |
| `Difficulty (0-4)` | `difficultyLevel` | coerce to string `"0".."4"` |
| `Problem Statement` | `problemStatement` | trim |
| `Source File` | — | ignored |
| (constant) | `status` | `"CATALOG"` |
| (constant) | `isTemplate` | `true` |
| (from org) | `organizationId` | first org |

---

## 2. Phase 1 — Data layer: column adapter + safe re-seed

Harden [seedProblemStatements.ts](server/src/scripts/seedProblemStatements.ts):

1. **Explicit column map** exactly as the table above (single `COLUMN_MAP`
   object so column drift is a one-line change).
2. **Idempotent upsert** keyed on `problemId`; coerce difficulty; trim all
   strings; skip rows with empty `Problem ID`.
3. **Purge the rogue rows — safely.** Delete catalog templates whose
   `problemId` does **not** match `^(H|S|HS)\d+$`, **but only when the template
   has zero `childProjects`** (no team has selected it). Any rogue template that
   *is* already selected by a team is **left in place and printed to a report**,
   never deleted.
4. **Add npm script** to [server/package.json](server/package.json):
   `"seed:catalog": "ts-node src/scripts/seedProblemStatements.ts"`.
5. Delete/neutralise the junk one-off [seed-catalog.ts](server/seed-catalog.ts)
   (creates a single fake "AI & Machine Learning" template) so it can't be run
   by mistake.

**Acceptance:** after `npm run seed:catalog` the DB has 1436 catalog templates,
26 domains, correct category→type counts, and **zero** rows with
`domain ∈ {AI, General}` + `sector = Technology` (except any that were retained
because a team already selected them — listed in the report).

---

## 3. Phase 2 — Backend

- **Reuse** the existing tree endpoint
  [`GET /projects/catalog/tree`](server/src/modules/projects/project.catalog.controller.ts#L96)
  — it already returns `type → domains → subdomains` aggregated from distinct
  DB values. No new endpoint required; once the data is correct it returns the
  real 3 types → 26 domains → sectors.
- `GET /projects/catalog?type=&domain=&sector=` already filters correctly for
  the chat's problem-list step — no change.
- Verify the tree groups `sector` per domain (it does, via the `Set` in
  `getCatalogTree`).

---

## 4. Phase 3 — Frontend: make the chat the real process

### 4a. ProjectSelectionChat (primary — must be correct)
- Already consumes `/catalog/tree` and `/catalog` — with fixed data it now walks
  the **real** Category → Domain → Subdomain → Problem Statement tree. Verify:
  - Category pills map to the 3 real `type` values.
  - Domain/Subdomain pills render from the tree (26 domains, real sectors).
  - Problem list step fetches by `type+domain+sector` and shows real statements.
- Fix the category pill labels (`Hard`/`Soft` → **Hardware**/**Software**/
  **Hardware & Software**) to match `type` values used for filtering.
- Confirm Phase-2 back-navigation and the Phase-4 mentor/report still work on
  real templates (they key off `templateId`, so they will).

### 4b. AllProjects (secondary browse) — de-blind it
- Group by real `domain`, then **sub-group by `sector`** so the 26 domains and
  their niches render instead of one "AI — N items" blob
  ([AllProjects.tsx:83-111](client/src/pages/AllProjects.tsx#L83-L111)).
- Keep type tabs; ensure `Hardware & Software → Combination` bucket label.

### 4c. ProjectProposalForm (secondary propose) — kill the hardcoded dropdown
- Replace the 6 hardcoded `<option>`s
  ([ProjectProposalForm.tsx:170-177](client/src/components/projects/ProjectProposalForm.tsx#L170-L177))
  with domains fetched from `/catalog/tree` on mount; optional dependent Sector
  select. This is the *propose custom* path — the chat remains the default.

---

## 5. Phase 4 — Test & verification

Add `server/src/scripts/verifyCatalog.ts` (or a jest test) that asserts:

1. `count({isTemplate, status:CATALOG}) === 1436` (± retained rogue rows, logged).
2. Distinct domains `=== 26`; **no** row with `domain ∈ {AI, General} & sector = Technology`.
3. Category→type counts: Software 1034, Hardware 311, Hardware & Software 91.
4. `GET /catalog/tree` returns 3 types, 26 domains, sectors populated.
5. `GET /catalog?type=Hardware&domain=AgriTech&sector=…` returns only matching
   real statements.

**Manual smoke test (the chat process):**
New Project → chat greets → pick **Hardware** → real domains appear → pick
**AgriTech** → real subdomains → pick one → real problem statements list →
select → mentor interview → readiness report → confirm → dashboard.

**Existing harness:** re-run
[server/tests/project-selection-chat/run.ts](server/tests/project-selection-chat/run.ts)
against the reseeded data.

---

## 6. Execution order

1. Phase 1 seed hardening + `seed:catalog` script.
2. Run seed (⚠️ deletes unselected rogue rows) → run Phase-4 verify script.
3. Phase 3a chat verification/label fix.
4. Phase 3b + 3c static-page fixes.
5. Full manual smoke test of the chat flow.

## 7. Risks / decisions

- **Destructive:** re-seed deletes the 443 rogue rows (only those with no team
  selections). Any rogue template a team already picked is preserved + reported.
  → Confirm before running, or seed 1436 alongside first for a visual diff.
- **Org scoping:** seed attaches to the first organization; multi-org needs a
  target-org flag.
- **Duplicate `problemId`:** unique constraint already on `Project.problemId`;
  upsert handles re-runs idempotently.
