from app.tools.backend.node_client import get_node_client
from app.tools.base import audited_tool


@audited_tool
async def get_project(project_id: str) -> dict:
    """Look up read-only details for a project by id. Does not claim, register, or modify
    anything — see the captain problem-selection flow for that."""
    return await get_node_client().get(f'/projects/{project_id}')


@audited_tool
async def list_projects() -> dict:
    """List all projects in the caller's organization. Useful to find project_id for creating tasks, documents, etc."""
    return await get_node_client().get('/projects')

