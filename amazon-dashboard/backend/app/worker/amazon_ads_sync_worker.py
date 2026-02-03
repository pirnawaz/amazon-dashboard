"""
Amazon Ads sync worker (Sprint 13).

Runs run_ads_sync for the single ads account on an interval. Respects rate limits; incremental sync by date.
Enable with ENABLE_AMAZON_ADS_SYNC=true; otherwise dry_run (no DB writes).
Configure ADS_SYNC_INTERVAL_SECONDS (default 3600) for how often to run.
"""
from __future__ import annotations

import logging
import os
import time

from sqlalchemy import select

from app.db.session import SessionLocal
from app.models.ads import AdsAccount
from app.services.amazon_ads_sync import run_ads_sync
from app.services.job_run_log import record_job_finish, record_job_start

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("amazon_ads_sync_worker")


def _dry_run_from_env() -> bool:
    """dry_run=False only if ENABLE_AMAZON_ADS_SYNC=true (case-insensitive)."""
    val = (os.getenv("ENABLE_AMAZON_ADS_SYNC") or "").strip().lower()
    return val not in ("true", "1", "yes")


def run_once(dry_run: bool | None = None) -> None:
    """Load single ads account and run sync. dry_run from env if None."""
    if dry_run is None:
        dry_run = _dry_run_from_env()
    db = SessionLocal()
    try:
        acc = db.scalar(select(AdsAccount).order_by(AdsAccount.id).limit(1))
        if acc is None:
            logger.info("No ads_account; skipping ads sync")
            return
        run_id = record_job_start(db, "ads_sync", metadata={"dry_run": dry_run})
        try:
            result = run_ads_sync(db, acc, use_mock_metrics=True, dry_run=dry_run)
            record_job_finish(
                db, run_id, "success",
                metadata={
                    "profiles_upserted": result.get("profiles_upserted", 0),
                    "campaigns_upserted": result.get("campaigns_upserted", 0),
                    "metrics_upserted": result.get("metrics_upserted", 0),
                },
            )
            logger.info(
                "Ads sync job done (dry_run=%s): profiles=%s campaigns=%s metrics=%s error=%s",
                dry_run,
                result.get("profiles_upserted", 0),
                result.get("campaigns_upserted", 0),
                result.get("metrics_upserted", 0),
                result.get("error"),
            )
        except Exception as e:
            record_job_finish(db, run_id, "failed", error=str(e))
            db.commit()
            logger.exception("Ads sync job failed: %s", e)
            raise
        # run_ads_sync commits internally when not dry_run
        if dry_run:
            db.rollback()
        else:
            db.commit()
    except Exception as e:
        logger.exception("Ads sync job failed: %s", e)
        try:
            db.rollback()
        except Exception:
            pass
        raise
    finally:
        db.close()


def main() -> None:
    dry_run = _dry_run_from_env()
    interval_seconds = int(os.getenv("ADS_SYNC_INTERVAL_SECONDS", "3600"))
    logger.info(
        "Amazon Ads sync worker starting (dry_run=%s, interval=%s s)",
        dry_run,
        interval_seconds,
    )
    while True:
        try:
            run_once(dry_run=dry_run)
        except Exception as e:
            logger.exception("Ads sync worker run failed: %s", e)
        logger.info("Sleeping %s seconds", interval_seconds)
        time.sleep(interval_seconds)


if __name__ == "__main__":
    main()
