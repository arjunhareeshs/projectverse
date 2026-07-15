from app.core.config import get_settings
from app.llm.provider import LLMProvider
from app.memory import reflection


async def run_reflection_job(user_id: str) -> dict:
    """What runs for a user's periodic (default: weekly) reflection cycle.

    This is a plain callable, not wired to a scheduler — the job **runner** (the `Job` table,
    asyncio scheduling loop) is Stage 10's responsibility. Stage 10 wraps this function; it
    doesn't need to know anything about consolidation or decay internals.
    """
    provider = LLMProvider(get_settings())
    consolidated_files = await reflection.consolidate(user_id, provider)
    decay_result = reflection.decay(user_id)
    return {'user_id': user_id, 'consolidated_files': consolidated_files, 'decay': decay_result}
