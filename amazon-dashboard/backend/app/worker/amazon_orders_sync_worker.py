"""
Amazon orders sync worker (Phase 10.2 + 10.3).

Runs run_orders_sync for the single-tenant connection.
dry_run=False only when ENABLE_SPAPI_ORDERS_SYNC=true; otherwise dry_run=True (stub).
"""
from __future__ import annotations

import logging
import os

from sqlalchemy import select

from app.db.session import SessionLocal
from app.models.amazon_connection import AmazonConnection
from app.services.amazon_orders_sync import run_orders_sync
from app.services.job_run_log import record_job_finish, record_job_start

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("amazon_orders_sync_worker")


def _dry_run_from_env() -> bool:
    """dry_run=False only if ENABLE_SPAPI_ORDERS_SYNC=true (case-insensitive)."""
    val = (os.getenv("ENABLE_SPAPI_ORDERS_SYNC") or "").strip().lower()
    return val not in ("true", "1", "yes")


def _include_items_from_env() -> bool:
    """include_items=True only if ENABLE_SPAPI_ORDER_ITEMS_SYNC=true (case-insensitive)."""
    val = (os.getenv("ENABLE_SPAPI_ORDER_ITEMS_SYNC") or "").strip().lower()
    return val in ("true", "1", "yes")


def _inventory_sync_enabled_from_env() -> bool:
    """ENABLE_SPAPI_INVENTORY_SYNC=true enables inventory sync (Phase 11.1). Manual only for now; no auto-run."""
    val = (os.getenv("ENABLE_SPAPI_INVENTORY_SYNC") or "").strip().lower()
    return val in ("true", "1", "yes")


def run_once(dry_run: bool | None = None, include_items: bool | None = None) -> None:
    """Load single connection and run orders sync. dry_run/include_items from env if None."""
    if dry_run is None:
        dry_run = _dry_run_from_env()
    if include_items is None:
        include_items = _include_items_from_env()
    db = SessionLocal()
    try:
        conn = db.scalar(select(AmazonConnection).order_by(AmazonConnection.id).limit(1))
        if conn is None:
            logger.info("No amazon_connection; skipping orders sync")
            return
        run_id = record_job_start(db, "orders_sync", metadata={"dry_run": dry_run, "include_items": include_items})
        try:
            run_orders_sync(db, conn, dry_run=dry_run, include_items=include_items)
            status = (conn.last_orders_sync_status or "ok").lower() if conn.last_orders_sync_status else "ok"
            if status == "error":
                record_job_finish(
                    db, run_id, "failed",
                    error=conn.last_orders_sync_error,
                    metadata={"orders_count": conn.last_orders_sync_orders_count},
                )
            else:
                record_job_finish(
                    db, run_id, "success",
                    metadata={"orders_count": conn.last_orders_sync_orders_count, "items_count": conn.last_orders_sync_items_count},
                )
        except Exception as e:
            record_job_finish(db, run_id, "failed", error=str(e))
            db.commit()
            logger.exception("Orders sync job failed: %s", e)
            raise
        db.commit()
        logger.info("Orders sync job done (dry_run=%s, include_items=%s)", dry_run, include_items)
    except Exception as e:
        logger.exception("Orders sync job failed: %s", e)
        try:
            db.rollback()
        except Exception:
            pass
        raise
    finally:
        db.close()


def main() -> None:
    dry_run = _dry_run_from_env()
    include_items = _include_items_from_env()
    logger.info("Amazon orders sync worker (dry_run=%s, include_items=%s)", dry_run, include_items)
    run_once(dry_run=dry_run, include_items=include_items)


if __name__ == "__main__":
    main()
