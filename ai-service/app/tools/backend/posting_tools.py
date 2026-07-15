from app.core.identity import get_current_identity
from app.tools.backend.node_client import get_node_client
from app.tools.base import audited_tool
from app.integrations.events import emit_ui_event


@audited_tool
async def post_team_message(message: str, team_id: str = '') -> dict:
    """Post a message to the caller's team chat/feed (leave team_id empty to use the caller's team)."""
    target = team_id or get_current_identity().team_id
    if not target:
        return {'error': 'no_team', 'detail': 'No team_id provided and the caller has no team on file.'}
    res = await get_node_client().post(f'/teams/{target}/messages', {'message': message})
    emit_ui_event('state.refresh', {'type': 'chat'})
    return res

