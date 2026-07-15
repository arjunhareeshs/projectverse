import asyncio

from ddgs import DDGS

from app.core.config import get_settings
from app.tools.base import audited_tool


def _ddgs_images(query: str, region: str, max_results: int) -> list[dict]:
    with DDGS() as ddgs:
        return ddgs.images(query, region=region, max_results=max_results)


@audited_tool
async def image_search(query: str, k: int = 5) -> dict:
    """Search the web for images (DuckDuckGo, no API key required), ranked by resolution.
    Returns source URLs — this does not download or store image bytes."""
    settings = get_settings()
    hits = await asyncio.to_thread(_ddgs_images, query, settings.ddgs_region, max(k * 2, 10))
    ranked = sorted(hits, key=lambda h: (h.get('width') or 0) * (h.get('height') or 0), reverse=True)
    return {'results': ranked[:k]}
