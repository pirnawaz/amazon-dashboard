"""Pydantic schemas for forecast API."""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel


class ForecastPoint(BaseModel):
    """Single point: date (ISO str) and units (int)."""
    date: str  # ISO date
    units: int


class BacktestPoint(BaseModel):
    """Single backtest point: date, actual_units, predicted_units."""
    date: str
    actual_units: int
    predicted_units: float


class ForecastRange(BaseModel):
    """Low, expected, and high forecast totals over the horizon."""
    low: float
    expected: float
    high: float


class ForecastIntelligence(BaseModel):
    """Forecast intelligence: trend, confidence, and range."""
    trend: Literal["increasing", "stable", "decreasing", "insufficient_data"]
    confidence: Literal["high", "medium", "low"]
    daily_demand_estimate: float
    volatility_cv: float
    forecast_range: ForecastRange


class ForecastResponse(BaseModel):
    """Response for GET /forecast/total and GET /forecast/sku. Phase 12.2: optional mapping health fields."""
    kind: Literal["total", "sku"]
    sku: str | None
    marketplace: str
    history_days: int
    horizon_days: int
    model_name: str
    mae_30d: float
    data_end_date: str
    mape_30d: float
    backtest_points: list[BacktestPoint]
    actual_points: list[ForecastPoint]
    forecast_points: list[ForecastPoint]
    intelligence: ForecastIntelligence
    recommendation: str
    reasoning: list[str]
    # Phase 12.2: mapping health (optional for backward compat)
    excluded_units: int | None = None
    excluded_skus: int | None = None
    unmapped_units_30d: int | None = None
    unmapped_share_30d: float | None = None
    warnings: list[str] | None = None
