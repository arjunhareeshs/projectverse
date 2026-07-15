import asyncio

from app.rag.query import get_rag_query
from app.tools.base import audited_tool


@audited_tool
async def rag_search(query: str, namespace: str, k: int = 5, filters: dict[str, str] = {}) -> dict:  # noqa: B006
    """Search the knowledge base with hybrid dense+sparse retrieval and reranking. `namespace` is
    one of kb_problems | kb_students | kb_teams | kb_global, or `vault:<userId>` to search a
    user's memory vault semantically instead of via graph traversal."""
    rag = get_rag_query()
    results = await asyncio.to_thread(rag.search, query, namespace, filters or None, k)
    return {'results': [r.model_dump() for r in results]}
