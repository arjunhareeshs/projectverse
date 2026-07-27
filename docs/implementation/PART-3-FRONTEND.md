# PART 3 — Frontend: Selection Flow, Intake Wizard, Document, Log & Chat Sections, Reports, Admin AI

> Prerequisite: `00-OVERVIEW.md` (§3 contracts, §3.6 API table) and completed Parts 1–2.
> Stack facts: React 18 + Vite, Redux Toolkit, Tailwind with HSL design tokens, React Hook Form
> + Zod, React Router, Lucide icons. API access goes through service modules in
> `client/src/services/` (follow the existing service style — inspect one, e.g. the projects
> service, before writing new ones). Types come from `client/src/types/projectLog.ts` (created
> in Part 1) — **do not redefine contract types**.
>
> Design rule: reuse the app's existing components/patterns (option pills from
> `ProjectSelectionChat.tsx`, card/table/badge styles from dashboard pages). No new UI library.
> Match the existing Tailwind token usage; support the app's theming.

## New client files (overview)

```
client/src/services/lifecycle.service.ts     // all /api/lifecycle calls
client/src/services/adminAi.service.ts       // /api/admin/ai/ask
client/src/pages/ProjectWorkspace/           // or extend existing project detail page — see §4
  DocumentTab.tsx
  DailyLogTab.tsx
  ChatTab.tsx
  MentorPanel.tsx
  EvaluationsTab.tsx
  EvaluationReportView.tsx
client/src/components/lifecycle/
  IntakeWizard.tsx  MemberPicker.tsx  DurationStep.tsx  TechnologiesStep.tsx
  SkillGapCard.tsx  FlagBadge.tsx  ScoreTable.tsx
client/src/pages/Admin/AdminAiAssistant.tsx
```

Routing: register new routes alongside existing ones in the router config (find where
`ProjectSelectionChat` and Admin pages are registered and follow that pattern, including role
gating — Admin AI page must be admin-gated the same way other Admin pages are).

---

## 1. Selection chat: category-first step

Modify `client/src/pages/ProjectSelectionChat.tsx` (~844 lines — read it fully first; it is a
step-driven chat with option pills).

- Insert a **new first step**: assistant message "What are you planning to build?" with three
  pills — **Mini Project**, **Final Year Project**, **Research Project** (map to `MINI`,
  `FINAL_YEAR`, `RESEARCH`).
- On pick: call `POST /api/projects/catalog/session/start { category }` (or pass category
  through the flow, matching whichever mechanism Part 1 implemented — check the Part 1 code,
  not just the doc), show the choice as a user bubble, then continue into the existing
  catalog navigation exactly as today.
- Back-navigation: the existing flow supports going back; the category step participates
  (going back to it resets the flow).
- Do not regress existing behaviour: catalog browsing, custom proposal, mentor interview,
  team capacity checks all must still work.

## 2. Intake wizard (post-confirmation)

After the existing finalize/select succeeds, route the user into `IntakeWizard` for the new
project (blocking modal-page or dedicated route `/projects/:id/setup`). Three sequential steps,
each saved immediately via `POST /api/lifecycle/:projectId/intake` (step-discriminated body),
with progress indicator and back support:

