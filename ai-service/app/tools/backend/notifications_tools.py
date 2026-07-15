from app.tools.backend.node_client import get_node_client
from app.tools.base import audited_tool
from app.integrations.events import emit_ui_event


@audited_tool
async def read_notifications(unread_only: bool = True, limit: int = 20) -> dict:
    """Read the caller's notifications."""
    return await get_node_client().get('/notifications', {'unreadOnly': unread_only, 'limit': limit})


@audited_tool
async def mark_notification_read(notification_id: str) -> dict:
    """Mark a notification as read."""
    res = await get_node_client().patch(f'/notifications/{notification_id}', {'read': True})
    emit_ui_event('state.refresh', {'type': 'notification'})
    return res


@audited_tool
async def create_notification(user_id: str, title: str, body: str) -> dict:
    """Create a notification for a specific user by their user ID."""
    res = await get_node_client().post('/notifications', {
        'userId': user_id,
        'title': title,
        'body': body,
    })
    emit_ui_event('state.refresh', {'type': 'notification'})
    return res


@audited_tool
async def broadcast_notification(team_id: str, title: str, body: str) -> dict:
    """Broadcast a notification to ALL members of a team at once.
    Use this when you need to notify everyone (e.g. 'notify my team about sprint planning tomorrow').
    Leave team_id empty to use the caller's own team.
    """
    from app.core.identity import get_current_identity
    target = team_id or get_current_identity().team_id
    if not target:
        return {'error': 'no_team', 'detail': 'No team_id provided and the caller has no team on file.'}
    res = await get_node_client().post('/notifications/broadcast', {
        'teamId': target,
        'title': title,
        'body': body,
    })
    emit_ui_event('state.refresh', {'type': 'notification'})
    return res


