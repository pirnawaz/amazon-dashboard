"""
SP-API configuration from environment.

Uses the same pattern as app.core.config: required vars raise RuntimeError
with a clear message when accessed. Call get_sp_api_config() when building
the client so missing vars fail fast at first use.
"""
from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path
# Ensure .env is loaded when app runs (core.config is usually imported first).
_REPO_ROOT = Path(__file__).resolve().parents[4]
_ENV_PATH = _REPO_ROOT / ".env"
if _ENV_PATH.exists():
    from dotenv import load_dotenv
    load_dotenv(_ENV_PATH)


def _require(name: str) -> str:
    val = os.getenv(name)
    if not val or not str(val).strip():
        raise RuntimeError(f"Missing required environment variable: {name}")
    return str(val).strip()


def _optional(name: str, default: str) -> str:
    val = os.getenv(name)
    return str(val).strip() if (val and str(val).strip()) else default


def _optional_or_none(name: str) -> str | None:
    """Return env value or None if missing/empty. Used for optional dev fallback."""
    val = os.getenv(name)
    return str(val).strip() if (val and str(val).strip()) else None


@dataclass(frozen=True)
class SpApiConfig:
    """SP-API and LWA settings from env."""

    # LWA (Login with Amazon)
    lwa_client_id: str
    lwa_client_secret: str
    lwa_refresh_token: str | None  # Optional; use DB token in production or LWA_REFRESH_TOKEN for dev
    lwa_endpoint: str

    # AWS (SigV4)
    aws_access_key_id: str
    aws_secret_access_key: str
    aws_region: str

    # SP-API endpoint host (e.g. sellingpartnerapi-na.amazon.com)
    sp_api_endpoint: str


# Default SP-API host per region (NA, EU, FE)
_DEFAULT_ENDPOINTS = {
    "us-east-1": "sellingpartnerapi-na.amazon.com",
    "us-west-2": "sellingpartnerapi-na.amazon.com",
    "eu-west-1": "sellingpartnerapi-eu.amazon.com",
}


def get_sp_api_config() -> SpApiConfig:
    """
    Read SP-API config from env. Raises RuntimeError if any required var is missing.
    Call this when creating SpApiClient to fail fast.
    """
    region = _require("AWS_REGION")
    sp_endpoint = _optional("SP_API_ENDPOINT", _DEFAULT_ENDPOINTS.get(region, "sellingpartnerapi-na.amazon.com"))
    return SpApiConfig(
        lwa_client_id=_require("LWA_CLIENT_ID"),
        lwa_client_secret=_require("LWA_CLIENT_SECRET"),
        lwa_refresh_token=_optional_or_none("LWA_REFRESH_TOKEN"),
        lwa_endpoint=_optional("LWA_ENDPOINT", "https://api.amazon.com/auth/o2/token"),
        aws_access_key_id=_require("AWS_ACCESS_KEY_ID"),
        aws_secret_access_key=_require("AWS_SECRET_ACCESS_KEY"),
        aws_region=region,
        sp_api_endpoint=sp_endpoint,
    )
