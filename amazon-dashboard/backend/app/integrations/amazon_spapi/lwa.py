"""
Login with Amazon (LWA): exchange refresh token for access token.

Caches the access token in memory with expiry, per (client_id, refresh_token).
Logs without exposing secrets.
"""
from __future__ import annotations

import hashlib
import logging
import time
from typing import Any

import httpx

from app.integrations.amazon_spapi.config import SpApiConfig

logger = logging.getLogger(__name__)

# Per-token cache: (client_id, token_hash_16) -> (access_token, expires_at_epoch_seconds)
_cache: dict[tuple[str, str], tuple[str, float]] = {}

# Buffer seconds before expiry to refresh
_EXPIRY_BUFFER = 60


def _now() -> float:
    return time.time()


def _cache_key(client_id: str, refresh_token: str) -> tuple[str, str]:
    """Stable key for caching; never log refresh_token."""
    h = hashlib.sha256(refresh_token.encode()).hexdigest()[:16]
    return (client_id, h)


def get_access_token(
    config: SpApiConfig,
    refresh_token_override: str | None = None,
) -> str:
    """
    Return a valid LWA access token, from cache or by exchanging the refresh token.
    Refresh token is taken from refresh_token_override or config.lwa_refresh_token.
    Raises RuntimeError if neither is set.
    Cache is keyed by (lwa_client_id, sha256(refresh_token)[:16]).
    """
    refresh_token = refresh_token_override or config.lwa_refresh_token
    if not refresh_token or not refresh_token.strip():
        raise RuntimeError(
            "Missing LWA refresh token (provide via DB or set LWA_REFRESH_TOKEN for dev)."
        )
    refresh_token = refresh_token.strip()
    key = _cache_key(config.lwa_client_id, refresh_token)
    if key in _cache:
        token, expires_at = _cache[key]
        if _now() < expires_at - _EXPIRY_BUFFER:
            logger.debug(
                "lwa_token_source",
                extra={"cached": True, "expires_in_sec": int(expires_at - _now())},
            )
            return token
    token, expires_in = _exchange(config, refresh_token)
    expires_at = _now() + expires_in
    _cache[key] = (token, expires_at)
    logger.info(
        "lwa_token_obtained",
        extra={"expires_in_sec": expires_in, "cached": True},
    )
    return token


def _exchange(config: SpApiConfig, refresh_token: str) -> tuple[str, int]:
    """Exchange refresh token for access token. Returns (access_token, expires_in_seconds)."""
    payload: dict[str, Any] = {
        "grant_type": "refresh_token",
        "refresh_token": refresh_token,
        "client_id": config.lwa_client_id,
        "client_secret": config.lwa_client_secret,
    }
    # Log without secrets
    logger.debug(
        "lwa_exchange_request",
        extra={"endpoint": config.lwa_endpoint, "grant_type": "refresh_token"},
    )
    with httpx.Client() as client:
        resp = client.post(
            config.lwa_endpoint,
            data=payload,
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
    resp.raise_for_status()
    data = resp.json()
    access_token = data.get("access_token")
    expires_in = data.get("expires_in", 3600)
    if not access_token:
        raise RuntimeError("LWA response missing access_token")
    if not isinstance(expires_in, (int, float)):
        expires_in = 3600
    return str(access_token), int(expires_in)


def clear_cache() -> None:
    """Clear in-memory per-token cache (e.g. for tests)."""
    global _cache
    _cache.clear()
    logger.debug("lwa_cache_cleared")
