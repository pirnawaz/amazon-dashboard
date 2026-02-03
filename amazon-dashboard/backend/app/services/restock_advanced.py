"""Sprint 16: Advanced restock planning with suppliers, lead time variability, safety stock, what-if."""
from __future__ import annotations

import json
import logging
import math
from dataclasses import dataclass, field
from datetime import date, timedelta
from decimal import Decimal
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.inventory import InventoryLevel
from app.models.marketplace import Marketplace
from app.models.supplier import SkuSupplierSetting, Supplier
from app.services.demand_source import get_demand_series_for_restock_sku
from app.services.forecasting import _series_from_points, seasonal_naive_weekly
from app.services.forecasting_advanced import run_advanced_forecast
from app.services.inventory_service import get_inventory, get_on_hand_for_restock, list_inventory
from app.services.restock import get_z_score
from app.services.timeseries import get_data_end_date_sku

logger = logging.getLogger(__name__)

HISTORY_DAYS = 180
REVIEW_PERIOD_DAYS = 7
DEFAULT_LEAD_TIME_MEAN = 14
DEFAULT_LEAD_TIME_STD = 0
DEFAULT_SERVICE_LEVEL = Decimal("0.95")
EPS = 1e-9


@dataclass
class RestockRecommendationRow:
    """Single SKU restock recommendation for list/detail."""

    sku: str
    marketplace_code: str
    supplier_id: int | None
    supplier_name: str | None
    on_hand_units: float
    inbound_units: float
    reserved_units: float
    available_units: float
    daily_demand_forecast: float
    days_of_cover: float | None
    lead_time_days_mean: int
    lead_time_days_std: int
    safety_stock_units: float
    reorder_point_units: float
    target_stock_units: float
    recommended_order_units: float
    recommended_order_units_rounded: float
    priority_score: float
    reason_flags: list[str] = field(default_factory=list)
    pack_size_units: int = 1
    moq_units: int = 0


def _get_setting(
    db: Session, sku: str, marketplace_code: str
) -> tuple[SkuSupplierSetting | None, Supplier | None]:
    """Return (SkuSupplierSetting, Supplier) for sku+marketplace; try marketplace then global (marketplace_code NULL)."""
    stmt = (
        select(SkuSupplierSetting, Supplier)
        .join(Supplier, SkuSupplierSetting.supplier_id == Supplier.id)
        .where(
            SkuSupplierSetting.sku == sku,
            SkuSupplierSetting.is_active.is_(True),
        )
    )
    rows = list(db.execute(stmt).all())
    # Prefer exact marketplace then global
    for row in rows:
        setting, supplier = row
        if setting.marketplace_code == marketplace_code:
            return (setting, supplier)
    for row in rows:
        setting, supplier = row
        if setting.marketplace_code is None:
            return (setting, supplier)
    return (None, None)


def _daily_forecast_from_advanced(
    db: Session,
    sku: str,
    marketplace_code: str,
    horizon_days: int = 30,
    include_unmapped: bool = False,
) -> tuple[float, bool]:
    """
    Return (avg_daily_forecast, used_fallback).
    Uses Sprint 15 advanced forecast; if insufficient history, fallback to historical average.
    """
    mp_code = None if marketplace_code == "ALL" else marketplace_code
    end_date = get_data_end_date_sku(db, sku, marketplace_code)
    if end_date is None:
        return (0.0, True)
    start_date = end_date - timedelta(days=HISTORY_DAYS - 1)
    actual_list, _ = get_demand_series_for_restock_sku(
        db, sku, marketplace_code, start_date, end_date, include_unmapped=include_unmapped
    )
    series = _series_from_points(actual_list)
    if series.empty or len(series) < 8:
        # Fallback: historical average
        if actual_list:
            avg = sum(u for _, u in actual_list) / len(actual_list)
            return (float(avg), True)
        return (0.0, True)
    try:
        from app.services.forecast_overrides_service import get_overrides_overlapping

        horizon_start = end_date + timedelta(days=1)
        horizon_end = end_date + timedelta(days=horizon_days)
        overrides_raw = get_overrides_overlapping(
            db, horizon_start, horizon_end, sku=sku, marketplace_code=mp_code
        )
    except Exception:
        overrides_raw = []
    (
        forecast_series,
        _,
        _,
        _,
        _,
        _,
        _,
    ) = run_advanced_forecast(actual_list, horizon_days, overrides=overrides_raw, cap_spikes=True)
    if forecast_series.empty or not forecast_series.notna().any():
        if actual_list:
            avg = sum(u for _, u in actual_list) / len(actual_list)
            return (float(avg), True)
        return (0.0, True)
    daily_avg = float(forecast_series.mean())
    return (max(0.0, daily_avg), False)


