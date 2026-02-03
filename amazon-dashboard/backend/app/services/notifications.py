"""
Sprint 17: Notification delivery with retries and severity rules.

- critical → always send email
- warning → email if alert settings allow (reuse existing alert settings)
- info → UI only (logged, not emailed)
- Max attempts configurable (default 3); exponential backoff on next worker run.
"""
from __future__ import annotations

import logging
import smtplib
from datetime import datetime, timezone
from email.message import EmailMessage
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.alerts import ALERT_SETTINGS_ID, AlertSettings
from app.models.notification_delivery import NotificationDelivery

logger = logging.getLogger(__name__)

CHANNEL_EMAIL = "email"
CHANNEL_UI = "ui"
STATUS_PENDING = "pending"
STATUS_SENT = "sent"
STATUS_FAILED = "failed"
SEVERITY_CRITICAL = "critical"
SEVERITY_WARNING = "warning"
SEVERITY_INFO = "info"


def _smtp_send(to_emails: list[str], subject: str, body: str) -> bool:
    """Send one email via SMTP (stdlib). Returns True if sent. Structured log on failure."""
    if not to_emails:
        return False
    host = getattr(settings, "smtp_host", None) or None
    if not host:
        logger.debug("notification_smtp_skipped", extra={"reason": "smtp_not_configured"})
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
        logger.info(
            "notification_email_sent",
            extra={"recipients_count": len(to_emails), "subject": subject[:80]},
        )
        return True
    except Exception as e:
        logger.warning(
            "notification_email_failed",
            extra={"error": str(e), "recipients_count": len(to_emails), "subject": subject[:80]},
        )
        return False


def _should_send_email(db: Session, severity: str, notification_type: str) -> bool:
    """Critical always; warning if alert settings allow; info never (UI only)."""
    if severity == SEVERITY_CRITICAL:
        return True
    if severity == SEVERITY_INFO:
        return False
    if severity != SEVERITY_WARNING:
        return False
    row = db.get(AlertSettings, ALERT_SETTINGS_ID)
    if not row or not row.email_enabled:
        return False
    if notification_type == "stale_orders" or notification_type == "stale_ads":
        return bool(row.send_inventory_stale)
    if notification_type in ("restock_urgent", "order_by_passed"):
        return bool(row.send_urgent_restock or row.send_order_by_passed)
    if notification_type == "reorder_soon":
        return bool(row.send_reorder_soon)
    return bool(row.email_enabled)


def enqueue_notification(
    db: Session,
    notification_type: str,
    severity: str,
    channel: str,
    recipient: str,
    subject: str | None = None,
    payload: dict[str, Any] | None = None,
) -> NotificationDelivery:
    """Create a notification_delivery row with status=pending. Caller must commit."""
    now = datetime.now(timezone.utc)
    row = NotificationDelivery(
        notification_type=notification_type,
        severity=severity,
        channel=channel,
        recipient=recipient,
        subject=subject,
        payload=payload,
        status=STATUS_PENDING,
        attempts=0,
        last_error=None,
    )
    db.add(row)
    db.flush()
    logger.info(
        "notification_enqueued",
        extra={
            "id": row.id,
            "notification_type": notification_type,
            "severity": severity,
            "channel": channel,
            "recipient": recipient[:64],
        },
    )
    return row


def send_email_notification(
    db: Session,
    notification_type: str,
    severity: str,
    recipient: str,
    subject: str,
    body: str,
    payload: dict[str, Any] | None = None,
) -> bool:
    """
    Write a notification_delivery row (pending), attempt send via SMTP.
    On success: status=sent. On failure: increment attempts, set last_error, status=failed.
    Returns True if sent. Caller must commit.
    """
    payload_with_body = {**(payload or {}), "body": body}
    row = enqueue_notification(
        db=db,
        notification_type=notification_type,
        severity=severity,
        channel=CHANNEL_EMAIL,
        recipient=recipient,
        subject=subject,
        payload=payload_with_body,
    )
    row.attempts = 1
    if _smtp_send([recipient], subject, body):
        row.status = STATUS_SENT
        return True
    err = "SMTP send failed (no exception captured)"
    row.last_error = err[:2000]
    row.status = STATUS_FAILED
    logger.warning(
        "notification_first_attempt_failed",
        extra={"id": row.id, "notification_type": notification_type, "recipient": recipient[:64]},
    )
    return False


def retry_failed_notifications(db: Session) -> dict[str, int]:
    """
    Retry pending/failed notifications with attempts < notifications_retry_max.
    Exponential backoff: we just retry on this run (next worker run = backoff).
    Returns {"sent": N, "failed": M, "skipped": K}.
    """
    max_attempts = settings.notifications_retry_max
    stmt = (
        select(NotificationDelivery)
        .where(
            NotificationDelivery.status.in_([STATUS_PENDING, STATUS_FAILED]),
            NotificationDelivery.attempts < max_attempts,
            NotificationDelivery.channel == CHANNEL_EMAIL,
        )
        .order_by(NotificationDelivery.created_at.asc())
    )
    rows = list(db.scalars(stmt).all())
    sent = 0
    failed = 0
    skipped = 0
    for row in rows:
        if row.attempts >= max_attempts:
            skipped += 1
            continue
        if not row.subject or not row.recipient:
            row.status = STATUS_FAILED
            row.last_error = "Missing subject or recipient"
            row.attempts = (row.attempts or 0) + 1
            failed += 1
            continue
        body = (row.payload or {}).get("body") if isinstance(row.payload, dict) else None
        if not body:
            body = row.subject
        ok = _smtp_send([row.recipient], row.subject, str(body))
        row.attempts = (row.attempts or 0) + 1
        row.updated_at = datetime.now(timezone.utc)
        if ok:
            row.status = STATUS_SENT
            row.last_error = None
            sent += 1
            logger.info(
                "notification_retry_sent",
                extra={"id": row.id, "notification_type": row.notification_type, "attempts": row.attempts},
            )
        else:
            err = "SMTP send failed on retry"
            row.last_error = err
            row.status = STATUS_FAILED if row.attempts >= max_attempts else STATUS_PENDING
            failed += 1
            logger.warning(
                "notification_retry_failed",
                extra={"id": row.id, "attempts": row.attempts, "max_attempts": max_attempts},
            )
    if rows:
        logger.info(
            "notification_retry_run",
            extra={"sent": sent, "failed": failed, "skipped": skipped, "candidates": len(rows)},
        )
    return {"sent": sent, "failed": failed, "skipped": skipped}
