"""Auth bridge: fetches a short-lived browser JWT from Node and injects
it into the headed browser's localStorage so the React app logs in automatically.
"""
import logging
import time

import httpx

from app.core.config import get_settings
from app.core.identity import get_current_identity
from app.core.security import compute_internal_signature

logger = logging.getLogger(__name__)

_token_cache: dict[str, tuple[str, float]] = {}  # user_id -> (jwt, expires_at)
TOKEN_TTL_SECONDS = 270  # fetch fresh before the 5-minute window expires


async def get_browser_jwt() -> str | None:
    """Fetch a short-lived JWT for the current user from Node's /browser-token endpoint.

    Tokens are cached locally for 4.5 minutes to avoid hammering Node on every
    tool call in the same session.
    """
    identity = get_current_identity()
    user_id = identity.user_id

    cached_jwt, expires_at = _token_cache.get(user_id, (None, 0))
    if cached_jwt and time.monotonic() < expires_at:
        return cached_jwt

    settings = get_settings()
    base_url = settings.node_internal_url.rstrip("/")
    ts = str(int(time.time()))
    sig = compute_internal_signature(settings.internal_token_secret, user_id, identity.role, ts)

    headers = {
        "X-Internal-User-Id": user_id,
        "X-Internal-Role": identity.role,
        "X-Internal-Timestamp": ts,
        "X-Internal-Token": sig,
    }
    if identity.team_id:
        headers["X-Internal-Team-Id"] = identity.team_id
    if identity.org_id:
        headers["X-Internal-Org-Id"] = identity.org_id

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(f"{base_url}/browser-token", headers=headers)
        resp.raise_for_status()
        jwt = resp.json().get("token")
        if jwt:
            _token_cache[user_id] = (jwt, time.monotonic() + TOKEN_TTL_SECONDS)
            logger.info("Browser JWT fetched for user %s", user_id)
        return jwt
    except Exception as exc:
        logger.warning("Could not fetch browser JWT for user %s: %s", user_id, exc)
        return None
