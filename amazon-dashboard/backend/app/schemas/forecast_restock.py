"""Pydantic schemas for forecast restock plan API. Phase 11.4: optional inventory freshness. Phase 12.3: data_quality."""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.data_quality import DataQuality


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
    # Phase 11.4: optional inventory freshness (when inventory_levels used)
    inventory_freshness: Literal["unknown", "fresh", "warning", "critical"] | None = Field(
        None, description="unknown | fresh | warning | critical"
    )
    inventory_age_hours: float | None = Field(None, description="Age in hours since as_of_at")
    inventory_as_of_at: str | None = Field(None, description="Last inventory timestamp (ISO)")
    inventory_warning_message: str | None = Field(
        None, description="Human-friendly warning when stale"
    )
    # Phase 11.5: source of on-hand used for recommended_reorder_qty
    inventory_source: Literal["spapi", "manual", "legacy"] | None = Field(
        None, description="spapi | manual | legacy (inventory_snapshots fallback)"
    )
    no_inventory_data: bool = Field(
        False, description="True when no inventory row or snapshot was used (on_hand treated as 0)"
    )
    # Phase 12.3: demand data quality (mapped pipeline, exclusions, warnings)
    data_quality: DataQuality | None = Field(
        None, description="Demand source mode, exclusions, and warnings"
    )
