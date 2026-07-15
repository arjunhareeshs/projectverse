# Stage 8 — Agents: LangGraph State Machines

> Ref: master plan Part J. This is where every prior stage (LLM, prompts, RAG, memory, tools) gets composed
> into the three agents that actually serve `/chat`, `/admin/chat`, and the problem-selection endpoints.

## Goal

Build the shared LangGraph scaffolding — state shape, graph nodes, streaming-to-SSE adapter — and the three
role-specific graphs (student, captain, admin) that route a request through context-loading, planning, tool
execution, memory reflection, and a streamed response.

## Why this comes eighth

This is the integration point. Every earlier stage was buildable and testable in isolation precisely so
that by this stage, "wire it together" means composing already-working pieces rather than building and
debugging everything at once. Stage 9 (Feature 1) and Stage 10 (Features 2/3) are thin feature-specific
layers on top of the graphs built here.

## Dependencies

Stages 1 (LLM), 2 (prompts), 4 (RAG), 6 (memory traversal), 7 (tools) — all of them.

## Files to create

```
app/agents/state.py            # AgentState TypedDict + reducers
app/agents/graph_base.py       # build_graph(), SqliteSaver checkpointer, stream() → SSE adapter
app/agents/router.py           # pick graph by role; intent classification for students
app/agents/nodes/context_node.py
app/agents/nodes/plan_node.py
app/agents/nodes/act_node.py
app/agents/nodes/reflect_node.py
app/agents/nodes/respond_node.py
app/agents/nodes/panel_node.py       # admin-only
app/agents/student_agent.py
app/agents/captain_agent.py          # scaffolding only — full problem-selection subgraph is Stage 9
app/agents/admin_agent.py
app/api/chat.py                      # replace Stage 1's throwaway /chat with the real graph
app/api/admin.py                     # POST /admin/chat
```

## Key design details

### `state.py`
```python
class AgentState(TypedDict):
    messages: Annotated[list, add_messages]   # short-term memory, LangGraph-native
    identity: RequestIdentity
    role: str
    intent: str | None
    memory_digest: str          # from Stage 6 traversal
    rag_context: list           # from Stage 4 RagQuery
    tool_results: list
    panel_events: list          # admin only
    ui_events: list             # navigation events
    scratch: dict
```

### `graph_base.py` — shared shape every role graph reuses
```
START → context → plan → act ⇄ (tool loop, back to plan) → reflect → respond → END
```
- **Checkpointing:** `SqliteSaver` keyed by `session_id` — this is where LangGraph gives short-term memory
  "for free": messages persist across turns within a session without any custom code.
- **Interrupts:** `interrupt()` support is part of the base graph (used by `captain_agent` in Stage 9) —
  the base must support pausing mid-graph and resuming from a stored checkpoint, not just linear execution.
- **Streaming adapter:** `stream()` converts LangGraph's native event stream into the SSE frame vocabulary
  used across the whole service: `text.delta`, `tool.call`, `tool.result`, `panel.*`, `nav.*`, `interrupt`,
  `error`, `done`. Every API route that streams a graph (`/chat`, `/admin/chat`, `/problem-selection/chat`
  in Stage 9) calls this one adapter — don't let each route hand-roll its own SSE framing.

### Nodes (`agents/nodes/`)
- `context_node`: calls Stage 6's `traversal.traverse()` → `memory_digest`; if the turn needs documents,
  calls Stage 4's `RagQuery.search()` → `rag_context`.
- `plan_node`: renders the role's system prompt (Stage 2) with `memory_digest`/`rag_context` injected, binds
  the role's tools (Stage 7's `ToolRegistry.for_role`), calls `LLMProvider.chat()` with tools bound, and
  either returns tool calls or a direct answer.
- `act_node`: executes any tool calls from `plan_node`, appends structured results to `tool_results`, loops
  back to `plan_node` until the model stops requesting tools.
- `reflect_node`: calls Stage 5's `writer.extract_and_write()` to persist new facts to the vault; optional
  lightweight self-critique pass before responding.
- `respond_node`: streams the final answer, grounded explicitly in `tool_results` + `rag_context` — the
  prompt enforces "cite what you used," this node is where that gets surfaced as the actual streamed text.
- `panel_node` (admin only): inspects `tool_results` for anything panel-worthy (a `db_query`/`rag_search`
  result set) and converts it into `panel.open`/`context.pull` events appended to `panel_events`.

### `router.py`
```python
def route(identity: RequestIdentity, message: str) -> CompiledGraph:
    if identity.role == "ADMIN": return admin_agent
    if is_captain_problem_intent(message): return captain_agent
    return student_agent
```
For students, a lightweight intent classification (small LLM call or keyword heuristic) narrows the tool
list per turn via `ToolRegistry.for_role(role, intent)` from Stage 7 — keeps the tool list small and the
model focused, rather than binding all 15+ student tools on every single turn.

### The three graphs
- `student_agent.py`: the full base shape, full student tool set.
- `captain_agent.py`: **this stage only scaffolds it** — base shape + a marker for where the
  problem-selection subgraph and `interrupt()` call plug in. The actual subgraph nodes
  (`assemble_team_profile`, `fetch_candidates`, `semantic_shortlist`, `converse`, `uniqueness_pass`,
  `finalize`) are built in Stage 9, which owns Feature 1 end-to-end.
- `admin_agent.py`: base shape with the restricted tool set (Stage 7) and `panel_node` wired in; `act_node`
  here can never touch a write tool because none exist in its bound tool list.

## What NOT to build yet

No Feature-1-specific nodes or endpoints (Stage 9). No weekly-report job or admin panel SSE wiring into a
real frontend contract test (Stage 10) — this stage proves the graphs work with hand-sent test messages.

## Acceptance criteria

- `POST /chat` (student role) for "what are my overdue tasks" results in a real `list_tasks` tool call
  (visible in the audit log from Stage 7) and a streamed answer grounded in that result — not a generic
  answer.
- The same message sent twice in the same `sessionId` shows the second turn has access to the first turn's
  context (checkpointing works) without re-sending history from the client.
- `POST /admin/chat` (admin role) attempting to coerce the model into "create a task for me" results in the
  model explaining it has no such capability this session — not a tool-not-found crash, and not a
  fabricated "done!" response.
- Manually interrupt a `captain_agent` scaffold mid-graph (even with a stub subgraph) and confirm the graph
  actually pauses and can be resumed from the same checkpoint on a follow-up call — proves `interrupt()`
  plumbing works before Stage 9 builds real logic on top of it.
