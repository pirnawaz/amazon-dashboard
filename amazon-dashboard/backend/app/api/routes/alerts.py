"""Alerts API: list, acknowledge, settings, run (Phase 7B)."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query

from app.api.deps.permissions import require_owner
from app.api.routes.me import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.alerts import (
    AlertAcknowledgeRequest,
    AlertEventResponse,
    AlertListResponse,
    AlertSettingsResponse,
    AlertSettingsUpdateRequest,
)
from app.services.alerts_service import (
    acknowledge_alerts,
    get_or_create_settings,
    list_alerts,
    run_alert_generation_once,
    update_settings,
)
from app.services.audit_log import write_audit_log
from sqlalchemy.orm import Session

router = APIRouter()


def _event_to_response(event) -> AlertEventResponse:
    """Build AlertEventResponse from AlertEvent model."""
    return AlertEventResponse(
        id=event.id,
        alert_type=event.alert_type,
        severity=event.severity,
        sku=event.sku,
        marketplace=event.marketplace,
        title=event.title,
        message=event.message,
        is_acknowledged=event.is_acknowledged,
        acknowledged_at=event.acknowledged_at,
        created_at=event.created_at,
    )


@router.get("/alerts", response_model=AlertListResponse)
def get_alerts(
    severity: str | None = Query(default=None, description="critical | warning | info"),
    unacknowledged: bool = Query(default=False, description="Only unacknowledged"),
    limit: int = Query(default=200, ge=1, le=500),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AlertListResponse:
    """List alert events with optional filters."""
    items = list_alerts(
        db,
        severity=severity,
        unacknowledged_only=unacknowledged,
        limit=limit,
    )
    return AlertListResponse(items=[_event_to_response(e) for e in items])


@router.post("/alerts/ack")
def post_alerts_ack(
    body: AlertAcknowledgeRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    """Acknowledge alert events by ID. Returns { \"acknowledged\": count }."""
    count = acknowledge_alerts(db, body.ids)
    return {"acknowledged": count}


@router.get("/alerts/settings", response_model=AlertSettingsResponse)
def get_alerts_settings(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AlertSettingsResponse:
    """Get alert/email settings (single row id=1)."""
    row = get_or_create_settings(db)
    return AlertSettingsResponse(
        email_enabled=row.email_enabled,
        email_recipients=row.email_recipients,
        send_inventory_stale=row.send_inventory_stale,
        send_urgent_restock=row.send_urgent_restock,
        send_reorder_soon=row.send_reorder_soon,
        send_order_by_passed=row.send_order_by_passed,
        stale_days_threshold=row.stale_days_threshold,
        updated_at=row.updated_at,
    )


@router.put("/alerts/settings", response_model=AlertSettingsResponse)
def put_alerts_settings(
    body: AlertSettingsUpdateRequest,
    user: User = Depends(require_owner),
    db: Session = Depends(get_db),
) -> AlertSettingsResponse:
    """Update alert/email settings (owner only). stale_days_threshold must be 1..60."""
    patch = body.model_dump(exclude_unset=True)
    try:
        row = update_settings(db, patch)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    write_audit_log(
        db,
        actor_user_id=user.id,
        action="alert_settings.update",
        resource_type="alert_settings",
        resource_id="global",
        metadata=patch,
    )
    db.commit()
    return AlertSettingsResponse(
        email_enabled=row.email_enabled,
        email_recipients=row.email_recipients,
        send_inventory_stale=row.send_inventory_stale,
        send_urgent_restock=row.send_urgent_restock,
        send_reorder_soon=row.send_reorder_soon,
        send_order_by_passed=row.send_order_by_passed,
        stale_days_threshold=row.stale_days_threshold,
        updated_at=row.updated_at,
    )


@router.post("/alerts/run")
def post_alerts_run(
    user: User = Depends(require_owner),
    db: Session = Depends(get_db),
) -> dict:
    """Trigger alert generation once (owner only). Returns created/emailed counts."""
    result = run_alert_generation_once(db)
    write_audit_log(
        db,
        actor_user_id=user.id,
        action="alerts.run_now",
        resource_type="alerts",
        resource_id="global",
    )
    db.commit()
    return result
