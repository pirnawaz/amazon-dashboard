"""Pydantic schemas for forecast restock plan API."""
from __future__ import annotations

from pydantic import BaseModel


class ForecastRestockPlanResponse(BaseModel):
    """Response for GET /forecast/restock-plan."""

    sku: str
    marketplace: str
    horizon_days: int
    lead_time_days: int
    service_level: float
    avg_daily_forecast_units: float
    forecast_units_lead_time: float
    safety_stock_units: float
    recommended_reorder_qty: int
