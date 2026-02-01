"""Restock Actions API: GET /restock/actions/total and GET /restock/actions/sku/{sku}."""
from __future__ import annotations

from datetime import date, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.routes.forecast import _validate_marketplace
from app.api.routes.me import get_current_user
from app.db.session import get_db
from app.models.marketplace import Marketplace
from app.models.user import User
from app.schemas.restock_actions import (
    DemandRangeDaily,
    RestockActionItem,
    RestockActionsResponse,
)
from app.services.forecasting import (
    _series_from_points,
    backtest_30d,
    seasonal_naive_weekly,
)
from app.services.forecast_intelligence import build_intelligence
from app.services.inventory_service import freshness_days, get_inventory, is_stale
from app.services.restock_actions import compute_restock_action
from app.services.timeseries import (
    get_data_end_date_sku,
    get_data_end_date_total,
    get_daily_units_by_sku,
    get_daily_units_total,
)

router = APIRouter()

HISTORY_DAYS = 180


def _forecast_total_for_restock(
    db: Session,
    marketplace: str,
    horizon_days: int,
):
    """Reuse forecast total logic: same as /forecast/total internals."""
    end_date = get_data_end_date_total(db, marketplace)
    if end_date is None:
        end_date = date.today()
    start_date = end_date - timedelta(days=HISTORY_DAYS - 1)
    actual_list = get_daily_units_total(db, start_date, end_date, marketplace)
    mae_30d, mape_30d, _ = backtest_30d(actual_list, use_seasonal_naive=True)
    series = _series_from_points(actual_list)
    forecast_series = seasonal_naive_weekly(series, horizon_days)
    forecast_expected_total = float(forecast_series.sum())
    history_daily_units = [float(u) for _, u in actual_list]
    intelligence_result = build_intelligence(
        history_daily_units=history_daily_units,
        forecast_expected_total=forecast_expected_total,
        horizon_days=horizon_days,
        mape_30d=mape_30d,
        lead_time_days=None,
        current_stock_units=None,
    )
    return {
        "end_date": end_date,
        "forecast_expected_total": forecast_expected_total,
        "intelligence": intelligence_result,
    }


def _forecast_sku_for_restock(
    db: Session,
    sku: str,
    marketplace: str,
    horizon_days: int,
):
    """Reuse forecast SKU logic: same as /forecast/sku internals."""
    end_date = get_data_end_date_sku(db, sku, marketplace)
    if end_date is None:
        return None
    start_date = end_date - timedelta(days=HISTORY_DAYS - 1)
    actual_list = get_daily_units_by_sku(db, sku, start_date, end_date, marketplace)
    mae_30d, mape_30d, _ = backtest_30d(actual_list, use_seasonal_naive=True)
    series = _series_from_points(actual_list)
    forecast_series = seasonal_naive_weekly(series, horizon_days)
    forecast_expected_total = float(forecast_series.sum())
    history_daily_units = [float(u) for _, u in actual_list]
    intelligence_result = build_intelligence(
        history_daily_units=history_daily_units,
        forecast_expected_total=forecast_expected_total,
        horizon_days=horizon_days,
        mape_30d=mape_30d,
        lead_time_days=None,
        current_stock_units=None,
    )
    return {
        "end_date": end_date,
        "forecast_expected_total": forecast_expected_total,
        "intelligence": intelligence_result,
    }


def _action_item_from_dict(raw: dict) -> RestockActionItem:
    """Build RestockActionItem from compute_restock_action output."""
    dr = raw["demand_range_daily"]
    return RestockActionItem(
        sku=raw.get("sku"),
        marketplace=raw.get("marketplace"),
        horizon_days=raw["horizon_days"],
        lead_time_days=raw["lead_time_days"],
        service_level=raw["service_level"],
        current_stock_units=raw.get("current_stock_units"),
        daily_demand_estimate=raw["daily_demand_estimate"],
        demand_range_daily=DemandRangeDaily(low=dr["low"], expected=dr["expected"], high=dr["high"]),
        days_of_cover_expected=raw.get("days_of_cover_expected"),
        days_of_cover_low=raw.get("days_of_cover_low"),
        days_of_cover_high=raw.get("days_of_cover_high"),
        stockout_date_expected=raw.get("stockout_date_expected"),
        order_by_date=raw.get("order_by_date"),
        suggested_reorder_qty_expected=raw["suggested_reorder_qty_expected"],
        suggested_reorder_qty_high=raw["suggested_reorder_qty_high"],
        status=raw["status"],
        recommendation=raw["recommendation"],
        reasoning=raw["reasoning"],
    )


