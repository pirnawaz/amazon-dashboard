"""Audit log service: write entries for owner-only actions."""
from __future__ import annotations

import json
from typing import Any
from uuid import uuid4

from sqlalchemy.orm import Session

from app.models.audit_log import AuditLog


def _coerce_metadata(value: Any) -> dict[str, Any] | None:
    """Ensure metadata is JSON-serializable; coerce to safe dict or None."""
    if value is None:
        return None
    if isinstance(value, dict):
        try:
            json.dumps(value)
            return value
        except (TypeError, ValueError):
            return {"_raw": str(value)}
    try:
        json.dumps(value)
        return {"value": value}
    except (TypeError, ValueError):
        return {"_raw": str(value)}


def write_audit_log(
    db: Session,
    actor_user_id: int,
    action: str,
    resource_type: str,
    resource_id: str | None = None,
    metadata: Any = None,
) -> AuditLog:
    """
    Append an audit log entry. Metadata is coerced to JSON-serializable;
    non-serializable values are stored as string in _raw.
    """
    safe_meta = _coerce_metadata(metadata)
    entry = AuditLog(
        id=uuid4(),
        actor_user_id=actor_user_id,
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        metadata_=safe_meta,
    )
    db.add(entry)
    db.flush()
    return entry
