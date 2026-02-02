"""Forecast-based restock plan API. Phase 11.5: on-hand from inventory_levels. Phase 12.3: mapped demand + data_quality."""
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
from app.schemas.data_quality import DataQuality
from app.schemas.forecast_restock import ForecastRestockPlanResponse
from app.services.demand_source import get_demand_series_for_restock_sku
from app.services.forecasting import _series_from_points, seasonal_naive_weekly
from app.services.inventory_service import (
    freshness_from_timestamp,
    get_inventory,
    get_on_hand_for_restock,
)
from app.services.timeseries import get_data_end_date_sku

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


def _get_latest_on_hand_snapshots(db: Session, sku: str) -> int:
    """Latest on_hand for sku from inventory_snapshots (legacy fallback). Phase 11.5: prefer inventory_levels when marketplace is set."""
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
    include_unmapped: bool = Query(default=False, description="Include unmapped/pending demand in restock plan"),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ForecastRestockPlanResponse:
    """Return recommended reorder qty from forecast demand during lead time + safety stock. Phase 12.3: mapped demand by default; include_unmapped opt-in; data_quality in response."""
    _validate_marketplace(db, marketplace)
    end_date = get_data_end_date_sku(db, sku, marketplace)
    if end_date is None:
        raise HTTPException(status_code=404, detail="SKU not found")

    start_date = end_date - timedelta(days=HISTORY_DAYS_FOR_FORECAST - 1)
    actual_list, meta = get_demand_series_for_restock_sku(
        db, sku, marketplace, start_date, end_date, include_unmapped=include_unmapped
    )
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

    # Phase 11.5: prefer inventory_levels when marketplace != "ALL"; fallback to inventory_snapshots (legacy)
    inventory_source: str | None = None
    no_inventory_data = False
    inventory_freshness: str | None = None
    inventory_age_hours: float | None = None
    inventory_as_of_at: str | None = None
    inventory_warning_message: str | None = None

    if marketplace != "ALL":
        on_hand, inv_source, warning = get_on_hand_for_restock(db, sku, marketplace)
        if inv_source is not None:
            inventory_source = inv_source
            inv_row = get_inventory(db, sku, marketplace)
            if inv_row is not None:
                ts = inv_row.as_of_at if inv_row.as_of_at is not None else inv_row.updated_at
                inventory_freshness, inventory_age_hours = freshness_from_timestamp(ts)
                inventory_as_of_at = (inv_row.as_of_at or inv_row.updated_at).isoformat()
                if inventory_freshness in ("warning", "critical") and inventory_age_hours is not None:
                    inventory_warning_message = (
                        f"Inventory data is {inventory_age_hours:.1f} hours old. "
                        "Consider syncing FBA inventory for accurate recommendations."
                    )
        else:
            # No inventory_levels row: fallback to legacy snapshots
            on_hand_legacy = _get_latest_on_hand_snapshots(db, sku)
            on_hand = float(on_hand_legacy)
            inventory_source = "legacy"
            if on_hand_legacy == 0:
                no_inventory_data = True
                inventory_warning_message = "No inventory data found (inventory_levels or snapshots)."
    else:
        # marketplace == "ALL": use legacy inventory_snapshots (no single marketplace in inventory_levels)
        on_hand = float(_get_latest_on_hand_snapshots(db, sku))
        inventory_source = "legacy"
        if on_hand == 0:
            no_inventory_data = True

    recommended_reorder_qty = int(ceil(max(0.0, demand_with_buffer - on_hand)))

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
        inventory_freshness=inventory_freshness,
        inventory_age_hours=inventory_age_hours,
        inventory_as_of_at=inventory_as_of_at,
        inventory_warning_message=inventory_warning_message,
        inventory_source=inventory_source,
        no_inventory_data=no_inventory_data,
        data_quality=data_quality,
    )