@router.get("/actions/total", response_model=RestockActionsResponse)
def restock_actions_total(
    marketplace: str = Query(default="ALL"),
    horizon_days: int = Query(default=30, ge=7, le=60),
    lead_time_days: int = Query(default=14, ge=1, le=90),
    service_level: float = Query(default=0.95, ge=0.0, le=1.0),
    current_stock_units: float | None = Query(default=None, ge=0),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> RestockActionsResponse:
    """
    Return restock actions for total (aggregate) forecast.

    Reuses forecast total logic and Phase 5A intelligence; computes order-by date
    and suggested reorder quantities. If current_stock_units is not provided,
    status will be insufficient_data.
    """
    _validate_marketplace(db, marketplace)
    data = _forecast_total_for_restock(db, marketplace, horizon_days)
    end_date = data["end_date"]
    intelligence = data["intelligence"]
    forecast_expected = data["forecast_expected_total"]
    forecast_low = intelligence.forecast_low
    forecast_high = intelligence.forecast_high

    raw = compute_restock_action(
        sku=None,
        marketplace=marketplace,
        horizon_days=horizon_days,
        lead_time_days=lead_time_days,
        service_level=service_level,
        current_stock_units=current_stock_units,
        forecast_expected_total=forecast_expected,
        forecast_low_total=forecast_low,
        forecast_high_total=forecast_high,
        daily_demand_estimate=intelligence.daily_demand_estimate,
        data_end_date=end_date,
        confidence=intelligence.confidence,
        trend=intelligence.trend,
    )
    item = _action_item_from_dict(raw)
    return RestockActionsResponse(
        generated_at=datetime.utcnow(),
        items=[item],
    )


@router.get("/actions/sku/{sku}", response_model=RestockActionsResponse)
def restock_actions_sku(
    sku: str,
    marketplace: str = Query(default="ALL"),
    horizon_days: int = Query(default=30, ge=7, le=60),
    lead_time_days: int = Query(default=14, ge=1, le=90),
    service_level: float = Query(default=0.95, ge=0.0, le=1.0),
    current_stock_units: float | None = Query(default=None, ge=0),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> RestockActionsResponse:
    """
    Return restock actions for a single SKU.

    Reuses forecast SKU logic and Phase 5A intelligence.
    """
    _validate_marketplace(db, marketplace)
    data = _forecast_sku_for_restock(db, sku, marketplace, horizon_days)
    if data is None:
        raise HTTPException(status_code=404, detail="SKU not found")
    end_date = data["end_date"]
    intelligence = data["intelligence"]
    forecast_expected = data["forecast_expected_total"]
    forecast_low = intelligence.forecast_low
    forecast_high = intelligence.forecast_high

    effective_stock = current_stock_units
    inventory_used: bool = False
    inventory_freshness_days: int | None = None
    inventory_stale: bool = False
    if effective_stock is None and marketplace != "ALL":
        inv = get_inventory(db, sku=sku, marketplace=marketplace)
        if inv is not None:
            effective_stock = inv.available_units()
            inventory_used = True
            inventory_freshness_days = freshness_days(inv.updated_at)
            inventory_stale = is_stale(inventory_freshness_days)

    raw = compute_restock_action(
        sku=sku,
        marketplace=marketplace,
        horizon_days=horizon_days,
        lead_time_days=lead_time_days,
        service_level=service_level,
        current_stock_units=effective_stock,
        forecast_expected_total=forecast_expected,
        forecast_low_total=forecast_low,
        forecast_high_total=forecast_high,
        daily_demand_estimate=intelligence.daily_demand_estimate,
        data_end_date=end_date,
        confidence=intelligence.confidence,
        trend=intelligence.trend,
    )
    if inventory_used and inventory_freshness_days is not None:
        if inventory_stale:
            raw["reasoning"] = list(raw["reasoning"]) + [
                f"Inventory last updated {inventory_freshness_days} days ago (stale)."
            ]
        else:
            raw["reasoning"] = list(raw["reasoning"]) + [
                "Inventory last updated today." if inventory_freshness_days == 0
                else f"Inventory last updated {inventory_freshness_days} days ago."
            ]
    item = _action_item_from_dict(raw)
    return RestockActionsResponse(
        generated_at=datetime.utcnow(),
        items=[item],
    )
