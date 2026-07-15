import contextvars
from typing import Any

# Per-turn UI event envelope. `navigate_to`/`open_panel` (Stage 7) never call Node — they append
# here instead, and the agent's SSE loop (Stage 8) drains this into `nav.*`/`panel.*` frames
# interleaved with `text.delta`. A plain list behind a contextvar, mirroring the identity pattern
# in app/core/identity.py — no need for a heavier pub/sub mechanism at this scale (a handful of
# events per conversation turn).
current_event_sink: contextvars.ContextVar[list[dict[str, Any]] | None] = contextvars.ContextVar(
    'current_event_sink', default=None
)


def emit_ui_event(event: str, data: dict[str, Any]) -> None:
    sink = current_event_sink.get()
    if sink is not None:
        sink.append({'event': event, 'data': data})


def emit_browser_progress(step_type: str, target: str, status: str) -> None:
    """Emit a `tool.progress` SSE event for a headed browser step.
    `status` is one of: 'running' | 'done' | 'failed'
    """
    emit_ui_event('tool.progress', {
        'step_type': step_type,
        'target': target,
        'status': status,
    })


def emit_state_refresh(entity_type: str = 'all') -> None:
    """Signal the frontend to re-fetch its data after a write action.
    `entity_type` hints which data slice changed: 'tasks', 'notifications', 'messages', 'all'.
    """
    emit_ui_event('state.refresh', {'type': entity_type})

