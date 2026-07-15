from typing import Any
from pydantic import BaseModel, Field


class JobSubmitRequest(BaseModel):
    job_type: str = Field(min_length=1)
    payload: dict[str, Any] = Field(default_factory=dict)


class JobStatusResponse(BaseModel):
    job_id: str
    job_type: str
    status: str  # pending, running, completed, failed
    result: dict[str, Any] | None = None
    error: str | None = None
    created_at: str
    updated_at: str
