import functools
import logging
from collections.abc import Awaitable, Callable
from typing import Any

from langchain_core.tools import StructuredTool
from langchain_core.tools import tool as lc_tool

from app.core.identity import RequestIdentity, current_identity

audit_logger = logging.getLogger('app.tools.audit')


def audited_tool(func: Callable[..., Awaitable[Any]]) -> StructuredTool:
    """Turns an async function into a LangChain `StructuredTool` with two non-negotiable
    behaviors layered on top:

    1. **Never raises into the agent loop.** A backend/network failure becomes a structured
       `{"error": ..., "detail": ...}` result the LLM can reason about ("problem already claimed"
       is a *result*, not a crash) — the agent graph (Stage 8) keeps running.
    2. **Every call is audited**, success or failure — `{tool_name, args, identity, result_summary}`
       — because "never claim you performed an action you didn't call" requires a trail proving
       what was actually called, not just what the model said it did.

    The pydantic args schema and description the LLM sees are inferred from `func`'s type hints
    and docstring — `functools.wraps` below preserves both onto the wrapper LangChain inspects.
    """

    @functools.wraps(func)
    async def wrapper(*args: Any, **kwargs: Any) -> Any:
        identity: RequestIdentity | None = current_identity.get()
        try:
            result = await func(*args, **kwargs)
            _audit(func.__name__, kwargs, identity, result, ok=True)
            return result
        except Exception as exc:
            error_result = {'error': type(exc).__name__, 'detail': str(exc)}
            _audit(func.__name__, kwargs, identity, error_result, ok=False)
            return error_result

    return lc_tool(wrapper)


def _audit(tool_name: str, args: dict[str, Any], identity: RequestIdentity | None, result: Any, ok: bool) -> None:
    audit_logger.info(
        'tool_call',
        extra={
            'tool_name': tool_name,
            # 'args' collides with logging.LogRecord's own reserved attribute of that name
            # (used for %-style message formatting) — using it in `extra` raises a KeyError.
            'tool_args': args,
            'user_id': identity.user_id if identity else None,
            'role': identity.role if identity else None,
            'ok': ok,
            'result_summary': str(result)[:300],
        },
    )
