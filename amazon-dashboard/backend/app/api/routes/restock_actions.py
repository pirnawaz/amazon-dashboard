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
from app.schemas.data_quality import DataQuality
from app.services.demand_source import (
    get_demand_series_for_restock_sku,
    get_demand_series_for_restock_total,
)
from app.services.forecast_intelligence import build_intelligence
from app.services.inventory_service import freshness_from_timestamp, get_inventory
from app.services.restock_actions import compute_restock_action
from app.services.timeseries import get_data_end_date_sku, get_data_end_date_total

router = APIRouter()

HISTORY_DAYS = 180


def _forecast_total_for_restock(
    db: Session,
    marketplace: str,
    horizon_days: int,
    *,
    include_unmapped: bool = False,
):
    """Reuse forecast total logic with demand_source (Phase 12.3)."""
    end_date = get_data_end_date_total(db, marketplace)
    if end_date is None:
        end_date = date.today()
    start_date = end_date - timedelta(days=HISTORY_DAYS - 1)
    actual_list, meta = get_demand_series_for_restock_total(
        db, marketplace, start_date, end_date, include_unmapped=include_unmapped
    )
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
        "meta": meta,
    }


def _forecast_sku_for_restock(
    db: Session,
    sku: str,
    marketplace: str,
    horizon_days: int,
    *,
    include_unmapped: bool = False,
):
    """Reuse forecast SKU logic with demand_source (Phase 12.3)."""
    end_date = get_data_end_date_sku(db, sku, marketplace)
    if end_date is None:
        return None
    start_date = end_date - timedelta(days=HISTORY_DAYS - 1)
    actual_list, meta = get_demand_series_for_restock_sku(
        db, sku, marketplace, start_date, end_date, include_unmapped=include_unmapped
    )
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
        "meta": meta,
    }


def _action_item_from_dict(raw: dict) -> RestockActionItem:
    """Build RestockActionItem from compute_restock_action output. Phase 11.4: optional inventory freshness."""
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
        inventory_freshness=raw.get("inventory_freshness"),
        inventory_age_hours=raw.get("inventory_age_hours"),
        inventory_as_of_at=raw.get("inventory_as_of_at"),
        inventory_warning_message=raw.get("inventory_warning_message"),
    )


@router.get("/actions/total", response_model=RestockActionsResponse)
def restock_actions_total(
    marketplace: str = Query(default="ALL"),
    horizon_days: int = Query(default=30, ge=7, le=60),
    lead_time_days: int = Query(default=14, ge=1, le=90),
    service_level: float = Query(default=0.95, ge=0.0, le=1.0),
    current_stock_units: float | None = Query(default=None, ge=0),
    include_unmapped: bool = Query(default=False, description="Include unmapped demand"),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> RestockActionsResponse:
    """
    Return restock actions for total (aggregate) forecast.

    Phase 12.3: mapped demand by default; include_unmapped opt-in; data_quality in response.
    """
    _validate_marketplace(db, marketplace)
    data = _forecast_total_for_restock(
        db, marketplace, horizon_days, include_unmapped=include_unmapped
    )
    end_date = data["end_date"]
    intelligence = data["intelligence"]
    meta = data["meta"]
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
    data_quality = DataQuality(
        mode=meta.mode,
        excluded_units=meta.excluded_units,
        excluded_skus=meta.excluded_skus,
        unmapped_units_30d=meta.unmapped_units_30d,
        unmapped_share_30d=meta.unmapped_share_30d,
        ignored_units_30d=meta.ignored_units_30d,
        discontinued_units_30d=meta.discontinued_units_30d,
        warnings=meta.warnings,
        severity=meta.severity,
    )
    item = _action_item_from_dict(raw)
    return RestockActionsResponse(
        generated_at=datetime.utcnow(),
        items=[item],
        data_quality=data_quality,
    )


@router.get("/actions/sku/{sku}", response_model=RestockActionsResponse)
def restock_actions_sku(
    sku: str,
    marketplace: str = Query(default="ALL"),
    horizon_days: int = Query(default=30, ge=7, le=60),
    lead_time_days: int = Query(default=14, ge=1, le=90),
    service_level: float = Query(default=0.95, ge=0.0, le=1.0),
    current_stock_units: float | None = Query(default=None, ge=0),
    include_unmapped: bool = Query(default=False, description="Include unmapped demand"),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> RestockActionsResponse:
    """
    Return restock actions for a single SKU.

    Phase 12.3: mapped demand by default; include_unmapped opt-in; data_quality in response.
    """
    _validate_marketplace(db, marketplace)
    data = _forecast_sku_for_restock(
        db, sku, marketplace, horizon_days, include_unmapped=include_unmapped
    )
    if data is None:
        raise HTTPException(status_code=404, detail="SKU not found")
    end_date = data["end_date"]
    intelligence = data["intelligence"]
    forecast_expected = data["forecast_expected_total"]
    forecast_low = intelligence.forecast_low
    forecast_high = intelligence.forecast_high

    effective_stock = current_stock_units
    inventory_used: bool = False
    inv_freshness: str | None = None
    inv_age_hours: float | None = None
    inv_as_of_at: datetime | None = None
    inv_warning_message: str | None = None
    if effective_stock is None and marketplace != "ALL":
        inv = get_inventory(db, sku=sku, marketplace=marketplace)
        if inv is not None:
            effective_stock = inv.available_units()
            inventory_used = True
            ts = inv.as_of_at if inv.as_of_at is not None else inv.updated_at
            inv_freshness, inv_age_hours = freshness_from_timestamp(ts)
            inv_as_of_at = inv.as_of_at or inv.updated_at
            if inv_freshness in ("warning", "critical") and inv_age_hours is not None:
                inv_warning_message = (
                    f"Inventory data is {inv_age_hours:.1f} hours old (last updated {inv_as_of_at.isoformat()}). "
                    "Consider syncing FBA inventory for accurate restock recommendations."
                )
        else:
            # Phase 11.5: no row -> treat on_hand = 0 and attach warning (do not crash)
            effective_stock = 0.0
            inv_warning_message = "No inventory data found. Add manual inventory or sync FBA for accurate restock recommendations."

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
    if inventory_used or inv_warning_message:
        if inv_warning_message:
            raw["reasoning"] = list(raw["reasoning"]) + [inv_warning_message]
        raw["inventory_freshness"] = inv_freshness
        raw["inventory_age_hours"] = inv_age_hours
        raw["inventory_as_of_at"] = inv_as_of_at
        raw["inventory_warning_message"] = inv_warning_message
    meta = data["meta"]
    data_quality = DataQuality(
        mode=meta.mode,
        excluded_units=meta.excluded_units,
        excluded_skus=meta.excluded_skus,
        unmapped_units_30d=meta.unmapped_units_30d,
        unmapped_share_30d=meta.unmapped_share_30d,
        ignored_units_30d=meta.ignored_units_30d,
        discontinued_units_30d=meta.discontinued_units_30d,
        warnings=meta.warnings,
        severity=meta.severity,
    )
    item = _action_item_from_dict(raw)
    return RestockActionsResponse(
        generated_at=datetime.utcnow(),
        items=[item],
        data_quality=data_quality,
    )
