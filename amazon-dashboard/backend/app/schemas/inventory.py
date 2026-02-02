from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class InventoryUpsertRequest(BaseModel):
    """Body for PUT /api/inventory."""

    sku: str = Field(..., min_length=1)
    marketplace: str = Field(..., min_length=1)
    on_hand_units: float = Field(..., ge=0)
    reserved_units: float = Field(default=0, ge=0)
    source: str = Field(default="manual")
    note: str | None = None


# Phase 11.4: freshness status for SKU-level inventory
InventoryFreshnessStatus = Literal["unknown", "fresh", "warning", "critical"]


class InventoryItemResponse(BaseModel):
    """Single inventory level with computed freshness."""

    sku: str
    marketplace: str
    on_hand_units: float
    reserved_units: float
    available_units: float
    source: str
    note: str | None
    updated_at: str
    created_at: str
    freshness_days: int = Field(..., description="Floor of (now - updated_at) in days")
    is_stale: bool = Field(..., description="True if freshness_days >= 7")
    # Phase 11.4: hour-based freshness from as_of_at (or updated_at)
    as_of_at: str | None = Field(None, description="Timestamp used for freshness (as_of_at or updated_at)")
    inventory_freshness: InventoryFreshnessStatus = Field(
        "unknown", description="unknown | fresh | warning | critical"
    )
    inventory_age_hours: float | None = Field(None, description="Age in hours since as_of_at/updated_at")


class InventoryListResponse(BaseModel):
    """GET /api/inventory response."""

    items: list[InventoryItemResponse]


class RestockRow(BaseModel):
    sku: str
    title: str | None
    asin: str | None
    on_hand: int
    avg_daily_units: float
    days_of_cover: float
    reorder_qty: int
    risk_level: Literal["CRITICAL", "LOW", "OK"]
    # Phase 11.5: source of on_hand when from inventory_levels (spapi | manual); null when legacy snapshot
    inventory_source: str | None = Field(None, description="spapi | manual when from inventory_levels")


class RestockResponse(BaseModel):
    days: int
    target_days: int
    marketplace: str
    limit: int
    items: list[RestockRow]
