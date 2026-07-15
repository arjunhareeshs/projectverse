from fastapi import APIRouter, Depends, Request
from sse_starlette.sse import EventSourceResponse

from app.agents.graph_base import run_chat_turn
from app.agents.router import route
from app.core.identity import RequestIdentity
from app.core.security import verify_internal_token
from app.schemas.chat import ChatRequest
from app.core.rate_limit import check_rate_limit

router = APIRouter(tags=['chat'])


@router.post('/chat')
async def chat(
    payload: ChatRequest,
    request: Request,
    identity: RequestIdentity = Depends(verify_internal_token),
) -> EventSourceResponse:
    """The real student/captain chat turn — routes to the right compiled graph (Stage 8), streams
    it as SSE via the shared `stream_graph` adapter. `session_id` maps 1:1 to a LangGraph thread:
    the SQLite checkpointer gives short-term memory "for free" across turns in the same session."""
    check_rate_limit(identity)
    graph_name = route(identity, payload.prompt)
    graph = request.app.state.agent_graphs[graph_name]
    return EventSourceResponse(run_chat_turn(graph, payload.session_id, payload.prompt, identity))
