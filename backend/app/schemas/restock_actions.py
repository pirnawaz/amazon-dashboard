"""Pydantic schemas for Restock Actions API (Phase 5C)."""
from __future__ import annotations

from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field


class DemandRangeDaily(BaseModel):
    """Daily demand range: low, expected, high (daily equivalents)."""

    low: float = Field(..., ge=0, description="Low daily demand (conservative)")
    expected: float = Field(..., ge=0, description="Expected daily demand")
    high: float = Field(..., ge=0, description="High daily demand (upper bound)")


class RestockActionItem(BaseModel):
    """A single restock action item (Total or per-SKU)."""

    sku: str | None = Field(None, description="Product SKU; null for total/aggregate")
    marketplace: str | None = Field(None, description="Marketplace code (e.g. US)")
    horizon_days: int = Field(..., ge=1, description="Forecast horizon in days")
    lead_time_days: int = Field(..., ge=1, description="Lead time in days")
    service_level: float = Field(..., ge=0, le=1, description="Target service level (0–1)")
    current_stock_units: float | None = Field(
        None, description="Current on-hand stock; null if not provided"
    )
    daily_demand_estimate: float = Field(
        ..., ge=0, description="Daily demand from forecast intelligence"
    )
    demand_range_daily: DemandRangeDaily = Field(
        ..., description="Low / expected / high daily demand"
    )
    days_of_cover_expected: float | None = Field(
        None, description="Days of cover at expected demand"
    )
    days_of_cover_low: float | None = Field(
        None, description="Days of cover in worst case (faster sell-through)"
    )
    days_of_cover_high: float | None = Field(
        None, description="Days of cover in best case (slower sell-through)"
    )
    stockout_date_expected: date | None = Field(
        None, description="Expected date of stockout"
    )
    order_by_date: date | None = Field(
        None, description="Recommended order-by date (stockout - lead time)"
    )
    suggested_reorder_qty_expected: float = Field(
        ..., ge=0, description="Suggested reorder quantity (expected demand)"
    )
    suggested_reorder_qty_high: float = Field(
        ..., ge=0, description="Buffered reorder quantity (high demand)"
    )
    status: Literal["healthy", "watch", "urgent", "insufficient_data"] = Field(
        ..., description="Traffic-light status for UI"
    )
    recommendation: str = Field(..., description="Plain-English recommendation")
    reasoning: list[str] = Field(..., description="Bullet-point reasoning")


class RestockActionsResponse(BaseModel):
    """Response for GET /restock/actions/total and GET /restock/actions/sku/{sku}."""

    generated_at: datetime = Field(..., description="When the response was generated")
    items: list[RestockActionItem] = Field(..., description="List of restock action items")
