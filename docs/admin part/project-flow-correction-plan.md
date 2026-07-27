# Implementation Plan — Project Flow Corrections

Covers the three issues raised on the student-side project flow:

1. Project workspace (chat / daily log / AI mentor / execution doc) becomes unreachable after project selection — no permanent sidebar entry, and clicking a project from Team/Projects doesn't navigate there.
2. The "Discussion readiness" score card interrupts the mentor chat instead of living in the unused side space.
3. General polish/verification pass on the above.

Root causes were confirmed by reading the current code (not assumed):

- [client/src/pages/ProjectDetailPage.tsx](client/src/pages/ProjectDetailPage.tsx) **already** renders the full workspace (Execution Document / Daily Log / Team Chat / 15-Day Evaluations / AI Mentor tabs) at route `/projects/:id`. The page itself is fine.
- [client/src/layout/Sidebar.tsx](client/src/layout/Sidebar.tsx) (lines 47-68) has no nav item that points at the student's *own active project*. The `PROJECTS` section only has All Projects / Kanban / Timeline / Team. Once a user navigates away from `/projects/:id`, there is no permanent link back — this is the "disappearing" symptom.
- [client/src/pages/TeamDetailPage.tsx](client/src/pages/TeamDetailPage.tsx) (lines 1139-1208), the "Projects" tab project cards, have **no `onClick`/navigation at all** — clicking a project card in Team → Projects does nothing. Confirmed by reading the JSX; there's no `navigate()` or `<Link>` wrapping the card.
- [client/src/pages/ProjectSelectionChat.tsx](client/src/pages/ProjectSelectionChat.tsx) (lines 674-713), the "Discussion readiness" block is rendered *inline inside the scrolling message list*, appearing/re-rendering after every mentor turn. Because the chat column is a centered `max-w-3xl` box, there's unused horizontal space on wider screens that this panel should live in instead of interrupting message flow.

---

## Part A — Make the project workspace permanently reachable

### A1. Add a persistent "My Project" sidebar entry
**File:** `client/src/layout/Sidebar.tsx`

- Need the signed-in user's active project id to build the link. Today `user` (from `useAppSelector((s) => s.auth.user)`) only exposes `teamId`, not an active `projectId`. Two options (pick one during admin-panel discussion or default to Option 1):
  - **Option 1 (preferred, least backend change):** resolve the active project client-side once on mount via a lightweight endpoint (e.g. `GET /teams/:teamId/projects` — already used by `teamService.getTeamProjects` in TeamDetailPage — take the first non-template project) and cache it in local state/`localStorage`, same pattern as the `unreadCount` polling already in this file.
  - **Option 2:** include `activeProjectId` in the `/auth/me` or login payload so it's available on `user` directly (bigger change, touches `authSlice` + `auth.controller.ts`).
- Add to `navSections` under `PROJECTS`:
  ```ts
  { icon: Rocket, label: 'My Project', to: activeProjectId ? `/projects/${activeProjectId}` : '/projects/recommend' }
  ```
  Mirrors the existing `Team` item pattern (`user?.teamId ? /teams/${user.teamId} : /teams`) at line 58.
- If a user has no project yet, the link should route to `/projects/recommend` (the selection chat) instead of a dead route.

### A2. Fix Team → Projects tab card navigation
**File:** `client/src/pages/TeamDetailPage.tsx` (~line 1139)

- Wrap each project card (or add `onClick`) with `navigate(\`/projects/${p.id}\`)`, matching the `cursor-pointer` + hover affordance already used elsewhere in this file (e.g. `AllProjects.tsx` line 226).
- Keep `stopPropagation()` on the nested repo-link `<a>` and "edit repo link" `<button>` (already present at line 1178) so those don't trigger the navigation.
- Add `hover:border-primary/40 hover:shadow-md transition-all` (or similar) to the card to visually signal it's clickable, consistent with other clickable cards in the app.

### A3. Verify `AllProjects.tsx` catalog cards are intentionally different
- `AllProjects.tsx` browses the *problem-statement catalog* (templates), not a team's own active project — clicking there correctly opens the "Deep View Modal" with a **Select for My Team** action, not a workspace. No change needed here; just confirming this isn't the same bug. `handleSelect` (line 79) still `navigate('/dashboard')` after selection instead of into the workspace — should be changed to navigate into `/projects/:id` of the newly created project once the endpoint returns the created project id, for consistency with `ProjectSelectionChat.confirmSelection` (which does this correctly, line 511-537).

### A4. Regression check
- After A1/A2, click-through test: Team page → Projects tab → click a project card → lands on `/projects/:id` with all 5 tabs visible and functional (Document / Log / Chat / Evaluations / Mentor).
- Confirm sidebar "My Project" stays visible and correctly highlighted (`NavLink` `isActive`) while inside `/projects/:id` and any of its sub-views.

---

## Part B — Fix the readiness score interrupting the mentor chat

**File:** `client/src/pages/ProjectSelectionChat.tsx`

### B1. Move to a persistent side panel instead of an inline message-list block
- Current layout: outer wrapper is `max-w-3xl mx-auto` (line 571) with the chat card at `h-[65vh]` (line 592). On any screen wider than `max-w-3xl` (768px), there is unused space on both sides — the user is pointing at this.
- Restructure the page shell from a single centered column into a two-column grid on `lg+` breakpoints:
  ```tsx
  <div className="max-w-6xl mx-auto my-8 p-6">
    ...header...
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
      <div className="bg-white border ... h-[65vh]"> {/* existing chat card, minus the inline readiness block */} </div>
      {phase === 'mentor' && (
        <aside className="hidden lg:block">
          {/* sticky readiness panel, see B2 */}
        </aside>
      )}
    </div>
  </div>
  ```
- Remove the readiness block currently embedded at lines 675-704 (inside the messages scroll area) — that's what causes it to "interrupt" (it re-renders and shifts scroll position every mentor turn since it's a sibling of the message bubbles).
- On mobile/narrow screens (`<lg`), keep a compact collapsed version above the input bar (small percentage chip) so the feature isn't lost, just not full-card.

### B2. Sticky side panel content
- `<aside>` should use `sticky top-6` so it stays in view while the chat scrolls, containing:
  - The existing readiness % + progress bar (lines 678-688).
  - The checklist chips (lines 690-703).
  - The "I'm ready — generate readiness report" button (lines 705-711), moved out of the message flow into this panel's footer.
- No state/logic changes needed — `readinessScore`, `checklist`, `requestReport` all already exist; this is a pure layout move.

### B3. Keep report/CTA behavior unchanged
- `phase === 'report' && readyToSelect` block (line 715-724, "Select This Project" button) stays inside the chat column, since it's a terminal chat action, not part of the persistent side metrics.

### B4. Verify
- Manually drive the mentor phase and confirm: readiness % and checklist update live in the side panel without the chat scroll position jumping; on mobile, the compact variant still shows current %.

---

## Suggested order of work
1. A2 (card click fix) — smallest, isolated, immediately un-blocks the reported dead-end.
2. B1–B2 (readiness panel relayout) — isolated to one file, no backend changes.
3. A1 (sidebar "My Project" link) — needs the Option 1/2 decision above before implementing.
4. A3 (AllProjects post-select navigation) — small follow-up once A1 confirms the target route shape.

No Prisma schema changes required for this part (`db push` note doesn't apply here — everything above is client-side navigation/layout plus optionally one existing endpoint reused).
