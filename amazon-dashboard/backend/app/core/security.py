from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

import bcrypt
from jose import jwt


def hash_password(password: str) -> str:
    # bcrypt has a 72-byte limit; truncate to avoid ValueError with long passwords
    raw = password.encode("utf-8")[:72]
    return bcrypt.hashpw(raw, bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    raw = password.encode("utf-8")[:72]
    return bcrypt.checkpw(raw, password_hash.encode("utf-8"))


def create_access_token(
    *,
    subject: str,
    secret: str,
    algorithm: str,
    expires_minutes: int,
    role: str | None = None,
    **extra_claims: Any,
) -> str:
    """Create a JWT with sub (subject), iat, exp. Optionally include role and other claims."""
    now = datetime.now(timezone.utc)
    exp = now + timedelta(minutes=expires_minutes)
    payload: dict[str, Any] = {"sub": subject, "iat": int(now.timestamp()), "exp": exp}
    if role is not None:
        payload["role"] = role
    payload.update(extra_claims)
    return jwt.encode(payload, secret, algorithm=algorithm)


def decode_token(*, token: str, secret: str, algorithm: str) -> dict[str, Any]:
    return jwt.decode(token, secret, algorithms=[algorithm])


def role_from_payload(payload: dict[str, Any]) -> str:
    """Role from JWT payload; if missing or invalid, return 'owner' for backward compatibility."""
    r = payload.get("role")
    return r if r in ("owner", "partner") else "owner"
