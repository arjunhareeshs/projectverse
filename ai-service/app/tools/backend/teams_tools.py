from app.core.identity import get_current_identity
from app.tools.backend.node_client import get_node_client
from app.tools.base import audited_tool


@audited_tool
async def list_team_members(team_id: str = '') -> dict:
    """List members of the caller's own team (leave team_id empty to use the caller's team)."""
    target = team_id or get_current_identity().team_id
    if not target:
        return {'error': 'no_team', 'detail': 'No team_id provided and the caller has no team on file.'}
    return await get_node_client().get(f'/teams/{target}/members')


@audited_tool
async def list_teams() -> dict:
    """List all teams in the caller's organization, including their members, domains, and roles.
    Use this when the user asks about teams, who is on what team, who performs a particular role, or domain-specific teams (e.g. cybersecurity team)."""
    return await get_node_client().get('/teams')

