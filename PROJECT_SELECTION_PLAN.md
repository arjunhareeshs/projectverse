# Project Selection Chat — Implementation Plan

## Goal

Replace the current static form-based "New Project" wizard
([ProjectRecommendationWizard.tsx](client/src/pages/ProjectRecommendationWizard.tsx))
with a chat-style, phased flow for selecting or proposing a problem statement.

## Current State (as of this plan)

- Entry point: "New Project" button in [Navbar.tsx](client/src/layout/Navbar.tsx) →
  route `/projects/recommend` → `ProjectRecommendationWizard`.
- Flow: static form (domain, project type, difficulty, interests, techs, career goals) →
  `POST /projects/recommend-catalog` → scored list → team-member modal →
  `POST /projects/catalog/:id/select`.
- Catalog data is `Project` rows with `isTemplate=true, status='CATALOG'`, seeded from
  `Combined_Problem_Statements.xlsx` via
  [seedProblemStatements.ts](server/src/scripts/seedProblemStatements.ts).
- Fields map directly onto the desired hierarchy:

  | Flow step | DB field | Example |
  |---|---|---|
  | Hard / Soft / Hard&Soft | `type` | `Hardware` / `Software` / `Hardware & Software` |
  | Domain | `domain` | "Precision Agriculture" |
  | Subdomain | `sector` | "Smart Irrigation" |
  | Problem statement | `problemStatement` + `problemId` | combined statement text, `H0001` |

- No LLM SDK currently wired into the server (only `axios`). `ai-service` Python
  microservice is deleted from the working tree. Root `.env` has an `OPENAI_API_KEY`
  and `GEMINI_API_KEY` placeholder (both empty).

## Decisions

1. **New problem statements proposed by students, once LLM-validated, are added to the
   shared catalog immediately** (no admin approval gate) — a normal `Project` template
   row (`isTemplate=true, status='CATALOG'`), visible to everyone right away, with a
   generated sequential `problemId` per prefix (H/S/HS).
2. **LLM provider: Groq**, via its OpenAI-compatible chat-completions API
   (`https://api.groq.com/openai/v1/chat/completions`, model configurable via
   `GROQ_MODEL`, default something like `llama-3.3-70b-versatile`). A deterministic
   heuristic fallback (keyword/dedupe checks, canned mentor script) is used when
   `GROQ_API_KEY` is empty, so the feature still works with no key configured.

## Flow

```
A. Static pick   B. Decide         C. Propose new (LLM)      D. Mentor (LLM) → Select
Category ─► Domain ─► Subdomain ─► [Problem statements list]
                                    ├─ like it ──────────────────────────► D. Mentor chat ─► "Select Project"
                                    ├─ back (reverse hierarchy) ─► B/A
                                    └─ propose new ─► LLM validate ─► confirm ─► add to seed ─► D
```

- **Phases A–B are static and click-only.** The chat's questions in these phases are
  hardcoded strings, not LLM calls. Input box is disabled; only chip/button clicks
  advance state.
- A **back-stack** allows reverse hierarchical navigation: subdomain → domain →
  category, with the option to fully restart, at any point before final selection.
- **Phase C (propose new)** activates the LLM: user types a proposed problem statement,
  server validates it against the existing catalog for that domain (novelty,
  qualifiability, correct domain/category), user confirms, then it's persisted to the
  catalog.
- **Phase D (mentor)** activates after a statement is chosen (existing or newly
  proposed): LLM chat asks about implementation plan, main approach, niche/quality
  control, then produces a readiness report. Only after this does the "Select Project"
  button unlock, reusing the existing `catalog/:id/select` endpoint +
  [TeamMemberSelect](client/src/components/projects/TeamMemberSelect.tsx) modal.

## Backend Changes

1. **`server/src/modules/ai/llm.service.ts`** — new Groq-backed helper:
   - `chat(messages)` and `chatJSON(messages, schemaHint)` over `axios`.
   - Reads `GROQ_API_KEY` / `GROQ_MODEL` from env; falls back to a deterministic
     heuristic implementation when the key is absent.

2. **Catalog taxonomy + filtering** (extend
   [project.catalog.controller.ts](server/src/modules/projects/project.catalog.controller.ts)):
   - `GET /projects/catalog/tree` → `{ type → domains → subdomains }` aggregated from
     catalog rows, to drive the click options in phases A/B.
   - Extend `getCatalog` to accept `?type=&domain=&sector=` query filters for the
     problem-statement list shown after subdomain selection.

3. **`POST /projects/catalog/validate-proposal`** — body
   `{ type, domain, sector, proposedStatement }`. Loads existing statements for that
   domain/subdomain, asks the LLM to check: belongs to this subdomain, is novel, is a
   qualifiable/valid scope, category is correct. Returns
   `{ valid, isNovel, isQualifiable, correctCategory, reason, normalizedStatement, suggestedShortName, suggestedDifficulty }`.

4. **`POST /projects/catalog/propose`** — persists a validated + user-confirmed proposal
   as a new catalog `Project` template with a generated `problemId`.

5. **`POST /projects/catalog/mentor`** — body
   `{ templateId, history[], userMessage, mode: "chat" | "report" }`. Drives the D-phase
   conversation and produces the final readiness report.

6. Reuse existing `POST /projects/catalog/:id/select` unchanged for final selection.

7. Register new routes in
   [project.routes.ts](server/src/modules/projects/project.routes.ts).

8. Add `GROQ_API_KEY` / `GROQ_MODEL` to root `.env` and `.env.example`.

## Frontend Changes

- New component: `client/src/pages/ProjectSelectionChat.tsx`, mounted at the existing
  `/projects/recommend` route (no nav changes needed — Navbar button stays as-is).
- Delete `ProjectRecommendationWizard.tsx` once the new component is wired in.
- Chat message model: `{ role: 'bot' | 'user', text, options?: {label, value}[] }`
  rendered as bubbles + clickable chips.
- Step machine: `category → domain → subdomain → problemList → (propose | mentor) →
  report → done`, with the back-stack described above.
- Input box disabled in phases A–B, enabled in C and D.
- First bot message is hardcoded: *"Hi! You're here to select a new project — do you
  want Hard, Soft, or Hard & Soft?"* with 3 chips.
- Domain/subdomain options come from `GET /catalog/tree`; problem list from the
  filtered `getCatalog`.
- Reuse `TeamMemberSelect` at the final select step.

## Build Order

1. LLM helper + fallback.
2. Taxonomy/filter endpoints (`/catalog/tree`, filtered `getCatalog`).
3. Chat UI phases A–B (static, no LLM) end-to-end to reach an existing statement.
4. Mentor endpoint + phase D + wire up Select.
5. Propose/validate endpoint + phase C.
6. Remove old wizard component, confirm route/build.
