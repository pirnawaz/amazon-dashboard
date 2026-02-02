"""
In-memory rate limiting: per IP and per user (when JWT present).
Default 100 requests/minute. Returns 429 with JSON error.
"""
from __future__ import annotations

import time
from collections import defaultdict
from collections.abc import Callable

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

from app.core.config import settings

# Key -> list of timestamps (request times in current window)
_store: dict[str, list[float]] = defaultdict(list)
_WINDOW_SEC = 60
_CLEANUP_INTERVAL = 300  # prune old keys every 5 min
_last_cleanup = time.monotonic()


def _client_key(request: Request) -> str:
    # Prefer X-Forwarded-For when behind Caddy
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        client = forwarded.split(",")[0].strip()
    else:
        client = request.client.host if request.client else "unknown"
    return f"ip:{client}"


def _user_key(request: Request) -> str | None:
    auth = request.headers.get("Authorization")
    if not auth or not auth.startswith("Bearer "):
        return None
    # Use token as opaque key (avoid decoding JWT in middleware)
    token = auth[7:].strip()
    if not token:
        return None
    return f"user:{token[:32]}"


def _check_limit(key: str, limit: int) -> bool:
    """True if under limit, False if over (should 429)."""
    global _last_cleanup
    now = time.monotonic()
    # Use wall time for window
    now_ts = time.time()
    window_start = now_ts - _WINDOW_SEC
    timestamps = _store[key]
    # Drop timestamps outside window
    while timestamps and timestamps[0] < window_start:
        timestamps.pop(0)
    if len(timestamps) >= limit:
        return False
    timestamps.append(now_ts)
    # Periodic cleanup of stale keys
    if now - _last_cleanup > _CLEANUP_INTERVAL:
        _last_cleanup = now
        to_del = [k for k, ts_list in _store.items() if not ts_list or ts_list[-1] < window_start]
        for k in to_del:
            del _store[k]
    return True


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Apply rate limit per IP and per user (if Bearer present). Skip /api/health and /api/ready."""

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        path = request.url.path
        if path.endswith("/health") or path.endswith("/ready"):
            return await call_next(request)

        limit = settings.rate_limit_per_minute
        # Check IP
        if not _check_limit(_client_key(request), limit):
            request_id = getattr(request.state, "request_id", None)
            return JSONResponse(
                status_code=429,
                content={
                    "error": {"message": "Too many requests. Please try again later."},
                    "request_id": request_id,
                },
            )
        # If Bearer token present, also count per-user
        user_k = _user_key(request)
        if user_k and not _check_limit(user_k, limit):
            request_id = getattr(request.state, "request_id", None)
            return JSONResponse(
                status_code=429,
                content={
                    "error": {"message": "Too many requests. Please try again later."},
                    "request_id": request_id,
                },
            )
        return await call_next(request)
