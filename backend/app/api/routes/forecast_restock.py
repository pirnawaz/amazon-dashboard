"""Forecast-based restock plan API."""
from __future__ import annotations

from datetime import timedelta
from math import ceil

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.routes.me import get_current_user
from app.db.session import get_db
from app.models.inventory_snapshot import InventorySnapshot
from app.models.marketplace import Marketplace
from app.models.user import User
from app.schemas.forecast_restock import ForecastRestockPlanResponse
from app.services.forecasting import _series_from_points, seasonal_naive_weekly
from app.services.timeseries import (
    get_data_end_date_sku,
    get_daily_units_by_sku,
)

router = APIRouter()

HISTORY_DAYS_FOR_FORECAST = 180


def _validate_marketplace(db: Session, marketplace: str) -> None:
    if marketplace == "ALL":
        return
    exists = db.scalar(select(Marketplace.id).where(Marketplace.code == marketplace))
    if not exists:
        raise HTTPException(
            status_code=400,
            detail=f"Marketplace code not found: {marketplace!r}",
        )


def _get_latest_on_hand(db: Session, sku: str) -> int:
    """Latest on_hand for sku from inventory_snapshots (same as Sprint 4)."""
    latest_subq = (
        select(
            InventorySnapshot.sku,
            func.max(InventorySnapshot.date).label("max_date"),
        )
        .where(InventorySnapshot.sku == sku)
        .group_by(InventorySnapshot.sku)
    ).subquery()
    q = (
        select(func.coalesce(InventorySnapshot.on_hand, 0).label("on_hand"))
        .select_from(InventorySnapshot)
        .join(
            latest_subq,
            (InventorySnapshot.sku == latest_subq.c.sku)
            & (InventorySnapshot.date == latest_subq.c.max_date),
        )
    )
    row = db.execute(q).first()
    return int(row.on_hand) if row else 0


@router.get("/forecast/restock-plan", response_model=ForecastRestockPlanResponse)
def forecast_restock_plan(
    sku: str = Query(..., min_length=1),
    horizon_days: int = Query(default=30, ge=7, le=60),
    lead_time_days: int = Query(default=14, ge=1, le=90),
    service_level: float = Query(default=0.10, ge=0.0, le=1.0),
    marketplace: str = Query(default="ALL"),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ForecastRestockPlanResponse:
    """Return recommended reorder qty from forecast demand during lead time + safety stock."""
    _validate_marketplace(db, marketplace)
    end_date = get_data_end_date_sku(db, sku, marketplace)
    if end_date is None:
        raise HTTPException(status_code=404, detail="SKU not found")

    start_date = end_date - timedelta(days=HISTORY_DAYS_FOR_FORECAST - 1)
    actual_list = get_daily_units_by_sku(db, sku, start_date, end_date, marketplace)
    series = _series_from_points(actual_list)
    if series.empty or len(series) < 8:
        raise HTTPException(
            status_code=400,
            detail="Insufficient order history for this SKU to generate forecast.",
        )

    forecast_series = seasonal_naive_weekly(series, horizon_days)
    avg_daily_forecast_units = float(forecast_series.mean()) if forecast_series.notna().any() else 0.0
    forecast_units_lead_time = avg_daily_forecast_units * lead_time_days
    safety_stock_units = forecast_units_lead_time * service_level
    demand_with_buffer = forecast_units_lead_time + safety_stock_units
    on_hand = _get_latest_on_hand(db, sku)
    recommended_reorder_qty = int(ceil(max(0.0, demand_with_buffer - on_hand)))

    return ForecastRestockPlanResponse(
        sku=sku,
        marketplace=marketplace,
        horizon_days=horizon_days,
        lead_time_days=lead_time_days,
        service_level=service_level,
        avg_daily_forecast_units=round(avg_daily_forecast_units, 4),
        forecast_units_lead_time=round(forecast_units_lead_time, 4),
        safety_stock_units=round(safety_stock_units, 4),
        recommended_reorder_qty=recommended_reorder_qty,
    )
