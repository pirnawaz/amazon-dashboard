"""
Sprint 17: Stale data detection and ops health checks.

- Orders stale: last orders sync > orders_stale_hours (default 12h)
- Ads stale: last ads sync > ads_stale_hours (default 24h)
- Background job failures: last run status = failed for any critical job
- Emit notifications: stale_orders → warning, stale_ads → warning, repeated job failure → critical
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.amazon_connection import AmazonConnection
from app.models.ads import AdsAccount
from app.models.job_run import JobRun
from app.services.notifications import (
    SEVERITY_CRITICAL,
    SEVERITY_WARNING,
    enqueue_notification,
    send_email_notification,
)

logger = logging.getLogger(__name__)

JOB_ORDERS_SYNC = "orders_sync"
JOB_ADS_SYNC = "ads_sync"
JOB_NOTIFICATIONS_DISPATCH = "notifications_dispatch"
CRITICAL_JOBS = (JOB_ORDERS_SYNC, JOB_ADS_SYNC, JOB_NOTIFICATIONS_DISPATCH)
NOTIFICATION_TYPE_STALE_ORDERS = "stale_orders"
NOTIFICATION_TYPE_STALE_ADS = "stale_ads"
NOTIFICATION_TYPE_JOB_FAILURE = "system_error"


def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


def check_orders_stale(db: Session) -> tuple[bool, datetime | None]:
    """Return (is_stale, last_orders_sync_at). Uses most recent connection last_orders_sync_at."""
    stmt = select(AmazonConnection.last_orders_sync_at).order_by(
        AmazonConnection.last_orders_sync_at.desc().nullslast()
    ).limit(1)
    last_at = db.scalar(stmt)
    if last_at is None:
        logger.info("ops_health_orders_stale_check", extra={"result": "no_sync_record"})
        return True, None
    threshold = _now_utc() - timedelta(hours=settings.orders_stale_hours)
    last_utc = last_at.replace(tzinfo=timezone.utc) if last_at.tzinfo is None else last_at
    is_stale = last_utc < threshold
    logger.info(
        "ops_health_orders_stale_check",
        extra={"last_orders_sync_at": last_at.isoformat(), "stale_hours": settings.orders_stale_hours, "is_stale": is_stale},
    )
    return is_stale, last_at


def check_ads_stale(db: Session) -> tuple[bool, datetime | None]:
    """Return (is_stale, last_ads_sync_at). Uses most recent ads account last_sync_at."""
    stmt = select(AdsAccount.last_sync_at).order_by(
        AdsAccount.last_sync_at.desc().nullslast()
    ).limit(1)
    last_at = db.scalar(stmt)
    if last_at is None:
        logger.info("ops_health_ads_stale_check", extra={"result": "no_sync_record"})
        return True, None
    threshold = _now_utc() - timedelta(hours=settings.ads_stale_hours)
    last_utc = last_at.replace(tzinfo=timezone.utc) if last_at.tzinfo is None else last_at
    is_stale = last_utc < threshold
    logger.info(
        "ops_health_ads_stale_check",
        extra={"last_ads_sync_at": last_at.isoformat(), "stale_hours": settings.ads_stale_hours, "is_stale": is_stale},
    )
    return is_stale, last_at


def check_job_failures(db: Session) -> list[dict[str, Any]]:
    """Return list of {job_name, last_run_id, last_status, last_error} for jobs whose last run failed."""
    failed: list[dict[str, Any]] = []
    for job_name in CRITICAL_JOBS:
        stmt = (
            select(JobRun)
            .where(JobRun.job_name == job_name)
            .order_by(JobRun.started_at.desc())
            .limit(1)
        )
        run = db.scalar(stmt)
        if run and run.status == "failed":
            failed.append({
                "job_name": job_name,
                "last_run_id": run.id,
                "last_status": run.status,
                "last_error": run.error,
            })
            logger.warning(
                "ops_health_job_failure",
                extra={"job_name": job_name, "run_id": run.id, "error": (run.error or "")[:200]},
            )
    return failed


def run_ops_health_checks(db: Session) -> dict[str, Any]:
    """
    Run stale orders/ads and job failure checks. Emit notifications (enqueue or send).
    Returns summary: orders_stale, ads_stale, job_failures, notifications_emitted.
    """
    if not settings.enable_ops_health_checks:
        logger.debug("ops_health_checks_skipped", extra={"reason": "disabled"})
        return {"orders_stale": False, "ads_stale": False, "job_failures": [], "notifications_emitted": 0}

    emitted = 0
    orders_stale, last_orders_at = check_orders_stale(db)
    ads_stale, last_ads_at = check_ads_stale(db)
    job_failures = check_job_failures(db)

    if orders_stale:
        title = "Orders sync is stale"
        message = (
            f"Last orders sync was more than {settings.orders_stale_hours} hours ago. "
            + (f"Last sync: {last_orders_at.isoformat()}" if last_orders_at else "No successful sync recorded.")
        )
        enqueue_notification(
            db=db,
            notification_type=NOTIFICATION_TYPE_STALE_ORDERS,
            severity=SEVERITY_WARNING,
            channel="ui",
            recipient="admin",
            subject=title,
            payload={"message": message, "stale_hours": settings.orders_stale_hours},
        )
        emitted += 1
        if settings.enable_notifications:
            from app.models.user import User
            from app.services.alerts_service import get_or_create_settings
            settings_row = get_or_create_settings(db)
            if settings_row.email_enabled and settings_row.send_inventory_stale:
                recipients = [e.strip() for e in (settings_row.email_recipients or "").split(",") if e.strip()]
                if not recipients:
                    recipients = list(db.scalars(select(User.email)).all())
                for rec in recipients[:5]:
                    if send_email_notification(
                        db=db,
                        notification_type=NOTIFICATION_TYPE_STALE_ORDERS,
                        severity=SEVERITY_WARNING,
                        recipient=rec,
                        subject=f"[Amazon Dashboard] WARNING: {title}",
                        body=f"{title}\n\n{message}",
                        payload={"message": message},
                    ):
                        emitted += 1
                        break

    if ads_stale:
        title = "Ads sync is stale"
        message = (
            f"Last ads sync was more than {settings.ads_stale_hours} hours ago. "
            + (f"Last sync: {last_ads_at.isoformat()}" if last_ads_at else "No successful sync recorded.")
        )
        enqueue_notification(
            db=db,
            notification_type=NOTIFICATION_TYPE_STALE_ADS,
            severity=SEVERITY_WARNING,
            channel="ui",
            recipient="admin",
            subject=title,
            payload={"message": message, "stale_hours": settings.ads_stale_hours},
        )
        emitted += 1
        if settings.enable_notifications:
            from app.models.user import User
            from app.services.alerts_service import get_or_create_settings
            settings_row = get_or_create_settings(db)
            if settings_row.email_enabled and settings_row.send_inventory_stale:
                recipients = [e.strip() for e in (settings_row.email_recipients or "").split(",") if e.strip()]
                if not recipients:
                    recipients = list(db.scalars(select(User.email)).all())
                for rec in recipients[:5]:
                    if send_email_notification(
                        db=db,
                        notification_type=NOTIFICATION_TYPE_STALE_ADS,
                        severity=SEVERITY_WARNING,
                        recipient=rec,
                        subject=f"[Amazon Dashboard] WARNING: {title}",
                        body=f"{title}\n\n{message}",
                        payload={"message": message},
                    ):
                        emitted += 1
                        break

    for jf in job_failures:
        title = f"Critical job failed: {jf['job_name']}"
        message = (jf.get("last_error") or "Unknown error")[:500]
        enqueue_notification(
            db=db,
            notification_type=NOTIFICATION_TYPE_JOB_FAILURE,
            severity=SEVERITY_CRITICAL,
            channel="email",
            recipient="admin",
            subject=title,
            payload={"job_name": jf["job_name"], "message": message, "run_id": jf.get("last_run_id")},
        )
        emitted += 1
        if settings.enable_notifications:
            from app.models.user import User
            recipients = list(db.scalars(select(User.email)).all())
            for rec in (recipients or ["admin@example.com"])[:5]:
                if send_email_notification(
                    db=db,
                    notification_type=NOTIFICATION_TYPE_JOB_FAILURE,
                    severity=SEVERITY_CRITICAL,
                    recipient=rec,
                    subject=f"[Amazon Dashboard] CRITICAL: {title}",
                    body=f"{title}\n\n{message}",
                    payload={"job_name": jf["job_name"], "message": message},
                ):
                    emitted += 1
                    break

    logger.info(
        "ops_health_checks_completed",
        extra={
            "orders_stale": orders_stale,
            "ads_stale": ads_stale,
            "job_failures_count": len(job_failures),
            "notifications_emitted": emitted,
        },
    )
    return {
        "orders_stale": orders_stale,
        "ads_stale": ads_stale,
        "job_failures": job_failures,
        "notifications_emitted": emitted,
    }
