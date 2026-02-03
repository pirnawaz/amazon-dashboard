"""
Sprint 19: In-process TTL cache for expensive read-only aggregates.

Safe for single-server deployment. Cache key should include account/marketplace/days
so different contexts do not collide. Do not cache data that depends on
user-specific permissions beyond role checks.
"""
from __future__ import annotations

import time
from collections import OrderedDict
from collections.abc import Callable
from functools import wraps
from typing import TypeVar

from app.core.config import settings

T = TypeVar("T")

# Simple TTL cache: key -> (value, expiry_ts)
_cache: OrderedDict[str, tuple[object, float]] = OrderedDict()
_max_entries = 500


def _now() -> float:
    return time.monotonic()


def cache_get(key: str) -> object | None:
    """Return cached value if present and not expired."""
    if key not in _cache:
        return None
    val, expiry = _cache[key]
    if _now() >= expiry:
        del _cache[key]
        return None
    return val


def cache_set(key: str, value: object, ttl_seconds: int | None = None) -> None:
    """Store value with TTL. Evict oldest if over capacity."""
    ttl = ttl_seconds if ttl_seconds is not None else settings.cache_ttl_seconds
    expiry = _now() + ttl
    if key in _cache:
        del _cache[key]
    while len(_cache) >= _max_entries and _cache:
        _cache.popitem(last=False)
    _cache[key] = (value, expiry)


def cache_delete(key: str) -> None:
    """Remove key from cache."""
    _cache.pop(key, None)


def cached(ttl_seconds: int | None = None, key_prefix: str = ""):
    """Decorator: cache function result by (key_prefix + str(args) + str(kwargs))."""

    def decorator(func: Callable[..., T]) -> Callable[..., T]:
        @wraps(func)
        def wrapper(*args: object, **kwargs: object) -> T:
            import hashlib
            raw = f"{key_prefix}:{args!r}:{sorted(kwargs.items())!r}"
            key = hashlib.sha256(raw.encode()).hexdigest()[:48]
            full_key = f"{key_prefix}:{key}" if key_prefix else key
            hit = cache_get(full_key)
            if hit is not None:
                return hit  # type: ignore[return-value]
            result = func(*args, **kwargs)
            cache_set(full_key, result, ttl_seconds)
            return result

        return wrapper  # type: ignore[return-value]

    return decorator
