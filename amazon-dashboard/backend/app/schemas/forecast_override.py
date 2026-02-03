"""Pydantic schemas for forecast overrides and related. Sprint 15."""
from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, Field, model_validator


class ForecastOverrideCreate(BaseModel):
    """Create forecast override."""
    sku: str | None = None
    marketplace_code: str | None = None
    start_date: date
    end_date: date
    override_type: Literal["absolute", "multiplier"]
    value: Decimal = Field(..., ge=0)
    reason: str | None = None

    @model_validator(mode="after")
    def check_dates_and_value(self):
        if self.start_date > self.end_date:
            raise ValueError("start_date must be <= end_date")
        if self.override_type == "multiplier" and self.value <= 0:
            raise ValueError("multiplier value must be > 0")
        return self


class ForecastOverrideUpdate(BaseModel):
    """Update forecast override (partial)."""
    sku: str | None = None
    marketplace_code: str | None = None
    start_date: date | None = None
    end_date: date | None = None
    override_type: Literal["absolute", "multiplier"] | None = None
    value: Decimal | None = Field(None, ge=0)
    reason: str | None = None

    @model_validator(mode="after")
    def check_dates_and_value(self):
        if self.start_date is not None and self.end_date is not None and self.start_date > self.end_date:
            raise ValueError("start_date must be <= end_date")
        if self.override_type == "multiplier" and self.value is not None and self.value <= 0:
            raise ValueError("multiplier value must be > 0")
        return self


class ForecastOverrideResponse(BaseModel):
    """Response for a single forecast override."""
    id: int
    sku: str | None
    marketplace_code: str | None
    start_date: date
    end_date: date
    override_type: str
    value: Decimal
    reason: str | None
    created_by_user_id: int | None
    created_by_email: str | None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ForecastBoundPoint(BaseModel):
    """Single confidence bound point: date, predicted_units, lower, upper."""
    date: str
    predicted_units: float
    lower: float
    upper: float


class ForecastDrift(BaseModel):
    """Drift detection result."""
    flag: bool
    window_days: int
    mae: float
    mape: float
    threshold: float


class AppliedOverrideOut(BaseModel):
    """Applied override in forecast response."""
    id: int
    override_type: str
    value: float
    start_date: str
    end_date: str