def _demand_std_daily(db: Session, sku: str, marketplace_code: str) -> float | None:
    """Standard deviation of daily demand from history; None if insufficient data."""
    end_date = get_data_end_date_sku(db, sku, marketplace_code)
    if end_date is None:
        return None
    start_date = end_date - timedelta(days=min(90, HISTORY_DAYS))
    actual_list, _ = get_demand_series_for_restock_sku(
        db, sku, marketplace_code, start_date, end_date, include_unmapped=False
    )
    if len(actual_list) < 7:
        return None
    values = [u for _, u in actual_list]
    mean_v = sum(values) / len(values)
    var = sum((x - mean_v) ** 2 for x in values) / len(values)
    return math.sqrt(var) if var > 0 else None


def compute_single_recommendation(
    db: Session,
    sku: str,
    marketplace_code: str,
    *,
    daily_demand_override: float | None = None,
    on_hand_override: float | None = None,
    inbound_override: float | None = None,
    reserved_override: float | None = None,
    lead_time_mean_override: int | None = None,
    lead_time_std_override: int | None = None,
    service_level_override: float | Decimal | None = None,
    review_period_days: int = REVIEW_PERIOD_DAYS,
    include_unmapped: bool = False,
) -> RestockRecommendationRow:
    """
    Compute restock recommendation for one SKU.
    Uses inventory as single source of truth (on_hand, reserved; inbound=0 if not stored).
    Overrides are for what-if; when None, use DB (inventory_levels, sku_supplier_setting, forecast).
    """
    reason_flags: list[str] = []

    # Inventory
    if on_hand_override is not None and reserved_override is not None:
        on_hand = float(on_hand_override)
        reserved = float(reserved_override)
        inbound = float(inbound_override) if inbound_override is not None else 0.0
    else:
        inv_row = get_inventory(db, sku, marketplace_code)
        if inv_row is not None:
            on_hand = float(inv_row.on_hand_units)
            reserved = float(inv_row.reserved_units or 0)
            inbound = 0.0
        else:
            on_hand, _, _ = get_on_hand_for_restock(db, sku, marketplace_code)
            on_hand = float(on_hand)
            reserved = 0.0
            inbound = 0.0
            if on_hand == 0:
                reason_flags.append("no_inventory_data")
    available_units = max(0.0, on_hand + inbound - reserved)

    # Supplier settings
    setting, supplier = _get_setting(db, sku, marketplace_code)
    if setting is None:
        reason_flags.append("missing_supplier_settings")
    lead_time_mean = (
        int(lead_time_mean_override)
        if lead_time_mean_override is not None
        else (int(setting.lead_time_days_mean) if setting else DEFAULT_LEAD_TIME_MEAN)
    )
    lead_time_std = (
        int(lead_time_std_override)
        if lead_time_std_override is not None
        else (int(setting.lead_time_days_std) if setting else DEFAULT_LEAD_TIME_STD)
    )
    service_level = (
        float(service_level_override)
        if service_level_override is not None
        else (float(setting.service_level) if setting else float(DEFAULT_SERVICE_LEVEL))
    )
    service_level = max(0.5, min(0.99, service_level))
    moq = int(setting.moq_units) if setting else 0
    pack_size = max(1, int(setting.pack_size_units) if setting else 1)

    # Daily forecast
    if daily_demand_override is not None:
        daily_forecast = max(0.0, float(daily_demand_override))
        reason_flags.append("daily_demand_override_used")
    else:
        daily_forecast, used_fallback = _daily_forecast_from_advanced(
            db, sku, marketplace_code, horizon_days=30, include_unmapped=include_unmapped
        )
        if used_fallback and daily_forecast > 0:
            reason_flags.append("missing_forecast_fallback_used")

    # Demand during lead time
    expected_lead_time_demand = daily_forecast * lead_time_mean

    # Safety stock: z * sqrt(lead_time_mean) * demand_std_daily, or conservative (daily_forecast * lead_time_std)
    z = get_z_score(service_level)
    demand_std = _demand_std_daily(db, sku, marketplace_code)
    if demand_std is not None and demand_std > 0:
        safety_stock = z * math.sqrt(lead_time_mean) * demand_std
    else:
        safety_stock = z * (daily_forecast * lead_time_std) if lead_time_std > 0 else 0.0
        if safety_stock == 0 and daily_forecast > 0:
            safety_stock = z * math.sqrt(daily_forecast * lead_time_mean)
    safety_stock = max(0.0, safety_stock)

    reorder_point = expected_lead_time_demand + safety_stock
    target_stock = reorder_point + (daily_forecast * review_period_days)
    recommended = max(0.0, target_stock - available_units)

    # Rounding: MOQ then pack_size
    recommended_rounded = recommended
    if recommended > 0 and moq > 0 and recommended < moq:
        recommended_rounded = float(moq)
        reason_flags.append("moq_applied")
    if pack_size > 1:
        recommended_rounded = math.ceil(recommended_rounded / pack_size) * pack_size
        if recommended_rounded != recommended and "moq_applied" not in reason_flags:
            reason_flags.append("pack_rounding_applied")

    # Days of cover
    days_of_cover = (available_units / (daily_forecast + EPS)) if daily_forecast > 0 else None

    # Priority: urgency when days_until_stockout < lead_time_mean
    days_until_stockout = (available_units / (daily_forecast + EPS)) if daily_forecast > 0 else 9999.0
    if days_until_stockout < lead_time_mean and daily_forecast > 0:
        reason_flags.append("urgent_stockout_risk")
    elif days_until_stockout < lead_time_mean + review_period_days and daily_forecast > 0:
        reason_flags.append("reorder_soon")
    priority_score = 1.0 / (days_until_stockout + 0.1) if days_until_stockout < 9998 else 0.0

    supplier_id = supplier.id if supplier else None
    supplier_name = supplier.name if supplier else None
    pack_size_units = int(setting.pack_size_units) if setting else 1
    moq_units = int(setting.moq_units) if setting else 0

    return RestockRecommendationRow(
        sku=sku,
        marketplace_code=marketplace_code,
        supplier_id=supplier_id,
        supplier_name=supplier_name,
        on_hand_units=round(on_hand, 4),
        inbound_units=round(inbound, 4),
        reserved_units=round(reserved, 4),
        available_units=round(available_units, 4),
        daily_demand_forecast=round(daily_forecast, 4),
        days_of_cover=round(days_of_cover, 4) if days_of_cover is not None else None,
        lead_time_days_mean=lead_time_mean,
        lead_time_days_std=lead_time_std,
        safety_stock_units=round(safety_stock, 4),
        reorder_point_units=round(reorder_point, 4),
        target_stock_units=round(target_stock, 4),
        recommended_order_units=round(recommended, 4),
        recommended_order_units_rounded=round(recommended_rounded, 4),
        priority_score=round(priority_score, 4),
        reason_flags=reason_flags,
        pack_size_units=pack_size_units,
        moq_units=moq_units,
    )


