import logging
from datetime import datetime

from fastapi import APIRouter, Depends, Request
from sse_starlette.sse import EventSourceResponse

from app.agents.captain_agent import (
    assemble_team_profile_node,
    fetch_candidates_node,
    make_semantic_shortlist_node,
)
from app.agents.graph_base import run_chat_turn
from app.core.errors import UpstreamError
from app.core.identity import RequestIdentity, current_identity
from app.core.security import verify_internal_token
from app.memory.vault import Vault
from app.schemas.problem import (
    FinalizeRequest,
    FinalizeResponse,
    ShortlistChatRequest,
    ShortlistRequest,
    ShortlistResponse,
)
from app.tools.backend.problem_tools import claim_problem_statement, register_project
from app.core.rate_limit import check_rate_limit

logger = logging.getLogger(__name__)

router = APIRouter(prefix='/problem-selection', tags=['problem-selection'])


@router.post('/shortlist', response_model=ShortlistResponse)
async def get_shortlist(
    payload: ShortlistRequest,
    request: Request,
    identity: RequestIdentity = Depends(verify_internal_token),
) -> ShortlistResponse:
    """Stateless endpoint that returns the 5 ranked candidates with fit reasoning."""
    check_rate_limit(identity)
    state = {
        'messages': [],
        'identity': identity.model_dump(),
        'intent': None,
        'memory_digest': '',
        'rag_context': [],
        'tool_results': [],
        'panel_events': [],
        'ui_events': [],
        'scratch': {},
    }
    
    state['identity']['team_id'] = payload.team_id
    
    # Merge outputs sequentially rather than overwriting state
    state.update(await assemble_team_profile_node(state))
    state.update(await fetch_candidates_node(state))
    
    llm = request.app.state.llm_provider
    shortlist_fn = make_semantic_shortlist_node(llm)
    state.update(await shortlist_fn(state))
    
    shortlist = state['scratch'].get('shortlist', [])
    return ShortlistResponse(candidates=shortlist)


@router.post('/chat')
async def shortlist_chat(
    payload: ShortlistChatRequest,
    request: Request,
    identity: RequestIdentity = Depends(verify_internal_token),
) -> EventSourceResponse:
    """SSE streaming endpoint for the captain problem-selection graph turn."""
    check_rate_limit(identity)
    identity_dict = identity.model_dump()
    identity_dict['team_id'] = payload.team_id
    identity_override = RequestIdentity(**identity_dict)
    
    graph = request.app.state.agent_graphs['captain']
    return EventSourceResponse(run_chat_turn(graph, payload.session_id, payload.message, identity_override))


@router.post('/finalize', response_model=FinalizeResponse)
async def finalize_selection(
    payload: FinalizeRequest,
    request: Request,
    identity: RequestIdentity = Depends(verify_internal_token),
) -> FinalizeResponse:
    """Atomic final claim and registration endpoint."""
    check_rate_limit(identity)
    team_id = payload.team_id
    problem_id = payload.problem_id
    thesis = payload.thesis.model_dump()
    user_id = identity.user_id
    
    token = current_identity.set(identity)
    try:
        claim_result = await claim_problem_statement.coroutine(team_id=team_id, problem_id=problem_id)
        if isinstance(claim_result, dict) and 'error' in claim_result:
            raise UpstreamError(claim_result.get('detail', 'Claim failed'), status_code=400)
            
        reg_result = await register_project.coroutine(team_id=team_id, problem_id=problem_id, thesis=thesis)
        if isinstance(reg_result, dict) and 'error' in reg_result:
            detail = str(reg_result.get('detail', ''))
            status = 409 if '409' in detail or 'conflict' in detail.lower() else 400
            raise UpstreamError(detail, status_code=status)
        
        project_md = f"""---
type: semantic
tags: [project, registration]
last_updated: {datetime.now().date().isoformat()}
---
# Finalized Project: [[{claim_result.get('title', 'Project')}]]
- ID: {problem_id}
- Code: {claim_result.get('code', problem_id)}
- Registration Date: {datetime.now().date().isoformat()}

## Uniqueness Thesis
- **Approach**: {thesis.get('approach')}
- **Method**: {thesis.get('method')}
- **Value**: {thesis.get('value')}
- **Differentiation**: {thesis.get('differentiation')}
"""
        try:
            vault = Vault(user_id)
            vault.write('project.md', project_md, {'type': 'semantic', 'tags': ['project', 'registration']})
        except Exception as e:
            logger.error(f"Failed to write project.md in user vault: {e}")
            
        return FinalizeResponse(ok=True, projectId=reg_result.get('id', problem_id))
        
    except UpstreamError as exc:
        if exc.status_code == 409:
            logger.warning(f"Conflict finalizing problem {problem_id} for team {team_id}: {exc.message}")
            state = {
                'messages': [],
                'identity': identity.model_dump(),
                'intent': None,
                'memory_digest': '',
                'rag_context': [],
                'tool_results': [],
                'panel_events': [],
                'ui_events': [],
                'scratch': {'excluded_problems': [problem_id]},
            }
            state['identity']['team_id'] = team_id
            
            state.update(await assemble_team_profile_node(state))
            state.update(await fetch_candidates_node(state))
            
            llm = request.app.state.llm_provider
            shortlist_fn = make_semantic_shortlist_node(llm)
            state.update(await shortlist_fn(state))
            
            reshortlist = state['scratch'].get('shortlist', [])
            return FinalizeResponse(ok=False, conflict=True, reshortlist=reshortlist)
        raise
    finally:
        current_identity.reset(token)
