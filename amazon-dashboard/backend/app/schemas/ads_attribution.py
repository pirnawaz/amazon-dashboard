"""Pydantic schemas for Ads attribution and SKU profitability (Sprint 14)."""
from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, Field


class SkuProfitabilityRow(BaseModel):
    """Single SKU profitability row."""

    sku: str
    marketplace_code: str
    revenue: Decimal
    ad_spend: Decimal | None = None
    attributed_sales: Decimal | None = None
    organic_sales: Decimal | None = None
    units_sold: int
    unit_cogs: Decimal | None = None
    total_cogs: Decimal | None = None
    gross_profit: Decimal | None = None
    net_profit: Decimal | None = None
    acos: Decimal | None = Field(None, description="ACOS = ad_spend/attributed_sales * 100 when attributed_sales > 0")
    roas: Decimal | None = Field(None, description="ROAS = attributed_sales/ad_spend when ad_spend > 0")
    warning_flags: list[str] = Field(default_factory=list)


class SkuProfitabilityResponse(BaseModel):
    """Response for GET /api/ads/attribution/sku-profitability."""

    days: int
    marketplace: str
    rows: list[SkuProfitabilityRow]


class SkuTimeseriesPoint(BaseModel):
    """Single day in SKU profitability timeseries."""

    date: date
    revenue: Decimal
    ad_spend: Decimal
    attributed_sales: Decimal | None = None
    net_profit: Decimal | None = None
    units: int


class SkuTimeseriesResponse(BaseModel):
    """Response for GET /api/ads/attribution/sku-timeseries."""

    sku: str
    days: int
    marketplace: str
    points: list[SkuTimeseriesPoint]


# --- SKU cost (COGS) CRUD schemas ---
class SkuCostCreate(BaseModel):
    """Create or update per-SKU cost."""

    sku: str = Field(..., min_length=1)
    marketplace_code: str | None = None
    unit_cost: Decimal = Field(..., ge=0)
    currency: str | None = None


class SkuCostResponse(BaseModel):
    """Single sku_cost row."""

    id: int
    sku: str
    marketplace_code: str | None
    unit_cost: Decimal
    currency: str | None
    updated_at: datetime

    model_config = {"from_attributes": True}
