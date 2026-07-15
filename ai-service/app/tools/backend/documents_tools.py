from app.tools.backend.node_client import get_node_client
from app.tools.base import audited_tool
from app.integrations.events import emit_ui_event


@audited_tool
async def create_document(title: str, content: str, project_id: str = '') -> dict:
    """Create a new document (e.g. a draft PRD or note), optionally attached to a project."""
    res = await get_node_client().post(
        '/documents', {'title': title, 'content': content, 'projectId': project_id or None}
    )
    emit_ui_event('state.refresh', {'type': 'document'})
    return res

