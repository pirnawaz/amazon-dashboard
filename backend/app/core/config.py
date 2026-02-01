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


settings = Settings()
