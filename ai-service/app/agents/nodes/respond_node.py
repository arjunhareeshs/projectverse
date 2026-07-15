from app.agents.state import AgentState


async def respond_node(state: AgentState) -> dict:
    """Terminal step before END. The answer text was already produced by the last `plan_node`
    call — `LLMProvider` streams tokens internally (ChatGroq's `streaming=True`) regardless of
    whether the caller awaited `.chat()` or `.stream()`, so the SSE adapter (`graph_base.py`) taps
    that token stream directly via LangGraph's `astream_events` rather than this node re-calling
    the LLM. This is the seam for grounding/citation checks against `tool_results`/`rag_context`
    if the prompt's "cite what you used" rule ever needs code-level enforcement, not just prompting.
    """
    return {}
