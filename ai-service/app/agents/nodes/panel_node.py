from app.agents.state import AgentState
from app.integrations.events import emit_ui_event

_PANEL_WORTHY_TOOLS = {'db_query', 'rag_search', 'memory_traverse'}


async def panel_node(state: AgentState) -> dict:
    """(Admin only) Inspects this turn's `tool_results` for anything panel-worthy and converts it
    into `panel.open` UI events — the panel "opens only when there's data worth showing," not on
    every turn, so this only fires for read/analysis tools that actually returned data."""
    panel_events = list(state.get('panel_events', []))
    for entry in state.get('tool_results', []):
        result = entry.get('result')
        if entry.get('tool') in _PANEL_WORTHY_TOOLS and isinstance(result, dict) and 'error' not in result:
            event_data = {'panel': entry['tool'], 'context': result}
            panel_events.append(event_data)
            emit_ui_event('panel.open', event_data)
    return {'panel_events': panel_events}
