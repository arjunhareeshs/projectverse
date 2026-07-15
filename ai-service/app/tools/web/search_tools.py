import asyncio

from ddgs import DDGS

from app.core.config import get_settings
from app.tools.base import audited_tool
from app.tools.web.rerank import rerank_hits

_SITE_ALIASES = {'github': 'github.com', 'linkedin': 'linkedin.com', 'youtube': 'youtube.com', 'arxiv': 'arxiv.org'}


def _resolve_site(site: str) -> str:
    return _SITE_ALIASES.get(site.lower(), site)


def _ddgs_text(query: str, region: str, max_results: int) -> list[dict]:
    with DDGS() as ddgs:
        return ddgs.text(query, region=region, max_results=max_results)


@audited_tool
async def web_search(query: str, sites: list[str] = [], k: int = 5) -> dict:  # noqa: B006 — never mutated
    """Search the web (DuckDuckGo, no API key required). `sites` optionally scopes results to
    specific domains — accepts short aliases ('github', 'linkedin', 'youtube', 'arxiv') or a raw
    domain. Results from every requested site are merged, deduped, and reranked by relevance."""
    settings = get_settings()
    queries = [f'{query} site:{_resolve_site(s)}' for s in sites] or [query]

    seen_urls: set[str] = set()
    all_hits: list[dict] = []
    for q in queries:
        hits = await asyncio.to_thread(_ddgs_text, q, settings.ddgs_region, max(k * 2, 10))
        for hit in hits:
            url = hit.get('href')
            if url and url not in seen_urls:
                seen_urls.add(url)
                all_hits.append(hit)

    if not all_hits:
        return {'results': []}

    ranked = await asyncio.to_thread(rerank_hits, query, all_hits, k, 'body')
    return {'results': ranked}
