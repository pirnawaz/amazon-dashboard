"""Sprint 17: Admin-only system health endpoints (summary, jobs, notifications)."""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps.permissions import require_owner
from app.db.session import get_db
from app.models.amazon_connection import AmazonConnection
from app.models.ads import AdsAccount
from app.models.job_run import JobRun
from app.models.notification_delivery import NotificationDelivery
from app.models.user import User
from app.schemas.ops_health import (
    HealthSummary,
    JobRunOut,
    LastJobRunSummary,
    NotificationDeliveryOut,
)

logger = logging.getLogger(__name__)

router = APIRouter()


def _last_orders_sync_at(db: Session) -> datetime | None:
    stmt = select(AmazonConnection.last_orders_sync_at).order_by(
        AmazonConnection.last_orders_sync_at.desc().nullslast()
    ).limit(1)
    return db.scalar(stmt)


def _last_ads_sync_at(db: Session) -> datetime | None:
    stmt = select(AdsAccount.last_sync_at).order_by(
        AdsAccount.last_sync_at.desc().nullslast()
    ).limit(1)
    return db.scalar(stmt)


def _last_job_runs(db: Session, job_names: list[str]) -> list[LastJobRunSummary]:
    result: list[LastJobRunSummary] = []
    for job_name in job_names:
        stmt = (
            select(JobRun)
            .where(JobRun.job_name == job_name)
            .order_by(JobRun.started_at.desc())
            .limit(1)
        )
        run = db.scalar(stmt)
        if run:
            result.append(
                LastJobRunSummary(
                    job_name=job_name,
                    last_started_at=run.started_at,
                    last_status=run.status,
                    last_finished_at=run.finished_at,
                    last_error=run.error,
                )
            )
        else:
            result.append(
                LastJobRunSummary(
                    job_name=job_name,
                    last_started_at=None,
                    last_status=None,
                    last_finished_at=None,
                    last_error=None,
                )
            )
    return result


def _failed_notifications_count(db: Session) -> int:
    stmt = select(func.count()).select_from(NotificationDelivery).where(
        NotificationDelivery.status == "failed"
    )
    return db.scalar(stmt) or 0


def _ts(dt: datetime | None) -> float | None:
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.timestamp()


def _overall_status(
    last_orders: datetime | None,
    last_ads: datetime | None,
    job_runs: list[LastJobRunSummary],
    failed_notifications: int,
) -> str:
    from app.core.config import settings

    now = datetime.now(timezone.utc)
    orders_threshold = now.timestamp() - settings.orders_stale_hours * 3600
    ads_threshold = now.timestamp() - settings.ads_stale_hours * 3600
    critical = False
    warning = False
    ts_orders = _ts(last_orders)
    if ts_orders is None or ts_orders < orders_threshold:
        warning = True
    ts_ads = _ts(last_ads)
    if ts_ads is None or ts_ads < ads_threshold:
        warning = True
    for j in job_runs:
        if j.last_status == "failed":
            critical = True
            break
    if failed_notifications > 0:
        warning = True
    if critical:
        return "critical"
    if warning:
        return "warning"
    return "ok"


@router.get("/admin/health/summary", response_model=HealthSummary)
def get_health_summary(
    user: User = Depends(require_owner),
    db: Session = Depends(get_db),
) -> HealthSummary:
    """Overall status (ok | warning | critical), last sync times, last job runs, failed notifications count."""
    logger.info("admin_health_summary", extra={"user_id": user.id})
    last_orders = _last_orders_sync_at(db)
    last_ads = _last_ads_sync_at(db)
    job_names = ["orders_sync", "ads_sync", "notifications_dispatch"]
    last_job_runs = _last_job_runs(db, job_names)
    failed_count = _failed_notifications_count(db)
    status = _overall_status(last_orders, last_ads, last_job_runs, failed_count)
    return HealthSummary(
        status=status,
        last_orders_sync_at=last_orders,
        last_ads_sync_at=last_ads,
        last_job_runs=last_job_runs,
        failed_notifications_count=failed_count,
    )


@router.get("/admin/health/jobs")
def get_health_jobs(
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0, le=10000),
    user: User = Depends(require_owner),
    db: Session = Depends(get_db),
) -> list[JobRunOut]:
    """Recent job_run rows, newest first (paginated)."""
    logger.info("admin_health_jobs", extra={"user_id": user.id, "limit": limit, "offset": offset})
    stmt = (
        select(JobRun)
        .order_by(JobRun.started_at.desc())
        .offset(offset)
        .limit(limit)
    )
    rows = list(db.scalars(stmt).all())
    return [JobRunOut.model_validate(r) for r in rows]


@router.get("/admin/health/notifications")
def get_health_notifications(
    status: str | None = Query(default=None, description="Filter by status: pending, sent, failed"),
    severity: str | None = Query(default=None, description="Filter by severity: info, warning, critical"),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0, le=10000),
    user: User = Depends(require_owner),
    db: Session = Depends(get_db),
) -> list[NotificationDeliveryOut]:
    """Recent notification_delivery rows, filterable and paginated."""
    logger.info(
        "admin_health_notifications",
        extra={"user_id": user.id, "status": status, "severity": severity, "limit": limit, "offset": offset},
    )
    stmt = select(NotificationDelivery).order_by(NotificationDelivery.created_at.desc())
    if status:
        stmt = stmt.where(NotificationDelivery.status == status)
    if severity:
        stmt = stmt.where(NotificationDelivery.severity == severity)
    stmt = stmt.offset(offset).limit(limit)
    rows = list(db.scalars(stmt).all())
    return [NotificationDeliveryOut.model_validate(r) for r in rows]
