import asyncio
import logging

from fastapi import APIRouter, Depends

from app.core.identity import RequestIdentity
from app.core.security import verify_internal_token
from app.memory.traversal import traverse
from app.jobs.runner import get_job_runner

logger = logging.getLogger(__name__)

router = APIRouter(prefix='/memory', tags=['memory'])


@router.get('/{user_id}/digest')
async def get_memory_digest(
    user_id: str,
    query: str = '',
    identity: RequestIdentity = Depends(verify_internal_token),
) -> dict:
    """Run graph traversal to get a context bundle digest from the user's vault."""
    bundle = await asyncio.to_thread(traverse, user_id, query or 'general', 800)
    return {'digest': bundle.to_digest()}


@router.post('/reflect')
async def trigger_reflection(
    payload: dict,
    identity: RequestIdentity = Depends(verify_internal_token),
) -> dict:
    """Submit a background job to run memory reflection (consolidation and decay) for a user."""
    target_user_id = payload.get('userId') or payload.get('user_id')
    if not target_user_id:
        return {'error': 'missing_user_id', 'detail': 'userId or user_id must be provided in request body.'}
    
    runner = get_job_runner()
    job_id = await runner.submit('reflection', {'user_id': target_user_id})
    return {'jobId': job_id}
