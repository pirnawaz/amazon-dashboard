"""Sprint 14: Pydantic schemas for Ads attribution and SKU profitability endpoints."""
from __future__ import annotations

from datetime import date
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


class SkuProfitabilityRow(BaseModel):
    """Single SKU profitability row with revenue, costs, and profit metrics."""

    model_config = ConfigDict(from_attributes=True)

    sku: str
    marketplace_code: str
    revenue: float
    ad_spend: float | None = None
    attributed_sales: float | None = None
    organic_sales: float | None = None
    units_sold: int
    unit_cogs: float | None = None
    total_cogs: float | None = None
    gross_profit: float | None = None
    net_profit: float | None = None
    acos: float | None = Field(
        default=None,
        description="Advertising Cost of Sales (ad_spend / attributed_sales)",
    )
    roas: float | None = Field(
        default=None,
        description="Return on Ad Spend (attributed_sales / ad_spend)",
    )
    warning_flags: list[str] = Field(
        default_factory=list,
        description="Warning flags: missing_cogs, missing_attribution, missing_mapping",
    )


class SkuProfitabilityResponse(BaseModel):
    """Response for SKU profitability endpoint."""

    model_config = ConfigDict(from_attributes=True)

    days: int
    marketplace: str
    items: list[SkuProfitabilityRow]


class SkuTimeseriesPoint(BaseModel):
    """Single data point for SKU timeseries."""

    model_config = ConfigDict(from_attributes=True)

    date: str
    revenue: float
    ad_spend: float | None = None
    attributed_sales: float | None = None
    net_profit: float | None = None
    units: int


class SkuTimeseriesResponse(BaseModel):
    """Response for SKU timeseries endpoint."""

    model_config = ConfigDict(from_attributes=True)

    sku: str
    days: int
    marketplace: str
    points: list[SkuTimeseriesPoint]


class SkuCostBase(BaseModel):
    """Base schema for SKU cost."""

    sku: str = Field(..., min_length=1, max_length=255)
    marketplace_code: str | None = Field(
        default=None,
        max_length=20,
        description="Marketplace code (null for global)",
    )
    unit_cost: Decimal = Field(..., ge=0, description="Cost per unit")
    currency: str | None = Field(default=None, max_length=10)


class SkuCostCreate(SkuCostBase):
    """Schema for creating a SKU cost entry."""

    pass


class SkuCostUpdate(BaseModel):
    """Schema for updating a SKU cost entry."""

    unit_cost: Decimal | None = Field(default=None, ge=0)
    currency: str | None = Field(default=None, max_length=10)


class SkuCostResponse(SkuCostBase):
    """Schema for SKU cost response."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    updated_at: str | None = None


class SkuCostListResponse(BaseModel):
    """Response for listing SKU costs."""

    model_config = ConfigDict(from_attributes=True)

    items: list[SkuCostResponse]
