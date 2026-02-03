"""
Amazon Ads sync worker (Sprint 13).

Runs run_ads_sync for the single ads account. Respects rate limits; incremental sync by date.
Enable with ENABLE_AMAZON_ADS_SYNC=true; otherwise dry_run (no DB writes).
"""
from __future__ import annotations

import logging
import os

from sqlalchemy import select

from app.db.session import SessionLocal
from app.models.ads import AdsAccount
from app.services.amazon_ads_sync import run_ads_sync

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
        result = run_ads_sync(db, acc, use_mock_metrics=True, dry_run=dry_run)
        logger.info(
            "Ads sync job done (dry_run=%s): profiles=%s campaigns=%s metrics=%s error=%s",
            dry_run,
            result.get("profiles_upserted", 0),
            result.get("campaigns_upserted", 0),
            result.get("metrics_upserted", 0),
            result.get("error"),
        )
    except Exception as e:
        logger.exception("Ads sync job failed: %s", e)
        db.rollback()
        raise
    finally:
        db.close()


def main() -> None:
    dry_run = _dry_run_from_env()
    logger.info("Amazon Ads sync worker (dry_run=%s)", dry_run)
    run_once(dry_run=dry_run)


if __name__ == "__main__":
    main()
