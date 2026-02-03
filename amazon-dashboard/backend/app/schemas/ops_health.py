"""Sprint 17: Admin system health and job/notification schemas."""
from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel


class JobRunOut(BaseModel):
    id: int
    job_name: str
    status: str
    started_at: datetime
    finished_at: datetime | None
    error: str | None
    job_metadata: dict[str, Any] | None = None

    model_config = {"from_attributes": True}


class NotificationDeliveryOut(BaseModel):
    id: int
    notification_type: str
    severity: str
    channel: str
    recipient: str
    subject: str | None
    status: str
    attempts: int
    last_error: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class LastJobRunSummary(BaseModel):
    job_name: str
    last_started_at: datetime | None
    last_status: str | None
    last_finished_at: datetime | None
    last_error: str | None


class HealthSummary(BaseModel):
    status: str  # ok | warning | critical
    last_orders_sync_at: datetime | None
    last_ads_sync_at: datetime | None
    last_job_runs: list[LastJobRunSummary]
    failed_notifications_count: int
