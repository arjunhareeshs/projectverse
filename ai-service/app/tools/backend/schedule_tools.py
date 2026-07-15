from app.tools.backend.node_client import get_node_client
from app.tools.base import audited_tool
from app.integrations.events import emit_ui_event


@audited_tool
async def create_schedule_event(title: str, start_time: str, end_time: str, description: str = '') -> dict:
    """Create a schedule/calendar event for the caller. `start_time`/`end_time` are ISO 8601."""
    res = await get_node_client().post(
        '/schedule',
        {'title': title, 'startTime': start_time, 'endTime': end_time, 'description': description},
    )
    emit_ui_event('state.refresh', {'type': 'schedule'})
    return res

