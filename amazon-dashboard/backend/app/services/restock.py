"""Restock plan service: uses Sprint 6 forecasting and deterministic safety stock. Phase 12.3: mapped demand."""
from __future__ import annotations

import math
from datetime import date, timedelta

from sqlalchemy.orm import Session

from app.schemas.data_quality import DataQuality
from app.services.demand_source import get_demand_series_for_restock_sku
from app.services.forecasting import (
    _series_from_points,
    backtest_30d,
    seasonal_naive_weekly,
)
from app.services.timeseries import get_data_end_date_sku

# History window for building the forecast (same as forecast SKU).
HISTORY_DAYS = 180

# Z-scores for common service levels (standard normal quantiles).
# Used for safety stock: safety_stock = z * demand_std_dev.
# 0.95 -> 1.65 is the default (95% service level).
Z_SCORE_TABLE = [
    (0.50, 0.00),
    (0.80, 0.84),
    (0.85, 1.04),
    (0.90, 1.28),
    (0.95, 1.65),
    (0.99, 2.33),
]


def get_z_score(service_level: float) -> float:
    """
    Return z-score for a given service level (0 < service_level < 1).
    Linear interpolation between known table values. Default 0.95 -> 1.65.
    """
    if service_level <= 0.0:
        return 0.0
    if service_level >= 1.0:
        return 2.33
    # Find bracketing points
    low_p, low_z = (0.50, 0.00)
    for p, z in Z_SCORE_TABLE:
        if p >= service_level:
            # Interpolate between (low_p, low_z) and (p, z)
            if p == low_p:
                return float(z)
            t = (service_level - low_p) / (p - low_p)
            return low_z + t * (z - low_z)
        low_p, low_z = p, z
    return float(low_z)


def compute_restock_plan(
    db: Session,
    sku: str,
    marketplace: str,
    lead_time_days: int,
    service_level: float,
    current_inventory: int | None = None,
    *,
    include_unmapped: bool = False,
) -> dict:
    """
    Compute restock plan using Sprint 6 logic and deterministic safety stock.

    Phase 12.3: uses demand_source (mapped_confirmed by default; include_unmapped for
    unmapped/pending demand). Returns dict including data_quality.

    Returns a dict with keys matching RestockPlanResponse.
    Raises ValueError if SKU not found or insufficient order history.
    """
    end_date = get_data_end_date_sku(db, sku, marketplace)
    if end_date is None:
        raise ValueError("SKU not found")

    start_date = end_date - timedelta(days=HISTORY_DAYS - 1)
    actual_list, meta = get_demand_series_for_restock_sku(
        db, sku, marketplace, start_date, end_date, include_unmapped=include_unmapped
    )
    series = _series_from_points(actual_list)

    if series.empty or len(series) < 8:
        raise ValueError("Insufficient order history for this SKU to generate a restock plan")

    # Daily forecast over lead_time_days (same model as forecast/sku)
    forecast_series = seasonal_naive_weekly(series, lead_time_days)
    avg_daily_demand = float(forecast_series.mean()) if forecast_series.notna().any() else 0.0
    avg_daily_demand = max(0.0, avg_daily_demand)

    # Days of cover, expected stockout date, stockout before lead time
    if current_inventory is None or avg_daily_demand <= 0:
        days_of_cover = None
        expected_stockout_date = None
        stockout_before_lead_time = None
    else:
        days_of_cover = current_inventory / avg_daily_demand
        days_int = math.floor(days_of_cover)
        expected_stockout_date = (date.today() + timedelta(days=days_int)).isoformat()
        stockout_before_lead_time = days_int < lead_time_days

    # Backtest for MAPE (Sprint 6)
    _, mape_30d, _ = backtest_30d(actual_list, use_seasonal_naive=True)

    # Lead-time demand (expected demand over lead time)
    lead_time_demand = avg_daily_demand * lead_time_days

    # Demand standard deviation (Poisson-style: variance = mean over lead time)
    # So std_dev = sqrt(avg_daily_demand * lead_time_days)
    demand_std_dev = math.sqrt(avg_daily_demand * lead_time_days)

    # Safety stock: z * demand_std_dev
    z = get_z_score(service_level)
    safety_stock = z * demand_std_dev

    # Reorder quantity = expected demand over lead time + safety stock (always round up)
    reorder_quantity = int(math.ceil(lead_time_demand + safety_stock))
    reorder_quantity = max(0, reorder_quantity)

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
    out: dict = {
        "sku": sku,
        "marketplace": marketplace,
        "lead_time_days": lead_time_days,
        "service_level": service_level,
        "data_end_date": end_date.isoformat(),
        "avg_daily_demand": round(avg_daily_demand, 4),
        "lead_time_demand": round(lead_time_demand, 4),
        "safety_stock": round(safety_stock, 4),
        "reorder_quantity": reorder_quantity,
        "mape_30d": round(mape_30d, 4),
        "days_of_cover": round(days_of_cover, 4) if days_of_cover is not None else None,
        "expected_stockout_date": expected_stockout_date,
        "stockout_before_lead_time": stockout_before_lead_time,
        "data_quality": data_quality,
    }
    return out
