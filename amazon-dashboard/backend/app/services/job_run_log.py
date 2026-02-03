"""Sprint 17: Log job_run entries (started, success, failed) for background workers."""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

from sqlalchemy.orm import Session

from app.models.job_run import JobRun

logger = logging.getLogger(__name__)


def record_job_start(db: Session, job_name: str, metadata: dict[str, Any] | None = None) -> int:
    """Insert a job_run row with status=started. Returns id. Caller must commit."""
    row = JobRun(
        job_name=job_name,
        status="started",
        started_at=datetime.now(timezone.utc),
        finished_at=None,
        error=None,
        job_metadata=metadata,
    )
    db.add(row)
    db.flush()
    logger.info("job_run_started", extra={"job_name": job_name, "run_id": row.id})
    return row.id


def record_job_finish(
    db: Session,
    run_id: int,
    status: str,
    error: str | None = None,
    metadata: dict[str, Any] | None = None,
) -> None:
    """Update job_run with status (success | failed), finished_at, optional error. Caller must commit."""
    row = db.get(JobRun, run_id)
    if not row:
        logger.warning("job_run_finish_missing", extra={"run_id": run_id, "status": status})
        return
    now = datetime.now(timezone.utc)
    row.status = status
    row.finished_at = now
    row.error = error[:2000] if error else None
    if metadata is not None:
        row.job_metadata = {**(row.job_metadata or {}), **metadata}
    db.flush()
    logger.info(
        "job_run_finished",
        extra={"job_name": row.job_name, "run_id": run_id, "status": status, "error": (error or "")[:200]},
    )
