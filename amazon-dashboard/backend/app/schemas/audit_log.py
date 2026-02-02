"""Pydantic schemas for audit log API."""
from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field


class AuditLogEntry(BaseModel):
    """Single audit log entry for API response."""

    id: UUID = Field(..., description="Audit log entry ID")
    created_at: datetime = Field(..., description="When the action occurred")
    actor_user_id: int = Field(..., description="User ID who performed the action")
    actor_email: str | None = Field(None, description="Actor email (if joined)")
    action: str = Field(..., description="Action identifier")
    resource_type: str = Field(..., description="Resource type")
    resource_id: str | None = Field(None, description="Resource identifier")
    metadata: dict[str, Any] | None = Field(None, description="Optional extra data")

    model_config = {"from_attributes": True}


class AuditLogListResponse(BaseModel):
    """Paginated list of audit log entries."""

    items: list[AuditLogEntry] = Field(..., description="Audit log entries")
    limit: int = Field(..., description="Page size")
    offset: int = Field(..., description="Offset")
    total: int = Field(..., description="Total count")
