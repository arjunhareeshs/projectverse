# Stage 7 — Tools Subsystem: Every Capability as a Tool

> Ref: master plan Part I. This is the largest single-stage surface in the plan because it's the literal
> embodiment of the rule "every functionality of the backend is available as a tool to the LLM."

## Goal

Build the complete tool registry the agents (Stage 8) will bind to the LLM: role-scoped backend-action
tools (wrapping Node), RAG/memory tool wrappers (thin adapters over Stages 4 and 6), web/image search
tools, and Playwright — plus the Node-side contract those backend tools depend on.

## Why this comes seventh

Everything before this stage (LLM, prompts, RAG, memory) is a capability the agent *could* use. Nothing
happens in the product until those capabilities are exposed as callable tools with schemas the LLM can
reason about. This must come before Stage 8 (agents), because a LangGraph node binds a *list of tools* —
that list has to exist first.

## Dependencies

Stage 1 (security/identity, for authenticating outbound calls to Node), Stage 4 (RAG, for `rag_search`),
Stage 6 (memory, for `memory_read`/`memory_traverse`).

## Files to create

```
app/tools/base.py                  # @tool decorator: pydantic args schema, error capture, audit hook
app/tools/registry.py              # ToolRegistry.for_role(role, intent) → list[Tool]
app/tools/backend/node_client.py   # httpx client → Node /internal/*, signs the same HMAC token
app/tools/backend/tasks_tools.py
app/tools/backend/teams_tools.py
app/tools/backend/projects_tools.py
app/tools/backend/notifications_tools.py
app/tools/backend/schedule_tools.py
app/tools/backend/documents_tools.py
app/tools/backend/posting_tools.py
app/tools/backend/navigation_tools.py
app/tools/backend/analytics_tools.py     # admin-only db_query
app/tools/rag_tools.py             # rag_search — wraps Stage 4's RagQuery
app/tools/memory_tools.py          # memory_read / memory_traverse / memory_write — wraps Stages 5–6
app/tools/web/search_tools.py      # DDGS text, site-scoped
app/tools/web/image_tools.py       # DDGS images, ranked + stored
app/tools/web/rerank.py            # rerank web hits with Stage 4's Reranker
app/tools/playwright_tools.py      # browse / act / screenshot, domain allow-listed
```

## Key design details

### `base.py` — the tool contract
Every tool: a pydantic args model (the LLM reads its field descriptions as part of the schema), a
docstring the LLM reads as the tool's purpose, a try/except wrapper that turns backend errors into a
structured `ToolError` the agent can reason about ("problem already claimed" is a *result*, not a crash),
and an audit hook logging `{tool_name, args, identity, result_summary}` for every call — this audit trail is
non-negotiable given the rule "never claim you performed an action you didn't call."

### `registry.py` — role scoping is enforced here, not just in prompts
```python
class ToolRegistry:
    def for_role(self, role: str, intent: str | None = None) -> list[Tool]:
        if role == "ADMIN":
            return [rag_search, memory_traverse, db_query, web_search, image_search, open_panel]
        base = [rag_search, memory_read, memory_write, web_search, image_search, playwright_browse,
                create_task, update_task, assign_task, move_kanban_card, list_tasks,
                read_notifications, mark_notification_read, create_schedule_event,
                post_team_message, create_document, navigate_to, list_team_members]
        return filter_by_intent(base, intent)
```
This is the actual enforcement of "admin has no write/nav/delegate tools" — the prompt in Stage 2 says it,
but this function is what makes it structurally true regardless of what the model tries to do.

### `backend/node_client.py` + the Node-side contract (🔵 your side, listed here for reference)
Every backend tool is a thin wrapper: build args → call one Node `/internal/*` endpoint → return the JSON.
```python
@tool
def create_task(project_id: str, title: str, ...) -> TaskResult:
    """Create a new task in a project's board."""
    return node_client.post("/internal/tasks", {...})
```
Node endpoints this stage assumes exist (🔵 to be built alongside this stage, not before it — they can be
stubbed with mock responses while this stage's Python side is developed):

| Tool | Node endpoint | Reuses |
|---|---|---|
| `create_task` / `update_task` / `move_kanban_card` | `POST/PATCH /internal/tasks[/:id]` | `task.service.ts` |
| `assign_task` | `PATCH /internal/tasks/:id/assign` | `task.service.ts` |
| `list_tasks` | `GET /internal/tasks` | `task.service.ts` |
| `list_team_members` | `GET /internal/teams/:id/members` | `team.service.ts` |
| `post_team_message` | `POST /internal/teams/:id/messages` | `team.service.ts` |
| `read_notifications` / `mark_notification_read` | notifications | `notification.service.ts` |
| `create_schedule_event` | `POST /internal/schedule` | `schedule.service.ts` |
| `create_document` | `POST /internal/documents` | `document.service.ts` |
| `db_query` (admin, read-only) | `POST /internal/analytics/query` | new read service |

`navigate_to` and `open_panel` are the two exceptions that **never** call Node — they append a UI event
(`nav.to`, `panel.open`) to the agent's SSE output stream; the frontend acts on it directly.

### `rag_tools.py` / `memory_tools.py`
Pure adapters — no new logic, just pydantic-schema wrapping over `RagQuery.search` (Stage 4) and
`traversal.traverse` / `Vault.write` (Stages 5–6), so the agent can call them like any other tool.

### `web/search_tools.py`, `image_tools.py`
```python
def web_search(query: str, sites: list[str] = [], k: int = 5, freshness: str | None = None) -> list[WebHit]:
    # DDGS text search, optionally site:-scoped to github.com/linkedin.com/youtube.com/arxiv.org
    # then rerank.rerank(query, hits, top_n=k)
def image_search(query: str, k: int = 5) -> list[ImageHit]:
    # DDGS image search, ranked by resolution/source quality, downloaded to a local/temp image store
```
No API key required (DDGS). Site-scoping is done by appending `site:github.com` etc. to the query string
per requested source, then merging + deduping results before reranking.

### `playwright_tools.py`
`browse(url)`, `act(steps: list[Step])`, `screenshot()`. Headless Chromium. Every call checks the target
domain against `PLAYWRIGHT_ALLOWED_DOMAINS` (Stage 1 config) and refuses out-of-scope domains before
launching a page — this is a hard gate, not a suggestion in the prompt.

## What NOT to build yet

No agent wiring — this stage produces `list[Tool]` objects, it does not decide when they're called (Stage
8). No Feature-1-specific tools (`claim_problem_statement`, `register_project`) — those are built in Stage 9
alongside the Node endpoints they depend on, since they're feature-specific rather than general capability.

## Acceptance criteria

- `ToolRegistry().for_role("ADMIN")` returns a list containing zero write/navigation/posting tools —
  assert this programmatically, not just by inspection, so a future refactor can't silently regress it.
- Call `create_task` against a running (even stubbed) Node `/internal/tasks` endpoint and confirm a real
  task row is created — proves the HMAC-signed round trip works, not just that the Python function returns.
- Call `web_search("hybrid retrieval", sites=["arxiv"])` and confirm results are scoped to arxiv.org and
  reranked (top result changes vs. unreranked raw DDGS order on a query where that's checkable).
- Attempt `playwright_tools.browse("https://not-allowed.example.com")` and confirm it's rejected before any
  browser launches.
- Every tool call in a manual test session appears in the audit log with `{tool_name, args, identity}` —
  confirm nothing is silently unaudited.