def list_recommendations(
    db: Session,
    marketplace_code: str,
    days: int = 30,
    *,
    supplier_id: int | None = None,
    urgent_only: bool = False,
    missing_settings_only: bool = False,
    include_unmapped: bool = False,
) -> list[RestockRecommendationRow]:
    """
    List restock recommendations for all SKUs with inventory in the marketplace.
    Filters: supplier_id, urgent_only (reason_flags contains urgent_stockout_risk), missing_settings_only.
    """
    _validate_marketplace(db, marketplace_code)
    mp_filter = None if marketplace_code == "ALL" else marketplace_code
    inv_list = list_inventory(db, marketplace=mp_filter, limit=500)
    seen_sku: set[tuple[str, str]] = set()
    rows: list[RestockRecommendationRow] = []
    for inv in inv_list:
        key = (inv.sku, inv.marketplace)
        if key in seen_sku:
            continue
        seen_sku.add(key)
        try:
            rec = compute_single_recommendation(
                db, inv.sku, inv.marketplace, include_unmapped=include_unmapped
            )
        except Exception as e:
            logger.warning(
                "restock_advanced: skip sku=%s marketplace=%s error=%s",
                inv.sku,
                inv.marketplace,
                e,
                extra={"sku": inv.sku, "marketplace": inv.marketplace},
            )
            continue
        if supplier_id is not None and rec.supplier_id != supplier_id:
            continue
        if urgent_only and "urgent_stockout_risk" not in rec.reason_flags:
            continue
        if missing_settings_only and "missing_supplier_settings" not in rec.reason_flags:
            continue
        rows.append(rec)
    rows.sort(key=lambda r: (-r.priority_score, r.sku))
    return rows


def _validate_marketplace(db: Session, marketplace_code: str) -> None:
    if marketplace_code == "ALL":
        return
    exists = db.scalar(select(Marketplace.id).where(Marketplace.code == marketplace_code))
    if not exists:
        raise ValueError(f"Marketplace code not found: {marketplace_code!r}")
