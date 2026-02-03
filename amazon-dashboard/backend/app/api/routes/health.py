"""Sprint 19: Unified health (ok + version + db) and metrics (owner-only)."""
from __future__ import annotations

from sqlalchemy import func, select, text

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.api.deps.permissions import require_owner
from app.core.version import VERSION
from app.db.session import engine, get_db
from app.models.amazon_connection import AmazonConnection
from app.models.ads import AdsAccount
from app.models.job_run import JobRun
from app.models.notification_delivery import NotificationDelivery
from app.models.user import User

router = APIRouter()


def _db_ok() -> bool:
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return True
    except Exception:
        return False


@router.get("/version")
def get_version():
    """Return app version for debugging. Matches package.json / config/version.ts."""
    return {"version": VERSION}


@router.get("/health")
def health():
    """Unified health: ok + version + db connectivity. Returns 503 if DB unreachable."""
    db_ok = _db_ok()
    payload = {"status": "ok", "version": VERSION, "db": "ok" if db_ok else "fail"}
    if not db_ok:
        return JSONResponse(content=payload, status_code=503)
    return payload


@router.get("/ready")
def ready():
    """Check DB connectivity (SELECT 1). Returns ok or fail."""
    if _db_ok():
        return {"status": "ok"}
    return JSONResponse(content={"status": "fail"}, status_code=503)


@router.get("/metrics")
def metrics(
    user: User = Depends(require_owner),
    db: Session = Depends(get_db),
):
    """Lightweight metrics for owners: counts and last sync times. No secrets."""
    last_orders = db.scalar(
        select(AmazonConnection.last_orders_sync_at).order_by(
            AmazonConnection.last_orders_sync_at.desc().nullslast()
        ).limit(1)
    )
    last_ads = db.scalar(
        select(AdsAccount.last_sync_at).order_by(AdsAccount.last_sync_at.desc().nullslast()).limit(1)
    )
    job_rows = db.execute(
        select(JobRun.job_name, JobRun.status, func.count(JobRun.id)).group_by(
            JobRun.job_name, JobRun.status
        )
    ).all()
    job_run_counts = {f"{j}_{s}": c for (j, s, c) in job_rows}
    notif_pending = db.scalar(
        select(func.count()).select_from(NotificationDelivery).where(
            NotificationDelivery.status == "pending"
        )
    ) or 0
    notif_failed = db.scalar(
        select(func.count()).select_from(NotificationDelivery).where(
            NotificationDelivery.status == "failed"
        )
    ) or 0
    return {
        "last_orders_sync_at": last_orders.isoformat() if last_orders else None,
        "last_ads_sync_at": last_ads.isoformat() if last_ads else None,
        "job_run_counts": job_run_counts,
        "notification_deliveries_pending": notif_pending,
        "notification_deliveries_failed": notif_failed,
    }
