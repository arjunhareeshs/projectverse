import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from langgraph.checkpoint.sqlite.aio import AsyncSqliteSaver

from app.agents.admin_agent import build_admin_graph
from app.agents.captain_agent import build_captain_graph
from app.agents.student_agent import build_student_graph
from app.api.admin import router as admin_router
from app.api.chat import router as chat_router
from app.api.health import router as health_router
from app.api.inference import router as inference_router
from app.api.rag import router as rag_router
from app.api.problem_selection import router as problem_selection_router
from app.api.memory import router as memory_router
from app.api.jobs import router as jobs_router
from app.core.config import get_settings
from app.core.errors import AppError
from app.core.logging import configure_logging, new_request_id, request_id_var
from app.llm.embeddings import get_embedding_model
from app.llm.provider import LLMProvider
from app.llm.reranker import get_reranker
from app.jobs.runner import register_job_handler
from app.jobs.reflection_job import run_reflection_job
import app.jobs.weekly_report_job  # register weekly report job handler

configure_logging()
logger = logging.getLogger(__name__)
settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    app.state.llm_provider = LLMProvider(settings)
    app.state.models_warm = {'embed': False, 'rerank': False}
    get_embedding_model()
    app.state.models_warm['embed'] = True
    get_reranker()
    app.state.models_warm['rerank'] = True

    Path(settings.jobs_db).parent.mkdir(parents=True, exist_ok=True)
    async with AsyncSqliteSaver.from_conn_string(settings.jobs_db) as checkpointer:
        await checkpointer.setup()
        app.state.agent_graphs = {
            'student': build_student_graph(app.state.llm_provider, checkpointer),
            'captain': build_captain_graph(app.state.llm_provider, checkpointer),
            'admin': build_admin_graph(app.state.llm_provider, checkpointer),
        }
        
        async def reflection_job_wrapper(payload: dict) -> dict:
            user_id = payload.get('user_id')
            if not user_id:
                raise ValueError("user_id is required for reflection")
            return await run_reflection_job(user_id)
            
        register_job_handler('reflection', reflection_job_wrapper)
        
        logger.info(
            'ai-service startup complete: active_model=%s, fallback_model=%s',
            app.state.llm_provider.model,
            app.state.llm_provider.fallback_model
        )
        yield


app = FastAPI(
    title='ProjectVerse AI Service',
    version='0.1.0',
    description='AI service APIs for ProjectVerse enterprise platform.',
    lifespan=lifespan,
)


@app.middleware('http')
async def request_id_middleware(request: Request, call_next):
    token = request_id_var.set(new_request_id())
    try:
        response = await call_next(request)
    finally:
        request_id_var.reset(token)
    return response


@app.exception_handler(AppError)
async def app_error_handler(request: Request, exc: AppError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={'error': exc.error_code, 'message': exc.message, 'details': exc.details},
    )


@app.exception_handler(Exception)
async def unhandled_error_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.exception('Unhandled error on %s %s', request.method, request.url.path)
    return JSONResponse(status_code=500, content={'error': 'internal_error', 'message': 'Internal server error'})


app.include_router(health_router)
app.include_router(chat_router)
app.include_router(admin_router)
app.include_router(rag_router)
app.include_router(inference_router)
app.include_router(problem_selection_router)
app.include_router(memory_router)
app.include_router(jobs_router)


@app.get('/')
def root() -> dict[str, str]:
    return {
        'message': 'ProjectVerse AI service is running',
        'port': str(settings.ai_service_port),
    }