1. **Members** (`MemberPicker`): searchable list of registered students (existing users
   endpoint/service — reuse). Multi-select with avatars/skills shown. "Suggest members" button
   → `POST /intake/suggest-members`; render suggestions with the AI's reason, one-click add.
   If response `available: false`, hide the AI button (feature-detect, don't error).
2. **Duration** (`DurationStep`): month stepper + optional start date. On change (debounced)
   call `POST /intake/duration-check`; if an advisory returns, show it as an inline AI callout
   ("For a Mini Project, 8 months is long — consider 2–3 months…") with "keep anyway" /
   "apply suggestion" actions. Advisory never blocks — it advises.
3. **Technologies** (`TechnologiesStep`): tag input for already-decided technologies; optional
   — a clear "skip" affordance.

On wizard completion: call `POST /document/generate`, show a generation progress state
(spinner + staged messages), then land on the **Document tab** (§4). Handle generation failure
with a retry button; if the response is `fallback: true`, show a subtle notice that the AI
service was unavailable and a template plan was produced.

## 3. Execution document screen (`DocumentTab`)

- Render `ExecutionDocContent` as a clean document: the 10 sections in contract order;
  milestones as a table (Milestone | Expected Output | Completion Week); work breakdown with
  percentage bars summing to 100.
- **Download buttons**: "Markdown" and "PDF" hitting `GET /document/download?format=…`
  (anchor-based download honoring the attachment filename).
- **Skills gap** (`SkillGapCard`): from log state `skills.gaps` — per missing skill show which
  members lack it and the matching `learningResources` entry as the "direction to learn".
- Version selector if version > 1; "Regenerate" (team lead/admin) with confirm dialog
  explaining a new version is created and uniqueness is re-checked.
- If no document exists yet (legacy/backfilled projects): empty state with a "Generate
  execution document" CTA (only when intake data is sufficient; otherwise link to the wizard).

## 4. Project workspace tabs: Document / Log / Chat / Evaluations / Mentor

The project already has a detail experience (`ProjectDetailPage.tsx` / team pages). **Extend
it with tabs rather than creating a parallel page** — inspect `ProjectDetailPage.tsx` and
`TeamDetailPage.tsx` first and integrate where the team actually works day-to-day. The five
tabs/sections:

### 4.1 Log (`DailyLogTab`) — the daily work log
- **Entry composer** (top): "What did you do today?" textarea (required), hours (optional),
  blockers (optional), evidence URLs (repeat field — commit links etc.). Submits to
  `POST /daily-log`; if today's entry exists it prefills and saves as an edit (upsert).
  After the 2-day edit window, entries render read-only (mirror the server rule; surface the
  409 politely if hit).
- **Team timeline** (below): entries grouped by date desc; each shows member, work text,
  hours, blockers, evidence links. Filters: member, date range (`GET /daily-logs`).
- **Streak/nudge strip**: per-member count of logged days in the last 7 (from the same list
  data) — makes inactivity visible to the team before the AI flags it.

### 4.2 Chat (`ChatTab`) — real-time team chat
The backend exists (`TeamMessage` + Socket.io) and a chat UI exists (`Chat.tsx` /
`TeamCollaborate.tsx`). **Do not build a second chat stack.** Read the existing chat page,
extract/reuse its message-list + composer for the project's team room, and embed it as this
tab so chat lives next to Log inside the project workspace. Same socket events, same service.
If extraction is genuinely impractical, embed the existing chat component with the team
preselected — but reuse is the requirement; duplicating socket logic is a defect.

### 4.3 Evaluations (`EvaluationsTab` + `EvaluationReportView`)
- Cycle list from `GET /evaluations`: cards per cycle — period, overall/authenticity scores,
  plagiarism-risk badge (LOW green / MEDIUM amber / HIGH red via existing token colors).
- Report view (`GET /evaluations/:reportId`): `ScoreTable` with the six /100 parameters;
  sections for missing work, suspicious behaviour, mentor feedback, next-15-day
  recommendations; per-member participation breakdown.
- Empty state before the first cycle completes ("First AI review runs on <date>").

### 4.4 Mentor (`MentorPanel`)
- Loads `GET /mentor/status`: on-time estimate pill (ON_TRACK / AT_RISK / LIKELY_LATE),
  summary, `FlagBadge` list (type-specific icon + message), suggested next tasks per member,
  learning suggestions for open skill gaps.
- **Ask the mentor**: small chat-style input → `POST /mentor/ask`, rendering Q&A locally
  (no history persistence needed in v1). Feature-detect `available: false` → show "AI mentor
  not configured" quietly.
- Surface the mentor's flag count as a dot/badge on the tab header so problems are visible
  without opening the tab.

### 4.5 Document — §3 above.

## 5. Admin AI assistant (`AdminAiAssistant.tsx`)

New page in the Admin portal (sidebar entry consistent with existing admin nav):
- Chat-style interface: admin asks natural-language questions ("How is Team Nova's smart
  irrigation project progressing?", "Which final-year projects have HIGH plagiarism risk?",
  "Compare Team A and Team B on GitHub activity").
- `POST /api/admin/ai/ask` → render `answer` (markdown-rendered) plus a **provenance strip**:
  chips for each `projectsUsed` entry linking to that project's admin detail view, and the
  `scope` label — this shows the AI answered from specific project log JSONs + GitHub data,
  not everything.
- Keep session history client-side for the visit; show recent questions from
  `AdminChatHistory` if an endpoint for it exists (check the admin module — only wire what the
  server exposes).
- Loading/failure states; degraded-mode message when the server reports AI unavailable.

## 6. State & services

- `lifecycle.service.ts`: typed functions for every §3.6 endpoint used above, using the app's
  existing HTTP client (auth headers/interceptors come from the existing setup — reuse it).
- Redux only where state is shared across tabs (log state + mentor status are good slice
  candidates: fetched once per project visit, invalidated by intake saves, doc generation, and
  daily-log submissions). Local component state for forms. Follow whichever data-fetch pattern
  dominates the codebase (inspect two existing pages before choosing).
- All forms: React Hook Form + Zod schemas matching the server's Zod schemas.

## 7. Definition of done (Part 3)

- [ ] Full happy path clicked through in the browser: new project → category pills → catalog
      chat → confirm → intake wizard (AI suggest + duration advisory shown) → document
      generated → downloaded as MD and PDF → skills-gap directions visible.
- [ ] Daily log: create today's entry, edit it, see teammate entries, filters work; old
      entries read-only.
- [ ] Chat tab works in the project workspace with real-time delivery between two logged-in
      users; no duplicated socket logic (verify by code inspection).
- [ ] Evaluations render a seeded report with correct badges/scores; empty state correct.
- [ ] Mentor panel shows flags/estimate; ask-the-mentor round-trips.
- [ ] Admin AI page answers single/compare/cohort questions with provenance chips; page is
      admin-gated (student gets redirected like other admin pages).
- [ ] Feature-detection: with `GROQ_API_KEY` unset, every AI affordance hides or degrades —
      nothing errors or blocks a flow.
- [ ] Existing pages (selection chat legacy path, dashboard, kanban, teams, admin) unaffected.
- [ ] `npx tsc --noEmit` clean in `client/`; Vite dev server boots; no console errors on the
      new screens.
