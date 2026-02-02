"""
AWS Signature Version 4 for SP-API requests.

Signs HTTP requests with AWS credentials. SP-API uses host like
sellingpartnerapi-na.amazon.com and service name "execute-api".
"""
from __future__ import annotations

import hashlib
import hmac
from datetime import datetime, timezone
from typing import Any
from urllib.parse import quote

# SP-API uses execute-api as the AWS service name for SigV4
SERVICE_NAME = "execute-api"
ALGORITHM = "AWS4-HMAC-SHA256"


def _sha256(data: bytes) -> bytes:
    return hashlib.sha256(data).digest()


def _hex(data: bytes) -> str:
    return data.hex()


def _canonical_uri(path: str) -> str:
    if not path or path == "/":
        return "/"
    # Encode each path segment
    parts = path.split("/")
    encoded = [quote(p, safe="") for p in parts if p]
    return "/" + "/".join(encoded)


def canonical_query_string(params: dict[str, Any] | None) -> str:
    """Build canonical query string for SigV4 (sorted keys). Use same for request URL."""
    if not params:
        return ""
    sorted_pairs = sorted(
        (quote(str(k), safe=""), quote(str(v), safe="")) for k, v in params.items()
    )
    return "&".join(f"{k}={v}" for k, v in sorted_pairs)


def _canonical_query_string(params: dict[str, Any] | None) -> str:
    return canonical_query_string(params)


def _canonical_headers(headers: dict[str, str]) -> tuple[str, str]:
    """Return (canonical headers string, signed headers list)."""
    normalized: list[tuple[str, str]] = []
    for k, v in sorted(headers.items(), key=lambda x: x[0].lower()):
        key = k.lower().strip()
        value = " ".join(v.split())  # collapse whitespace
        normalized.append((key, value))
    canonical = "".join(f"{k}:{v}\n" for k, v in normalized)
    signed = ";".join(k for k, _ in normalized)
    return canonical, signed


def _payload_hash(body: bytes | None) -> str:
    payload = body if body is not None else b""
    return _hex(_sha256(payload))


def _signing_key(
    secret_key: str,
    datestamp: str,
    region: str,
    service: str,
) -> bytes:
    k_date = hmac.new(
        ("AWS4" + secret_key).encode(),
        datestamp.encode(),
        hashlib.sha256,
    ).digest()
    k_region = hmac.new(k_date, region.encode(), hashlib.sha256).digest()
    k_service = hmac.new(k_region, service.encode(), hashlib.sha256).digest()
    k_signing = hmac.new(
        k_service,
        b"aws4_request",
        hashlib.sha256,
    ).digest()
    return k_signing


def sign_request(
    method: str,
    host: str,
    path: str,
    region: str,
    access_key_id: str,
    secret_access_key: str,
    params: dict[str, Any] | None = None,
    headers: dict[str, str] | None = None,
    body: bytes | None = None,
    service: str = SERVICE_NAME,
) -> dict[str, str]:
    """
    Add SigV4 Authorization and required headers to a copy of the given headers.
    Returns a new headers dict including x-amz-date and Authorization.
    """
    now = datetime.now(timezone.utc)
    amz_date = now.strftime("%Y%m%dT%H%M%SZ")
    datestamp = now.strftime("%Y%m%d")

    headers = dict(headers or {})
    headers["host"] = host
    headers["x-amz-date"] = amz_date
    if "content-type" not in [h.lower() for h in headers]:
        headers["content-type"] = "application/json"

    canonical_uri = _canonical_uri(path)
    canonical_querystring = _canonical_query_string(params)
    payload_hash_val = _payload_hash(body)
    canonical_headers_str, signed_headers = _canonical_headers(headers)

    canonical_request = "\n".join([
        method.upper(),
        canonical_uri,
        canonical_querystring,
        canonical_headers_str,
        signed_headers,
        payload_hash_val,
    ])

    credential_scope = f"{datestamp}/{region}/{service}/aws4_request"
    string_to_sign = "\n".join([
        ALGORITHM,
        amz_date,
        credential_scope,
        _hex(_sha256(canonical_request.encode())),
    ])

    signing_key = _signing_key(secret_access_key, datestamp, region, service)
    signature = _hex(
        hmac.new(
            signing_key,
            string_to_sign.encode(),
            hashlib.sha256,
        ).digest()
    )

    auth_header = (
        f"{ALGORITHM} "
        f"Credential={access_key_id}/{credential_scope}, "
        f"SignedHeaders={signed_headers}, "
        f"Signature={signature}"
    )
    headers["Authorization"] = auth_header
    return headers
