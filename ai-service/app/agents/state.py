from typing import Annotated, Any, TypedDict

from langgraph.graph.message import add_messages


class AgentState(TypedDict):
    """The state every role graph shares. `identity` is a plain dict snapshot of
    `RequestIdentity` — not the pydantic object itself — so the checkpointer's JSON serializer
    never has to special-case an arbitrary model type. Non-serializable service objects (the
    `LLMProvider`, the tool registry, the prompt library) never go in here; nodes close over them
    instead (see `graph_base.make_node_factories`), because this dict is what gets persisted to
    SQLite on every step."""

    messages: Annotated[list, add_messages]
    identity: dict[str, Any]
    intent: str | None
    memory_digest: str
    rag_context: list[dict]
    tool_results: list[dict]
    panel_events: list[dict]
    ui_events: list[dict]
    scratch: dict[str, Any]
