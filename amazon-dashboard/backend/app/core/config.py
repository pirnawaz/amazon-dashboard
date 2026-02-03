from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

# Load .env from repo root (amazon-dashboard/.env)
REPO_ROOT = Path(__file__).resolve().parents[3]
ENV_PATH = REPO_ROOT / ".env"
load_dotenv(ENV_PATH)


def _require(name: str) -> str:
    val = os.getenv(name)
    if not val:
        raise RuntimeError(f"Missing required environment variable: {name}")
    return val


def _app_env() -> str:
    val = os.getenv("APP_ENV", "development").strip().lower()
    if val not in ("development", "production"):
        raise RuntimeError(
            f"Invalid APP_ENV: {val}. Must be 'development' or 'production'."
        )
    return val


@dataclass(frozen=True)
class Settings:
    app_env: str = _app_env()

    database_url: str = _require("DATABASE_URL")

    jwt_secret: str = _require("JWT_SECRET")
    jwt_algorithm: str = os.getenv("JWT_ALGORITHM", "HS256")
    jwt_expires_minutes: int = int(os.getenv("JWT_EXPIRES_MINUTES", "60"))

    frontend_origin: str = os.getenv("FRONTEND_ORIGIN", "http://localhost:5173")

    # Rate limiting: requests per minute per IP (and per user when JWT present)
    rate_limit_per_minute: int = int(os.getenv("RATE_LIMIT_PER_MINUTE", "100"))

    # Optional: SMTP for alert emails (Phase 7B)
    smtp_host: str | None = os.getenv("SMTP_HOST") or None
    smtp_port: int = int(os.getenv("SMTP_PORT", "587"))
    smtp_user: str | None = os.getenv("SMTP_USER") or None
    smtp_pass: str | None = os.getenv("SMTP_PASS") or None
    smtp_from: str | None = os.getenv("SMTP_FROM") or None
    smtp_tls: bool = (os.getenv("SMTP_TLS", "true").strip().lower() in ("true", "1", "yes"))

    # Alerts worker: interval in seconds (default 15 minutes)
    alerts_interval_seconds: int = int(os.getenv("ALERTS_INTERVAL_SECONDS", "900"))

    # Optional: base64 urlsafe Fernet key for encrypting LWA refresh token at rest (TOKEN_ENCRYPTION_KEY)
    token_encryption_key: str | None = os.getenv("TOKEN_ENCRYPTION_KEY") or None

    # Inventory freshness (Phase 11.4): age in hours for stale warnings
    inventory_stale_warning_hours: int = int(os.getenv("INVENTORY_STALE_WARNING_HOURS", "24"))
    inventory_stale_critical_hours: int = int(os.getenv("INVENTORY_STALE_CRITICAL_HOURS", "72"))

    # Amazon Ads API (Sprint 13): optional; when set, sync can call Ads API
    amazon_ads_client_id: str | None = os.getenv("AMAZON_ADS_CLIENT_ID") or None
    amazon_ads_client_secret: str | None = os.getenv("AMAZON_ADS_CLIENT_SECRET") or None
    amazon_ads_region: str = os.getenv("AMAZON_ADS_REGION", "NA").strip().upper()
    # Rate limit: requests per second (Amazon recommends throttling)
    amazon_ads_rate_limit_rps: float = float(os.getenv("AMAZON_ADS_RATE_LIMIT_RPS", "2.0"))
    # Sprint 14: attribution lookback days for purchased product / advertised product reports
    amazon_ads_attribution_lookback_days: int = int(os.getenv("AMAZON_ADS_ATTRIBUTION_LOOKBACK_DAYS", "30"))


settings = Settings()
