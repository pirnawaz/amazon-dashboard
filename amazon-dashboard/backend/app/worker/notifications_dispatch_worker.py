"""
Sprint 17: Notifications dispatch worker.

Runs periodically: retry failed notifications (up to configured max attempts),
runs ops health checks (stale orders/ads, job failures), logs a job_run entry per run.
Enable with ENABLE_NOTIFICATIONS=true and ENABLE_OPS_HEALTH_CHECKS=true.
"""
from __future__ import annotations

import logging
import os
import time

from app.core.config import settings
from app.db.session import SessionLocal
from app.services.job_run_log import record_job_finish, record_job_start
from app.services.notifications import retry_failed_notifications
from app.services.ops_health import run_ops_health_checks

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("notifications_dispatch_worker")

NOTIFICATIONS_INTERVAL_SECONDS = int(os.getenv("NOTIFICATIONS_INTERVAL_SECONDS", "300"))  # 5 min
JOB_NAME = "notifications_dispatch"


def _enabled() -> bool:
    return getattr(settings, "enable_notifications", True) or getattr(
        settings, "enable_ops_health_checks", True
    )


def run_once() -> None:
    """Retry failed notifications and run ops health checks. Log job_run (started, success/failed)."""
    if not _enabled():
        logger.debug("notifications_dispatch_worker disabled (ENABLE_* flags)")
        return
    db = SessionLocal()
    try:
        run_id = record_job_start(db, JOB_NAME)
        try:
            if settings.enable_notifications:
                retry_result = retry_failed_notifications(db)
                logger.info(
                    "notifications_retry_done",
                    extra={"sent": retry_result["sent"], "failed": retry_result["failed"], "skipped": retry_result["skipped"]},
                )
            if settings.enable_ops_health_checks:
                health_result = run_ops_health_checks(db)
                logger.info(
                    "ops_health_checks_done",
                    extra={
                        "orders_stale": health_result["orders_stale"],
                        "ads_stale": health_result["ads_stale"],
                        "job_failures": len(health_result["job_failures"]),
                        "notifications_emitted": health_result["notifications_emitted"],
                    },
                )
            record_job_finish(db, run_id, "success")
        except Exception as e:
            record_job_finish(db, run_id, "failed", error=str(e))
            db.commit()
            logger.exception("notifications_dispatch_worker failed: %s", e)
            raise
        db.commit()
    except Exception as e:
        logger.exception("notifications_dispatch_worker failed: %s", e)
        try:
            db.rollback()
        except Exception:
            pass
        raise
    finally:
        db.close()


def main() -> None:
    logger.info(
        "Notifications dispatch worker starting (interval=%s s, ENABLE_NOTIFICATIONS=%s, ENABLE_OPS_HEALTH_CHECKS=%s)",
        NOTIFICATIONS_INTERVAL_SECONDS,
        getattr(settings, "enable_notifications", True),
        getattr(settings, "enable_ops_health_checks", True),
    )
    while True:
        try:
            run_once()
        except Exception as e:
            logger.exception("notifications_dispatch_worker run failed: %s", e)
        logger.info("Sleeping %s seconds", NOTIFICATIONS_INTERVAL_SECONDS)
        time.sleep(NOTIFICATIONS_INTERVAL_SECONDS)


if __name__ == "__main__":
    main()
