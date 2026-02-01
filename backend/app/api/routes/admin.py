"""Admin API: owner-only endpoints (e.g. audit log)."""
from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps.permissions import require_owner
from app.db.session import get_db
from app.models.audit_log import AuditLog
from app.models.user import User
from app.schemas.audit_log import AuditLogEntry, AuditLogListResponse

router = APIRouter()


def _row_to_entry(row: tuple) -> AuditLogEntry:
    """Build AuditLogEntry from (AuditLog, User.email | None)."""
    log, actor_email = row
    meta = getattr(log, "metadata_", None) or getattr(log, "metadata", None)
    return AuditLogEntry(
        id=log.id,
        created_at=log.created_at,
        actor_user_id=log.actor_user_id,
        actor_email=actor_email,
        action=log.action,
        resource_type=log.resource_type,
        resource_id=log.resource_id,
        metadata=meta,
    )


@router.get("/admin/audit-log", response_model=AuditLogListResponse)
def get_audit_log(
    limit: int = Query(default=50, ge=1, le=200, description="Page size"),
    offset: int = Query(default=0, ge=0, description="Offset"),
    user: User = Depends(require_owner),
    db: Session = Depends(get_db),
) -> AuditLogListResponse:
    """List audit log entries (owner only). Sorted by created_at desc."""
    total_stmt = select(func.count()).select_from(AuditLog)
    total = db.scalar(total_stmt) or 0

    stmt = (
        select(AuditLog, User.email)
        .outerjoin(User, AuditLog.actor_user_id == User.id)
        .order_by(AuditLog.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    rows = db.execute(stmt).all()
    items = [_row_to_entry(r) for r in rows]
    return AuditLogListResponse(items=items, limit=limit, offset=offset, total=total)
