from app.tools.backend.node_client import get_node_client
from app.tools.base import audited_tool


@audited_tool
async def db_query(query_type: str, filters: dict[str, str] = {}, limit: int = 20) -> dict:  # noqa: B006
    """(Admin, read-only) Run a predefined structured analytics query against the platform
    database — e.g. query_type='top_students' or 'team_health'. Never writes anything."""
    return await get_node_client().post('/analytics/query', {'queryType': query_type, 'filters': filters, 'limit': limit})
