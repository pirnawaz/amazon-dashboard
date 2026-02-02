"""
SP-API HTTP client: LWA + SigV4 auth, retries with exponential backoff, structured logging.
"""
from __future__ import annotations

import logging
import time
from typing import Any

import httpx

from app.integrations.amazon_spapi.config import SpApiConfig, get_sp_api_config
from app.integrations.amazon_spapi.lwa import get_access_token
from app.integrations.amazon_spapi.sigv4 import canonical_query_string, sign_request

logger = logging.getLogger(__name__)

MAX_RETRIES = 3
RETRY_STATUSES = {429} | set(range(500, 600))


def _should_retry(status: int) -> bool:
    return status in RETRY_STATUSES


def _backoff_seconds(attempt: int) -> float:
    """Exponential backoff: 1, 2, 4 seconds (cap ~8)."""
    return min(2 ** attempt, 8.0)


class SpApiClientError(Exception):
    """SP-API request failed after retries or with non-retryable error."""

    def __init__(
        self,
        message: str,
        method: str,
        path: str,
        status_code: int | None = None,
        response_body: str | None = None,
    ) -> None:
        super().__init__(message)
        self.method = method
        self.path = path
        self.status_code = status_code
        self.response_body = response_body


class SpApiClient:
    """
    HTTP client for Amazon SP-API with LWA access token and AWS SigV4 signing.
    Retries up to MAX_RETRIES on 429 and 5xx with exponential backoff.
    """

    def __init__(
        self,
        refresh_token: str | None = None,
        config: SpApiConfig | None = None,
    ) -> None:
        self._config = config or get_sp_api_config()
        self._base_url = f"https://{self._config.sp_api_endpoint}"
        self._refresh_token = refresh_token

    def request(
        self,
        method: str,
        path: str,
        params: dict[str, Any] | None = None,
        json: Any = None,
        headers: dict[str, str] | None = None,
        refresh_token_override: str | None = None,
    ) -> httpx.Response:
        """
        Perform a signed SP-API request. Adds LWA access token and SigV4 auth.
        Retries on 429 and 5xx (max 3) with exponential backoff.
        Refresh token: per-request override, else instance refresh_token, else config (env).
        """
        params = params or {}
        headers = dict(headers or {})
        path = path if path.startswith("/") else "/" + path

        effective_refresh = refresh_token_override if refresh_token_override is not None else self._refresh_token
        access_token = get_access_token(self._config, refresh_token_override=effective_refresh)
        headers["x-amz-access-token"] = access_token

        body_bytes: bytes | None = None
        if json is not None:
            import json as _json
            body_bytes = _json.dumps(json).encode()
            headers.setdefault("Content-Type", "application/json")

        # Build URL with canonical query so it matches the signed request
        qs = canonical_query_string(params)
        url = f"{self._base_url}{path}" + ("?" + qs if qs else "")

        signed_headers = sign_request(
            method=method,
            host=self._config.sp_api_endpoint,
            path=path,
            region=self._config.aws_region,
            access_key_id=self._config.aws_access_key_id,
            secret_access_key=self._config.aws_secret_access_key,
            params=params if params else None,
            headers=headers,
            body=body_bytes,
        )

        for attempt in range(MAX_RETRIES):
            start = time.perf_counter()
            try:
                with httpx.Client() as client:
                    resp = client.request(
                        method,
                        url,
                        content=body_bytes,
                        headers=signed_headers,
                    )
                duration_ms = (time.perf_counter() - start) * 1000
                logger.info(
                    "sp_api_request",
                    extra={
                        "method": method,
                        "path": path,
                        "status_code": resp.status_code,
                        "duration_ms": round(duration_ms, 2),
                        "attempt": attempt + 1,
                    },
                )
                if _should_retry(resp.status_code):
                    if attempt < MAX_RETRIES - 1:
                        wait = _backoff_seconds(attempt)
                        logger.warning(
                            "sp_api_retry",
                            extra={
                                "method": method,
                                "path": path,
                                "status_code": resp.status_code,
                                "attempt": attempt + 1,
                                "retry_after_sec": wait,
                            },
                        )
                        time.sleep(wait)
                        continue
                    raise SpApiClientError(
                        f"SP-API request failed after {MAX_RETRIES} retries: {method} {path} -> {resp.status_code}",
                        method=method,
                        path=path,
                        status_code=resp.status_code,
                        response_body=resp.text[:2000] if resp.text else None,
                    )
                return resp
            except httpx.HTTPError as e:
                duration_ms = (time.perf_counter() - start) * 1000
                logger.warning(
                    "sp_api_request_error",
                    extra={
                        "method": method,
                        "path": path,
                        "attempt": attempt + 1,
                        "duration_ms": round(duration_ms, 2),
                        "error": str(e),
                    },
                )
                if attempt < MAX_RETRIES - 1:
                    wait = _backoff_seconds(attempt)
                    time.sleep(wait)
                else:
                    raise SpApiClientError(
                        f"SP-API request failed: {e!s}",
                        method=method,
                        path=path,
                    ) from e
