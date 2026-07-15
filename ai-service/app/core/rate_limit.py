import time
from collections import defaultdict
from fastapi import HTTPException, status
from app.core.identity import RequestIdentity

# Memory-based simple rate limiter
# Format: { user_id: [timestamps] }
_USER_REQUEST_LOGS = defaultdict(list)


def check_rate_limit(identity: RequestIdentity, limit: int = 100, window_seconds: int = 3600) -> None:
    """Simple sliding window rate limiter per user to prevent runaway tool-loop costs."""
    user_id = identity.user_id
    now = time.time()
    
    # Clean up old timestamps
    cutoff = now - window_seconds
    _USER_REQUEST_LOGS[user_id] = [ts for ts in _USER_REQUEST_LOGS[user_id] if ts > cutoff]
    
    # Check limit
    if len(_USER_REQUEST_LOGS[user_id]) >= limit:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Rate limit exceeded. Please try again later."
        )
        
    _USER_REQUEST_LOGS[user_id].append(now)
