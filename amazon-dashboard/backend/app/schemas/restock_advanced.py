"""Pydantic schemas for Sprint 16 restock advanced: suppliers, settings, recommendations, what-if."""
from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Any

from pydantic import BaseModel, Field


class SupplierCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    contact_email: str | None = Field(None, max_length=320)
    notes: str | None = None


class SupplierUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=255)
    contact_email: str | None = Field(None, max_length=320)
    notes: str | None = None


class SupplierOut(BaseModel):
    id: int
    name: str
    contact_email: str | None
    notes: str | None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class SupplierSettingCreate(BaseModel):
    sku: str = Field(..., min_length=1, max_length=255)
    marketplace_code: str | None = Field(None, max_length=20)
    supplier_id: int = Field(..., ge=1)
    lead_time_days_mean: int = Field(..., ge=1, le=365)
    lead_time_days_std: int = Field(0, ge=0, le=90)
    moq_units: int = Field(0, ge=0)
    pack_size_units: int = Field(1, ge=1)
    reorder_policy: str = Field("min_max", max_length=32)
    min_days_of_cover: int = Field(0, ge=0)
    max_days_of_cover: int = Field(0, ge=0)
    service_level: Decimal = Field(Decimal("0.95"), ge=Decimal("0.50"), le=Decimal("0.99"))
    holding_cost_rate: Decimal | None = None
    stockout_cost_per_unit: Decimal | None = None


class SupplierSettingUpdate(BaseModel):
    supplier_id: int | None = Field(None, ge=1)
    lead_time_days_mean: int | None = Field(None, ge=1, le=365)
    lead_time_days_std: int | None = Field(None, ge=0, le=90)
    moq_units: int | None = Field(None, ge=0)
    pack_size_units: int | None = Field(None, ge=1)
    reorder_policy: str | None = Field(None, max_length=32)
    min_days_of_cover: int | None = Field(None, ge=0)
    max_days_of_cover: int | None = Field(None, ge=0)
    service_level: Decimal | None = Field(None, ge=Decimal("0.50"), le=Decimal("0.99"))
    holding_cost_rate: Decimal | None = None
    stockout_cost_per_unit: Decimal | None = None
    is_active: bool | None = None


class SupplierSettingOut(BaseModel):
    id: int
    sku: str
    marketplace_code: str | None
    supplier_id: int
    lead_time_days_mean: int
    lead_time_days_std: int
    moq_units: int
    pack_size_units: int
    reorder_policy: str
    min_days_of_cover: int
    max_days_of_cover: int
    service_level: Decimal
    holding_cost_rate: Decimal | None
    stockout_cost_per_unit: Decimal | None
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class RestockRecommendationRowOut(BaseModel):
    sku: str
    marketplace_code: str
    supplier_id: int | None
    supplier_name: str | None
    on_hand_units: float
    inbound_units: float
    reserved_units: float
    available_units: float
    daily_demand_forecast: float
    days_of_cover: float | None
    lead_time_days_mean: int
    lead_time_days_std: int
    safety_stock_units: float
    reorder_point_units: float
    target_stock_units: float
    recommended_order_units: float
    recommended_order_units_rounded: float
    priority_score: float
    reason_flags: list[str] = Field(default_factory=list)


class RestockRecommendationDetailOut(RestockRecommendationRowOut):
    """Same as row; detail may extend with breakdown later."""


class RestockWhatIfRequest(BaseModel):
    sku: str = Field(..., min_length=1)
    marketplace_code: str = Field(..., min_length=1)
    lead_time_mean: int | None = Field(None, ge=1, le=365)
    lead_time_std: int | None = Field(None, ge=0, le=90)
    service_level: float | None = Field(None, ge=0.5, le=0.99)
    daily_demand_override: float | None = Field(None, ge=0)
    on_hand_override: float | None = Field(None, ge=0)
    inbound_override: float | None = Field(None, ge=0)
    reserved_override: float | None = Field(None, ge=0)


class RestockWhatIfResponse(BaseModel):
    result: RestockRecommendationDetailOut
