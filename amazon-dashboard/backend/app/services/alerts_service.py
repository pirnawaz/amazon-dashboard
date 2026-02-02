"""
Alert generation service (Phase 7B).

Scans inventory_levels, reuses restock logic, creates alert_events with dedupe.
Optionally sends email via stdlib smtplib.
"""
from __future__ import annotations

import logging
import smtplib
from datetime import date, datetime, timedelta, timezone
from email.message import EmailMessage
from typing import Any

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.alerts import ALERT_SETTINGS_ID, AlertEvent, AlertSettings
from app.models.inventory import InventoryLevel
from app.models.user import User
from app.services.forecast_intelligence import build_intelligence
from app.services.forecasting import (
    _series_from_points,
    backtest_30d,
    seasonal_naive_weekly,
)
from app.services.inventory_service import (
    freshness_from_timestamp,
    get_inventory,
    list_inventory,
)
from app.services.restock_actions import compute_restock_action
from app.services.timeseries import (
    get_data_end_date_sku,
    get_daily_units_by_sku,
)

logger = logging.getLogger(__name__)

HISTORY_DAYS = 180
HORIZON_DAYS = 30
LEAD_TIME_DAYS = 14
SERVICE_LEVEL = 0.95


def _forecast_sku_for_restock(
    db: Session,
    sku: str,
    marketplace: str,
    horizon_days: int = HORIZON_DAYS,
) -> dict[str, Any] | None:
    """Same logic as restock_actions route: forecast + intelligence for one SKU."""
    end_date = get_data_end_date_sku(db, sku, marketplace)
    if end_date is None:
        return None
    start_date = end_date - timedelta(days=HISTORY_DAYS - 1)
    actual_list = get_daily_units_by_sku(db, sku, start_date, end_date, marketplace)
    mae_30d, mape_30d, _ = backtest_30d(actual_list, use_seasonal_naive=True)
    series = _series_from_points(actual_list)
    forecast_series = seasonal_naive_weekly(series, horizon_days)
    forecast_expected_total = float(forecast_series.sum())
    history_daily_units = [float(u) for _, u in actual_list]
    intelligence_result = build_intelligence(
        history_daily_units=history_daily_units,
        forecast_expected_total=forecast_expected_total,
        horizon_days=horizon_days,
        mape_30d=mape_30d,
        lead_time_days=None,
        current_stock_units=None,
    )
    return {
        "end_date": end_date,
        "forecast_expected_total": forecast_expected_total,
        "intelligence": intelligence_result,
    }


