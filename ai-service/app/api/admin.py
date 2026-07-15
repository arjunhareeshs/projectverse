import json
import logging
from collections.abc import AsyncIterator

from fastapi import APIRouter, Depends, Request
from sse_starlette.sse import EventSourceResponse

from app.agents.graph_base import run_chat_turn
from app.core.errors import ForbiddenError
from app.core.identity import RequestIdentity
from app.core.security import verify_internal_token
from app.schemas.chat import ChatRequest
from app.tools.backend.node_client import get_node_client

logger = logging.getLogger(__name__)

from app.core.rate_limit import check_rate_limit

router = APIRouter(prefix='/admin', tags=['admin'])


async def run_admin_chat_and_save(graph, session_id: str, prompt: str, identity: RequestIdentity) -> AsyncIterator[dict]:
    full_response = []
    async for frame in run_chat_turn(graph, session_id, prompt, identity):
        yield frame
        if frame.get('event') == 'text.delta':
            try:
                data = json.loads(frame.get('data', '{}'))
                text = data.get('text', '')
                if text:
                    full_response.append(text)
            except Exception:
                pass
                
    response_text = "".join(full_response)
    if response_text:
        try:
            await get_node_client().post('/admin/chat', {
                'prompt': prompt,
                'response': response_text,
                'sessionId': session_id
            })
        except Exception as e:
            logger.warning(f"Failed to save admin chat history to Node: {e}")


@router.post('/chat')
async def admin_chat(
    payload: ChatRequest,
    request: Request,
    identity: RequestIdentity = Depends(verify_internal_token),
) -> EventSourceResponse:
    """Single chat surface for admin — always the admin graph (Stage 8), whose bound tool list
    (Stage 7) has no write/navigation/posting tools. Same SSE frame vocabulary as `/chat`."""
    if identity.role.upper() != 'ADMIN':
        raise ForbiddenError('This endpoint is for the ADMIN role only.')
    check_rate_limit(identity)
    graph = request.app.state.agent_graphs['admin']
    return EventSourceResponse(run_admin_chat_and_save(graph, payload.session_id, payload.prompt, identity))
