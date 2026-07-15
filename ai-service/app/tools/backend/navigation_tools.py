from app.integrations.events import emit_ui_event
from app.tools.base import audited_tool


@audited_tool
async def navigate_to(route: str, params: dict[str, str] = {}) -> dict:  # noqa: B006 — never mutated
    """Tell the frontend to navigate the user to a specific route/page. Never calls Node — this
    emits a `nav.to` UI event on the response stream that the client applies directly."""
    emit_ui_event('nav.to', {'route': route, 'params': params})
    return {'event': 'nav.to', 'route': route}


@audited_tool
async def open_panel(panel: str, context: dict = {}) -> dict:  # noqa: B006 — never mutated
    """(Admin) Open the context panel to a specific view with a data payload. Never calls Node —
    this emits a `panel.open` UI event the client applies directly."""
    emit_ui_event('panel.open', {'panel': panel, 'context': context})
    return {'event': 'panel.open', 'panel': panel}