def get_or_create_settings(db: Session) -> AlertSettings:
    """Return alert settings row; create id=1 if missing. Enforce single row (id=1)."""
    row = db.get(AlertSettings, ALERT_SETTINGS_ID)
    if row is not None:
        return row
    row = AlertSettings(
        id=ALERT_SETTINGS_ID,
        email_enabled=False,
        email_recipients=None,
        send_inventory_stale=True,
        send_urgent_restock=True,
        send_reorder_soon=True,
        send_order_by_passed=True,
        stale_days_threshold=7,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def update_settings(db: Session, patch: dict[str, Any]) -> AlertSettings:
    """Update alert settings (id=1) with given fields; validate stale_days_threshold 1..60."""
    row = get_or_create_settings(db)
    if "email_enabled" in patch and patch["email_enabled"] is not None:
        row.email_enabled = bool(patch["email_enabled"])
    if "email_recipients" in patch:
        row.email_recipients = patch["email_recipients"] if patch["email_recipients"] else None
    if "send_inventory_stale" in patch and patch["send_inventory_stale"] is not None:
        row.send_inventory_stale = bool(patch["send_inventory_stale"])
    if "send_urgent_restock" in patch and patch["send_urgent_restock"] is not None:
        row.send_urgent_restock = bool(patch["send_urgent_restock"])
    if "send_reorder_soon" in patch and patch["send_reorder_soon"] is not None:
        row.send_reorder_soon = bool(patch["send_reorder_soon"])
    if "send_order_by_passed" in patch and patch["send_order_by_passed"] is not None:
        row.send_order_by_passed = bool(patch["send_order_by_passed"])
    if "stale_days_threshold" in patch and patch["stale_days_threshold"] is not None:
        v = int(patch["stale_days_threshold"])
        if not (1 <= v <= 60):
            raise ValueError("stale_days_threshold must be between 1 and 60")
        row.stale_days_threshold = v
    db.commit()
    db.refresh(row)
    return row


def list_alerts(
    db: Session,
    severity: str | None = None,
    unacknowledged_only: bool = False,
    limit: int = 200,
) -> list[AlertEvent]:
    """List alert events with optional filters."""
    stmt = select(AlertEvent).order_by(AlertEvent.created_at.desc())
    if severity:
        stmt = stmt.where(AlertEvent.severity == severity)
    if unacknowledged_only:
        stmt = stmt.where(AlertEvent.is_acknowledged == False)  # noqa: E712
    stmt = stmt.limit(max(1, min(limit, 500)))
    return list(db.scalars(stmt).all())


def acknowledge_alerts(db: Session, ids: list[int]) -> int:
    """Mark alert events as acknowledged; return count updated."""
    if not ids:
        return 0
    now = datetime.now(timezone.utc)
    stmt = select(AlertEvent).where(
        AlertEvent.id.in_(ids),
        AlertEvent.is_acknowledged == False,  # noqa: E712
    )
    rows = list(db.scalars(stmt).all())
    for row in rows:
        row.is_acknowledged = True
        row.acknowledged_at = now
    db.commit()
    return len(rows)


def _send_alert_email(
    to_emails: list[str],
    subject: str,
    body: str,
) -> bool:
    """Send one email via SMTP (stdlib). Returns True if sent."""
    if not to_emails:
        return False
    host = getattr(settings, "smtp_host", None) or None
    if not host:
        logger.debug("SMTP not configured; skipping email")
        return False
    port = getattr(settings, "smtp_port", 587)
    user = getattr(settings, "smtp_user", None)
    password = getattr(settings, "smtp_pass", None)
    from_addr = getattr(settings, "smtp_from", None) or user or to_emails[0]
    use_tls = getattr(settings, "smtp_tls", True)
    try:
        msg = EmailMessage()
        msg["Subject"] = subject
        msg["From"] = from_addr
        msg["To"] = ", ".join(to_emails)
        msg.set_content(body)
        with smtplib.SMTP(host, port) as smtp:
            if use_tls:
                smtp.starttls()
            if user and password:
                smtp.login(user, password)
            smtp.send_message(msg)
        return True
    except Exception as e:
        logger.warning("Failed to send alert email: %s", e)
        return False


def _recipient_emails(db: Session, settings_row: AlertSettings) -> list[str]:
    """Resolve recipient list: from email_recipients or all users."""
    if settings_row.email_recipients and settings_row.email_recipients.strip():
        return [e.strip() for e in settings_row.email_recipients.split(",") if e.strip()]
    users = db.scalars(select(User.email)).all()
    return list(users)


def _try_create_alert(
    db: Session,
    alert_type: str,
    severity: str,
    sku: str | None,
    marketplace: str | None,
    title: str,
    message: str,
    dedupe_key: str,
) -> AlertEvent | None:
    """Insert one alert; return the row if inserted, None if duplicate dedupe_key."""
    row = AlertEvent(
        alert_type=alert_type,
        severity=severity,
        sku=sku,
        marketplace=marketplace,
        title=title,
        message=message,
        dedupe_key=dedupe_key,
        is_acknowledged=False,
        acknowledged_at=None,
    )
    try:
        with db.begin_nested():
            db.add(row)
            db.flush()
        return row
    except IntegrityError:
        return None


def _stale_inventory_alert_for_inv(
    db: Session,
    inv: InventoryLevel,
    settings_row: AlertSettings,
    created_ref: list[int],
    emailed_ref: list[int],
) -> None:
    """Phase 11.4: Create stale inventory alert(s) from hour-based freshness; dedupe by sku+marketplace+severity."""
    sku = inv.sku
    marketplace = inv.marketplace
    ts = inv.as_of_at if inv.as_of_at is not None else inv.updated_at
    freshness_status, age_hours = freshness_from_timestamp(ts)
    if freshness_status not in ("warning", "critical") or age_hours is None:
        return
    last_ts_str = (inv.as_of_at or inv.updated_at).isoformat()
    severity = "critical" if freshness_status == "critical" else "warning"
    dedupe_key = f"inventory_stale:{marketplace}:{sku}:{severity}"
    title = f"Inventory stale — {sku} ({marketplace})"
    message = (
        f"SKU {sku}, marketplace {marketplace}: inventory data is {age_hours:.1f} hours old. "
        f"Last inventory timestamp: {last_ts_str}. Update or sync stock data for accurate restock alerts."
    )
    evt = _try_create_alert(
        db, "inventory_stale", severity, sku, marketplace, title, message, dedupe_key
    )
    if evt:
        created_ref[0] += 1
        if settings_row.email_enabled and settings_row.send_inventory_stale:
            recipients = _recipient_emails(db, settings_row)
            if recipients:
                subj = f"[Amazon Dashboard] {severity.upper()}: Inventory stale — {sku}"
                body = f"{title}\n\n{message}\n\nCreated: {evt.created_at}\n\nView: /alerts"
                if _send_alert_email(recipients, subj, body):
                    emailed_ref[0] += 1


def run_alert_generation_once(db: Session) -> dict[str, int]:
    """
    Scan inventory, compute restock actions, create alert_events (deduped).
    Optionally send emails per settings.
    Returns {"created": N, "emailed": M}.
    """
    created = 0
    emailed = 0
    created_ref = [0]
    emailed_ref = [0]
    settings_row = get_or_create_settings(db)
    today = date.today()

    inventory_items = list_inventory(db, marketplace=None, q=None, limit=500)
    for inv in inventory_items:
        sku = inv.sku
        marketplace = inv.marketplace
        stock_units = inv.available_units()

        # Phase 11.4: stale inventory alert (hour-based; dedupe by sku+marketplace+severity)
        _stale_inventory_alert_for_inv(db, inv, settings_row, created_ref, emailed_ref)
        created = created_ref[0]
        emailed = emailed_ref[0]

        # Restock action for this SKU+marketplace
        forecast_data = _forecast_sku_for_restock(db, sku, marketplace, HORIZON_DAYS)
        if forecast_data is None:
            continue


        end_date = forecast_data["end_date"]
        intelligence = forecast_data["intelligence"]
        forecast_expected = forecast_data["forecast_expected_total"]
        forecast_low = intelligence.forecast_low
        forecast_high = intelligence.forecast_high

        raw = compute_restock_action(
            sku=sku,
            marketplace=marketplace,
            horizon_days=HORIZON_DAYS,
            lead_time_days=LEAD_TIME_DAYS,
            service_level=SERVICE_LEVEL,
            current_stock_units=stock_units,
            forecast_expected_total=forecast_expected,
            forecast_low_total=forecast_low,
            forecast_high_total=forecast_high,
            daily_demand_estimate=intelligence.daily_demand_estimate,
            data_end_date=end_date,
            confidence=intelligence.confidence,
            trend=intelligence.trend,
        )
        status = raw.get("status") or "insufficient_data"
        order_by_date = raw.get("order_by_date")


        # 2) order_by_passed (critical) â€” check before urgent/watch so we emit one alert
        if order_by_date is not None and order_by_date < today:
            ob_str = order_by_date.isoformat()
            dedupe_key = f"order_by_passed:{marketplace}:{sku}:{ob_str}"
            title = f"Order-by date passed â€” {sku} ({marketplace})"
            message = f"Recommended order-by date was {ob_str}. Reorder as soon as possible to avoid stockout."
            evt = _try_create_alert(
                db, "order_by_passed", "critical", sku, marketplace, title, message, dedupe_key
            )
            if evt:
                created += 1
                if (
                    settings_row.email_enabled
                    and settings_row.send_order_by_passed
                ):
                    recipients = _recipient_emails(db, settings_row)
                    if recipients:
                        subj = f"[Amazon Dashboard] CRITICAL: Order-by date passed â€” {sku}"
                        body = f"{title}\n\n{message}\n\nCreated: {evt.created_at}\n\nView: /restock"
                        if _send_alert_email(recipients, subj, body):
                            emailed += 1

        # 3) urgent_restock
        if status == "urgent":
            ob_str = order_by_date.isoformat() if order_by_date else "N/A"
            dedupe_key = f"urgent_restock:{marketplace}:{sku}:{ob_str}"
            title = f"Urgent restock â€” {sku} ({marketplace})"
            message = raw.get("recommendation") or "Reorder now to avoid stockout during lead time."
            evt = _try_create_alert(
                db, "urgent_restock", "critical", sku, marketplace, title, message, dedupe_key
            )
            if evt:
                created += 1
                if (
                    settings_row.email_enabled
                    and settings_row.send_urgent_restock
                ):
                    recipients = _recipient_emails(db, settings_row)
                    if recipients:
                        subj = f"[Amazon Dashboard] CRITICAL: Urgent restock â€” {sku}"
                        body = f"{title}\n\n{message}\n\nCreated: {evt.created_at}\n\nView: /restock"
                        if _send_alert_email(recipients, subj, body):
                            emailed += 1

        # 4) reorder_soon (watch)
        if status == "watch":
            ob_str = order_by_date.isoformat() if order_by_date else "N/A"
            dedupe_key = f"reorder_soon:{marketplace}:{sku}:{ob_str}"
            title = f"Reorder soon â€” {sku} ({marketplace})"
            message = raw.get("recommendation") or "Reorder soon (within 7 days)."
            evt = _try_create_alert(
                db, "reorder_soon", "warning", sku, marketplace, title, message, dedupe_key
            )
            if evt:
                created += 1
                if (
                    settings_row.email_enabled
                    and settings_row.send_reorder_soon
                ):
                    recipients = _recipient_emails(db, settings_row)
                    if recipients:
                        subj = f"[Amazon Dashboard] WARNING: Reorder soon â€” {sku}"
                        body = f"{title}\n\n{message}\n\nCreated: {evt.created_at}\n\nView: /restock"
                        if _send_alert_email(recipients, subj, body):
                            emailed += 1

    try:
        db.commit()
    except Exception:
        db.rollback()
        raise

    return {"created": created, "emailed": emailed}
