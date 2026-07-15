from fastapi import APIRouter, Depends, HTTPException

from app.core.identity import RequestIdentity
from app.core.security import verify_internal_token
from app.jobs.runner import get_job_runner
from app.schemas.jobs import JobStatusResponse, JobSubmitRequest

router = APIRouter(prefix='/jobs', tags=['jobs'])


@router.post('', response_model=dict)
async def submit_job(
    payload: JobSubmitRequest,
    identity: RequestIdentity = Depends(verify_internal_token),
) -> dict:
    """Submit a background job (e.g. weekly_report or reflection) to run asynchronously."""
    runner = get_job_runner()
    job_id = await runner.submit(payload.job_type, payload.payload)
    return {'jobId': job_id}


@router.get('/{job_id}', response_model=JobStatusResponse)
async def get_job_status(
    job_id: str,
    identity: RequestIdentity = Depends(verify_internal_token),
) -> JobStatusResponse:
    """Retrieve the status and results of a background job."""
    runner = get_job_runner()
    job = runner.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return JobStatusResponse(
        job_id=job['job_id'],
        job_type=job['job_type'],
        status=job['status'],
        result=job['result'],
        error=job['error'],
        created_at=job['created_at'],
        updated_at=job['updated_at']
    )
