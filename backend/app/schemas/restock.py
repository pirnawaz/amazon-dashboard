"""Pydantic schemas for Restock Plan API (POST /api/restock/plan)."""
from __future__ import annotations

from pydantic import BaseModel, Field


class RestockPlanRequest(BaseModel):
    """Request body for POST /api/restock/plan."""

    sku: str = Field(..., min_length=1, description="Product SKU")
    marketplace: str = Field(..., min_length=1, description="Marketplace code (e.g. US)")
    lead_time_days: int = Field(..., ge=1, le=365, description="Lead time in days (1-365)")
    service_level: float = Field(
        default=0.95,
        ge=0.80,
        le=0.99,
        description="Target service level (e.g. 0.95 = 95% fill rate)",
    )
    current_inventory: int | None = Field(
        default=None,
        ge=0,
        description="Current on-hand inventory units (manual for now)",
    )


class RestockPlanResponse(BaseModel):
    """Response for POST /api/restock/plan."""

    sku: str
    marketplace: str
    lead_time_days: int
    service_level: float
    data_end_date: str
    avg_daily_demand: float
    lead_time_demand: float
    safety_stock: float
    reorder_quantity: int
    mape_30d: float
    days_of_cover: float | None = None
    expected_stockout_date: str | None = None
    stockout_before_lead_time: bool | None = None
