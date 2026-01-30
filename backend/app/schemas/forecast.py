"""Pydantic schemas for forecast API."""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel


class ForecastPoint(BaseModel):
    """Single point: date (ISO str) and units (int)."""
    date: str  # ISO date
    units: int


class ForecastResponse(BaseModel):
    """Response for GET /forecast/total and GET /forecast/sku."""
    kind: Literal["total", "sku"]
    sku: str | None
    marketplace: str
    history_days: int
    horizon_days: int
    model_name: str
    mae_30d: float
    actual_points: list[ForecastPoint]
    forecast_points: list[ForecastPoint]
