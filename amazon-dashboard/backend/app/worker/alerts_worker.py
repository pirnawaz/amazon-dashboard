"""
Alerts worker: runs alert generation on an interval (Phase 7B).

Does NOT start FastAPI. Uses same DB session factory as backend.
Configure ALERTS_INTERVAL_SECONDS (default 900 = 15 min).
Env (DB, SMTP) from environment / docker-compose.
"""
from __future__ import annotations

import logging
import time

from app.core.config import settings
from app.db.session import SessionLocal
from app.services.alerts_service import run_alert_generation_once

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("alerts_worker")

INTERVAL = getattr(settings, "alerts_interval_seconds", 900)


def main() -> None:
    logger.info("Alerts worker starting (interval=%s seconds)", INTERVAL)
    while True:
        db = SessionLocal()
        try:
            logger.info("Running alert generation...")
            result = run_alert_generation_once(db)
            logger.info("Alert generation done: created=%s, emailed=%s", result["created"], result["emailed"])
        except Exception as e:
            logger.exception("Alert generation failed: %s", e)
        finally:
            db.close()
        logger.info("Sleeping %s seconds", INTERVAL)
        time.sleep(INTERVAL)


if __name__ == "__main__":
    main()
