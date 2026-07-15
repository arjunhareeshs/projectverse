import hashlib
import hmac
import time

from fastapi import Request

from app.core.config import get_settings
from app.core.errors import UnauthorizedError
from app.core.identity import RequestIdentity


def compute_internal_signature(secret: str, user_id: str, role: str, timestamp: str) -> str:
    message = f'{user_id}.{role}.{timestamp}'.encode()
    return hmac.new(secret.encode(), message, hashlib.sha256).hexdigest()


def verify_internal_token(request: Request) -> RequestIdentity:
    """Verifies Node's `X-Internal-Token: HMAC-SHA256(secret, f"{userId}.{role}.{ts}")`.

    Identity fields travel as plain headers; the token proves Node signed them and that
    they haven't been tampered with or replayed outside the allowed clock skew.
    """
    headers = request.headers
    user_id = headers.get('x-internal-user-id')
    role = headers.get('x-internal-role')
    timestamp = headers.get('x-internal-timestamp')
    token = headers.get('x-internal-token')

    if not user_id or not role or not timestamp or not token:
        raise UnauthorizedError('Missing internal identity headers')

    try:
        ts = int(timestamp)
    except ValueError as exc:
        raise UnauthorizedError('Invalid timestamp header') from exc

    settings = get_settings()
    if abs(time.time() - ts) > settings.internal_token_max_skew_seconds:
        raise UnauthorizedError('Internal token expired')

    expected = compute_internal_signature(settings.internal_token_secret, user_id, role, timestamp)
    if not hmac.compare_digest(expected, token):
        raise UnauthorizedError('Invalid internal token signature')

    return RequestIdentity(
        user_id=user_id,
        role=role,
        team_id=headers.get('x-internal-team-id'),
        org_id=headers.get('x-internal-org-id'),
    )
