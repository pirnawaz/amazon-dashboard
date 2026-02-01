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


class RestockResponse(BaseModel):
    days: int
    target_days: int
    marketplace: str
    limit: int
    items: list[RestockRow]
