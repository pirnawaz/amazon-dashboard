"""
Restock Actions service: compute restock action from forecast and intelligence.

Uses only stdlib + numpy. Logic is conservative and explainable.
"""
from __future__ import annotations

import math
from datetime import date, datetime, timedelta
from typing import Literal

from app.schemas.restock_actions import DemandRangeDaily, RestockActionItem


def compute_restock_action(
    *,
    sku: str | None,
    marketplace: str | None,
    horizon_days: int,
    lead_time_days: int,
    service_level: float,
    current_stock_units: float | None,
    forecast_expected_total: float,
    forecast_low_total: float,
    forecast_high_total: float,
    daily_demand_estimate: float,
    data_end_date: date | None,
    confidence: str,
    trend: str,
) -> dict:
    """
    Compute a single restock action from forecast totals and intelligence.

    Converts total forecast ranges into daily equivalents, computes days of cover,
    stockout date, order-by date, and suggested reorder quantities. Status and
    recommendation follow simple traffic-light rules; confidence and trend can
    escalate one level.

    Returns a dict suitable for RestockActionItem (with demand_range_daily as dict).
    """
    # Daily equivalents from total forecast
    daily_low = forecast_low_total / horizon_days if horizon_days > 0 else 0.0
    daily_expected = forecast_expected_total / horizon_days if horizon_days > 0 else 0.0
    daily_high = forecast_high_total / horizon_days if horizon_days > 0 else 0.0

    # Use provided daily_demand_estimate if positive; else from forecast
    daily_est = daily_demand_estimate if daily_demand_estimate > 0 else daily_expected
    daily_est = max(0.0, daily_est)

    demand_range_daily = {
        "low": round(daily_low, 4),
        "expected": round(daily_est, 4),
        "high": round(daily_high, 4),
    }

    # Insufficient data path
    if (
        current_stock_units is None
        or daily_est <= 0
        or data_end_date is None
    ):
        return {
            "sku": sku,
            "marketplace": marketplace,
            "horizon_days": horizon_days,
            "lead_time_days": lead_time_days,
            "service_level": service_level,
            "current_stock_units": current_stock_units,
            "daily_demand_estimate": round(daily_est, 4),
            "demand_range_daily": demand_range_daily,
            "days_of_cover_expected": None,
            "days_of_cover_low": None,
            "days_of_cover_high": None,
            "stockout_date_expected": None,
            "order_by_date": None,
            "suggested_reorder_qty_expected": 0.0,
            "suggested_reorder_qty_high": 0.0,
            "status": "insufficient_data",
            "recommendation": "Add inventory/stock data to enable restock actions.",
            "reasoning": [
                "Current stock or data end date is missing, or daily demand is zero.",
                "Provide current_stock_units and ensure forecast data is available.",
                "Once stock and demand are set, we can compute order-by date and reorder quantities.",
            ],
        }

    # Days of cover
    eps = 1e-9
    days_of_cover_expected = current_stock_units / max(daily_est, eps)
    # Worst case: sells faster (high daily demand) -> fewer days of cover
    days_of_cover_low = current_stock_units / max(daily_high, eps)
    # Best case: sells slower (low daily demand) -> more days of cover
    days_of_cover_high = current_stock_units / max(daily_low, eps)

    # Stockout and order-by
    days_until_stockout = math.ceil(days_of_cover_expected)
    stockout_date_expected = data_end_date + timedelta(days=days_until_stockout)
    order_by_date = stockout_date_expected - timedelta(days=lead_time_days)

    # Target: lead_time_days + 14 buffer
    target_days = lead_time_days + 14
    target_units_expected = daily_est * target_days
    suggested_reorder_qty_expected = max(0.0, target_units_expected - current_stock_units)
    target_units_high = daily_high * target_days
    suggested_reorder_qty_high = max(0.0, target_units_high - current_stock_units)

    # Status: urgent if doc <= lead_time + 3; watch if <= lead_time + 10; else healthy
    status: Literal["healthy", "watch", "urgent"] = "healthy"
    if days_of_cover_expected <= lead_time_days + 3:
        status = "urgent"
    elif days_of_cover_expected <= lead_time_days + 10:
        status = "watch"

    # Escalate one level if confidence is low
    if confidence == "low":
        if status == "healthy":
            status = "watch"
        elif status == "watch":
            status = "urgent"
    # Escalate one level if trend is increasing (never above urgent)
    if trend == "increasing":
        if status == "healthy":
            status = "watch"
        elif status == "watch":
            status = "urgent"

    # Recommendation string
    if status == "urgent":
        recommendation = "Reorder now to avoid stockout during lead time."
    elif status == "watch":
        recommendation = "Reorder soon (within 7 days)."
    else:
        recommendation = "Stock level looks OK; keep monitoring."

    # Reasoning bullets (3–6)
    reasoning = [
        f"Daily demand estimate: {daily_est:.2f} units/day (from forecast intelligence).",
        f"Current stock: {current_stock_units:.0f} units.",
        f"Days of cover (expected): {days_of_cover_expected:.1f} days.",
        f"Lead time: {lead_time_days} days; order by {order_by_date.isoformat()} to avoid stockout.",
        f"Confidence '{confidence}' and trend '{trend}' may escalate status (low confidence or increasing demand = act sooner).",
        f"Suggested reorder: {suggested_reorder_qty_expected:.0f} units (expected) or {suggested_reorder_qty_high:.0f} units (buffered); target coverage = lead time + 14 days.",
    ]

    return {
        "sku": sku,
        "marketplace": marketplace,
        "horizon_days": horizon_days,
        "lead_time_days": lead_time_days,
        "service_level": service_level,
        "current_stock_units": current_stock_units,
        "daily_demand_estimate": round(daily_est, 4),
        "demand_range_daily": demand_range_daily,
        "days_of_cover_expected": round(days_of_cover_expected, 2),
        "days_of_cover_low": round(days_of_cover_low, 2),
        "days_of_cover_high": round(days_of_cover_high, 2),
        "stockout_date_expected": stockout_date_expected,
        "order_by_date": order_by_date,
        "suggested_reorder_qty_expected": round(suggested_reorder_qty_expected, 2),
        "suggested_reorder_qty_high": round(suggested_reorder_qty_high, 2),
        "status": status,
        "recommendation": recommendation,
        "reasoning": reasoning,
    }
