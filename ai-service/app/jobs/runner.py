import sqlite3
import json
import uuid
import asyncio
import logging
from datetime import datetime
from typing import Any, Callable, Coroutine
from app.core.config import get_settings

logger = logging.getLogger(__name__)

# Registry of available jobs
# format: { job_type: async function }
_JOB_REGISTRY: dict[str, Callable[[dict], Coroutine[Any, Any, dict]]] = {}


def register_job_handler(job_type: str, handler: Callable[[dict], Coroutine[Any, Any, dict]]) -> None:
    _JOB_REGISTRY[job_type] = handler


class JobRunner:
    def __init__(self, db_path: str | None = None) -> None:
        self.db_path = db_path or get_settings().jobs_db
        self._init_db()

    def _init_db(self) -> None:
        with sqlite3.connect(self.db_path) as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS jobs (
                    id TEXT PRIMARY KEY,
                    type TEXT NOT NULL,
                    status TEXT NOT NULL,
                    result TEXT,
                    error TEXT,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                )
            """)
            conn.commit()

    def _conn(self) -> sqlite3.Connection:
        return sqlite3.connect(self.db_path)

    async def submit(self, job_type: str, payload: dict) -> str:
        job_id = str(uuid.uuid4())
        now = datetime.now().isoformat()
        
        with self._conn() as conn:
            conn.execute(
                "INSERT INTO jobs (id, type, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
                (job_id, job_type, 'pending', now, now)
            )
            conn.commit()
            
        asyncio.create_task(self._run_job(job_id, job_type, payload))
        return job_id

    async def _run_job(self, job_id: str, job_type: str, payload: dict) -> None:
        self._update_status(job_id, 'running')
        
        handler = _JOB_REGISTRY.get(job_type)
        if not handler:
            self._update_status(job_id, 'failed', error=f"No handler registered for job type: {job_type}")
            return
            
        try:
            result = await handler(payload)
            self._update_status(job_id, 'completed', result=result)
        except Exception as e:
            logger.exception(f"Job {job_id} ({job_type}) failed")
            self._update_status(job_id, 'failed', error=str(e))

    def _update_status(self, job_id: str, status: str, result: dict | None = None, error: str | None = None) -> None:
        now = datetime.now().isoformat()
        res_json = json.dumps(result) if result is not None else None
        with self._conn() as conn:
            conn.execute(
                "UPDATE jobs SET status = ?, result = ?, error = ?, updated_at = ? WHERE id = ?",
                (status, res_json, error, now, job_id)
            )
            conn.commit()

    def get_job(self, job_id: str) -> dict | None:
        with self._conn() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT id, type, status, result, error, created_at, updated_at FROM jobs WHERE id = ?", (job_id,))
            row = cursor.fetchone()
            if not row:
                return None
            return {
                'job_id': row[0],
                'job_type': row[1],
                'status': row[2],
                'result': json.loads(row[3]) if row[3] else None,
                'error': row[4],
                'created_at': row[5],
                'updated_at': row[6]
            }


_runner = None


def get_job_runner() -> JobRunner:
    global _runner
    if _runner is None:
        _runner = JobRunner()
    return _runner
