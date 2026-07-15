# Playwright UI Automation Agent Tool

## Goal

Implement a **fully integrated Playwright automation tool** that lets the AI agent:
1. Navigate the ProjectVerse frontend in a headless (but optionally visible) Chromium browser
2. Execute real UI actions — click, fill forms, submit — against the live `localhost:7333` app
3. Loop with checkpoints and max-retry limits until an action is confirmed complete
4. Stream live progress back to the user via SSE (`tool.call` / `tool.result` / `nav.to`)

**Example flow:**  
> User says: *"Create a task in Kanban to-do list"*  
> Agent calls `navigate_to('/tasks')` → then calls `ui_action(...)` with steps to click "Add Task", fill title, submit → verifies the DOM shows the card → reports done.

---

## Architecture Overview

```
User Prompt
    │
    ▼
Agent (plan_node) ──tool_calls──► act_node
                                      │
                              ui_action() tool
                                      │
                        ┌─────────────────────────┐
                        │  BrowserSession Singleton│
                        │  (per user_id)           │
                        │  ┌────────────────────┐  │
                        │  │  Chromium Page      │  │
                        │  │  localhost:7333     │  │
                        │  │  auth JWT injected  │  │
                        └──┴────────────────────┴──┘
                                      │
                          Execute step sequence:
                          navigate → wait → click
                          → fill → submit → verify
                                      │
                            Checkpoint loop (max_tries)
                                      │
                            emit tool.progress events to ChatDock
                                      │
                          Return structured result
```

---

## Open Questions

> [!IMPORTANT]
> **Should the Playwright browser be headless or headed (visible)?**  
> - Headless (default): silent background execution  
> - Headed: user sees the browser navigating in real-time  
>
> **How should the agent authenticate in the browser?**  
> - Option A: Inject the JWT from the current session into `localStorage` before navigation  
> - Option B: Auto-login using the user's credentials stored in the session  
> - Option C: Share the existing browser session via CDP (Chrome DevTools Protocol)

---

## Proposed Changes

---

### Component 1 — Browser Session Manager

#### [NEW] `ai-service/app/browser/__init__.py`
#### [NEW] `ai-service/app/browser/session.py`

A **singleton browser session** per `user_id`:
- Launched once per user session, reused across all tool calls
- Injects JWT auth token into `localStorage` before first navigation
- Page is kept alive between tool calls (5-min idle auto-close)

```python
class BrowserSession:
    async def get_or_create(user_id: str, jwt: str) -> Page: ...
    async def close(user_id: str) -> None: ...
```

---

### Component 2 — Core `ui_action` Tool

#### [MODIFY] `ai-service/app/tools/playwright_tools.py`

Replace the read-only `playwright_browse` with:

```python
@audited_tool
async def ui_action(
    steps: list[dict],         # ordered step list
    goal_description: str,     # what success looks like (for verification)
    max_tries: int = 3,        # retry budget
) -> dict: ...
```

**Step Descriptor Schema:**
| Field | Type | Description |
|-------|------|-------------|
| `type` | string | One of: `navigate`, `click`, `fill`, `select`, `submit`, `wait_for`, `read_text`, `screenshot` |
| `selector` | string | CSS selector for the target element |
| `value` | string | Text to type (for `fill`) |
| `url` | string | Route to navigate to (for `navigate`) |
| `timeout` | int | Per-step timeout in ms (default 5000) |

**Execution loop:**
```
for attempt in range(max_tries):
    try:
        for step in steps:
            execute_step(step)
            emit_browser_progress(step, "done")   ← live SSE update
        if verify_goal(goal_description):
            return {"success": True, "steps_done": len(steps)}
    except StepError as e:
        emit_browser_progress(step, "failed")
        if attempt == max_tries - 1:
            return {"error": str(e), "attempt": attempt + 1}
        await asyncio.sleep(1)  # backoff before retry
```

---

### Component 3 — Node Auth Token Endpoint

#### [MODIFY] `server/src/modules/internal/internal.controller.ts`
Add `getBrowserToken` method:
- Validates internal HMAC token
- Returns a short-lived (5-min TTL) signed JWT for the requesting user

#### [MODIFY] `server/src/modules/internal/internal.routes.ts`
Add route: `GET /browser-token`

#### [NEW] `ai-service/app/browser/auth_bridge.py`
Calls Node's `/api/internal/browser-token`, gets a scoped JWT, injects it into the browser's `localStorage` as `pv_token` before first page visit.

---

### Component 4 — Live SSE Progress Streaming

#### [MODIFY] `ai-service/app/integrations/events.py`
Add `emit_browser_progress(step_type, selector, status)`:
- Emits `tool.progress` SSE frames for each step as it executes

#### [MODIFY] `client/src/chat/ChatDock.tsx`
Handle new `tool.progress` SSE event to show a **live step-by-step breadcrumb** in the ChatDock tool indicator card:
```
🌐 Navigating to /tasks...          ✓
🖱️ Clicking "Add Task"...           ✓
✍️ Filling title = "My Task"...     ✓
📤 Submitting form...               ✓
✅ Verified: Task card appears       ✓
```

---

### Component 5 — Registry + System Prompt

#### [MODIFY] `ai-service/app/tools/registry.py`
- Replace `playwright_browse` with `ui_action`
- Add `ui_action` to `_STUDENT_CAPTAIN_TOOLS`

#### [MODIFY] `ai-service/app/prompts/system/core_system.md`
Add `UI Executor` trait:
```
- UI Executor: When a task can be done directly in the frontend (create task, send chat message,
  navigate to a section, post notification), use the ui_action tool with an ordered step plan.
  Always navigate first, then act. Verify completion using a read_text or wait_for step before
  declaring success. Use max_tries=3 and define a clear goal_description.
```

---

## Verification Plan

### Manual Verification

1. **Create Kanban task via AI:**
   - Say: *"Create a task called 'Playwright test' in the Kanban to-do list"*
   - Expected: ChatDock shows step breadcrumbs, Kanban board updates in real time

2. **Mark all notifications read:**
   - Say: *"Go to notifications and mark all as read"*
   - Expected: Agent navigates to `/notifications`, acts, DOM confirms cleared

3. **Post team chat message:**
   - Say: *"Send a message to my team: stand-up at 9am"*
   - Expected: Agent navigates to team chat, types and submits, verifies message in feed

---

> [!NOTE]
> This plan keeps the existing `navigate_to` SSE event for lightweight page navigation (no browser launch overhead) and reserves `ui_action` for cases that need real DOM interaction — form fills, button clicks, and DOM verification.
