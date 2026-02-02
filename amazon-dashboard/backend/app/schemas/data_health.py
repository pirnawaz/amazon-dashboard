"""Pydantic schemas for Data Health admin API (Phase 12.2)."""
from __future__ import annotations

from datetime import date

from pydantic import BaseModel, Field


class DataHealthSummary(BaseModel):
    """GET /admin/data-health/summary response."""

    unmapped_skus_total: int = Field(..., description="Count of distinct (sku, marketplace) with no confirmed/ignored/discontinued mapping")
    unmapped_units_30d: int = Field(..., description="Units sold in last 30 days from unmapped/pending SKUs")
    total_units_30d: int = Field(..., description="Total units sold in last 30 days")
    unmapped_share_30d: float = Field(..., ge=0, le=1, description="Fraction of units from unmapped/pending (0-1)")
    ignored_units_30d: int = Field(..., description="Units from ignored mappings in last 30 days")
    discontinued_units_30d: int = Field(..., description="Units from discontinued mappings in last 30 days")
    window_start: date = Field(..., description="Start of 30d window")
    window_end: date = Field(..., description="End of 30d window")


class TopUnmappedSkuRow(BaseModel):
    """One row in GET /admin/data-health/top-unmapped."""

    marketplace_code: str
    sku: str
    units_30d: int
    last_seen_date: date | None
    seen_in_orders: bool = True
    mapping_status: str | None = Field(None, description="null or 'pending'")


class TopUnmappedResponse(BaseModel):
    """GET /admin/data-health/top-unmapped response."""

    items: list[TopUnmappedSkuRow]


# --- Phase 12.4: Unmapped trend (last 12 weeks) ---
class UnmappedTrendRow(BaseModel):
    """One week in GET /admin/data-health/unmapped-trend."""

    week_start: date = Field(..., description="Start of week (Monday)")
    total_units: int = Field(..., description="Total units in that week")
    unmapped_units: int = Field(..., description="Units from unmapped/pending in that week")
    unmapped_share: float = Field(..., ge=0, le=1, description="Share of units unmapped (0-1)")


class UnmappedTrendResponse(BaseModel):
    """GET /admin/data-health/unmapped-trend response."""

    items: list[UnmappedTrendRow]
