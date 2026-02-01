"""Pydantic schemas for Alerts API (Phase 7B)."""
from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class AlertEventResponse(BaseModel):
    """Single alert event for API response."""

    id: int = Field(..., description="Alert event ID")
    alert_type: str = Field(..., description="urgent_restock | reorder_soon | inventory_stale | order_by_passed")
    severity: str = Field(..., description="critical | warning | info")
    sku: str | None = Field(None, description="Product SKU")
    marketplace: str | None = Field(None, description="Marketplace code")
    title: str = Field(..., description="Alert title")
    message: str = Field(..., description="Alert message")
    is_acknowledged: bool = Field(..., description="Whether the alert has been acknowledged")
    acknowledged_at: datetime | None = Field(None, description="When acknowledged")
    created_at: datetime = Field(..., description="When the alert was created")

    model_config = {"from_attributes": True}


class AlertListResponse(BaseModel):
    """List of alert events."""

    items: list[AlertEventResponse] = Field(..., description="Alert events")


class AlertAcknowledgeRequest(BaseModel):
    """Request body for acknowledging alerts."""

    ids: list[int] = Field(..., description="Alert event IDs to acknowledge", min_length=1)


class AlertSettingsResponse(BaseModel):
    """Alert settings (single row id=1)."""

    email_enabled: bool = Field(..., description="Whether email notifications are enabled")
    email_recipients: str | None = Field(None, description="Comma-separated recipients; null = all users")
    send_inventory_stale: bool = Field(..., description="Send email for inventory_stale alerts")
    send_urgent_restock: bool = Field(..., description="Send email for urgent_restock alerts")
    send_reorder_soon: bool = Field(..., description="Send email for reorder_soon alerts")
    send_order_by_passed: bool = Field(..., description="Send email for order_by_passed alerts")
    stale_days_threshold: int = Field(..., description="Days after which inventory is considered stale")
    updated_at: datetime = Field(..., description="Last updated")

    model_config = {"from_attributes": True}


class AlertSettingsUpdateRequest(BaseModel):
    """Request body for updating alert settings (all optional)."""

    email_enabled: bool | None = None
    email_recipients: str | None = None
    send_inventory_stale: bool | None = None
    send_urgent_restock: bool | None = None
    send_reorder_soon: bool | None = None
    send_order_by_passed: bool | None = None
    stale_days_threshold: int | None = Field(None, ge=1, le=60, description="1..60 days")
