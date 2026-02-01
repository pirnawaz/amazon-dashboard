"""
Forecast Intelligence: trend detection, confidence, and recommendations.

Uses only Python stdlib and numpy. No new ML models.
Logic is conservative and explainable.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

import numpy as np


# Type aliases for clarity
TrendType = Literal["increasing", "stable", "decreasing", "insufficient_data"]
ConfidenceType = Literal["high", "medium", "low"]


@dataclass
class IntelligenceResult:
    """Result of build_intelligence for forecast responses."""

    trend: TrendType
    confidence: ConfidenceType
    daily_demand_estimate: float
    volatility_cv: float
    forecast_low: float
    forecast_expected: float
    forecast_high: float
    recommendation: str
    reasoning: list[str]


# Minimum history days needed for trend detection (two windows of 14 days)
_TREND_MIN_DAYS = 28

# MAPE thresholds for confidence (conservative)
_MAPE_HIGH_CONFIDENCE = 0.20
_MAPE_MEDIUM_CONFIDENCE = 0.40

# CV thresholds for uncertainty band width
_CV_LOW = 0.5
_CV_HIGH = 1.0

# Trend threshold: recent vs older mean ratio
_TREND_INCREASING_RATIO = 1.10
_TREND_DECREASING_RATIO = 0.90


def _detect_trend(history_daily_units: list[float]) -> TrendType:
    """
    Compare recent 14-day mean vs preceding 14-day mean.
    Requires at least 28 days of history.
    """
    arr = np.array(history_daily_units, dtype=float)
    if len(arr) < _TREND_MIN_DAYS:
        return "insufficient_data"

    recent = arr[-14:]
    older = arr[-28:-14]
    recent_mean = float(np.mean(recent))
    older_mean = float(np.mean(older))

    # Avoid division by zero; treat near-zero older as stable
    if older_mean < 1e-6:
        return "stable" if recent_mean < 1e-6 else "increasing"

    ratio = recent_mean / older_mean
    if ratio >= _TREND_INCREASING_RATIO:
        return "increasing"
    if ratio <= _TREND_DECREASING_RATIO:
        return "decreasing"
    return "stable"


def _classify_confidence(mape_30d: float | None) -> ConfidenceType:
    """
    Classify confidence from 30-day MAPE.
    Conservative: treat None as low confidence.
    """
    if mape_30d is None:
        return "low"
    if mape_30d < _MAPE_HIGH_CONFIDENCE:
        return "high"
    if mape_30d < _MAPE_MEDIUM_CONFIDENCE:
        return "medium"
    return "low"


def _compute_volatility_cv(history_daily_units: list[float]) -> float:
    """Coefficient of variation: std / mean. Returns 0 if mean is near zero."""
    arr = np.array(history_daily_units, dtype=float)
    if len(arr) < 2:
        return 0.0
    mean_val = float(np.mean(arr))
    if mean_val < 1e-6:
        return 0.0
    std_val = float(np.std(arr))
    return std_val / mean_val


def _compute_forecast_bounds(
    forecast_expected_total: float,
    horizon_days: int,
    mape_30d: float | None,
    volatility_cv: float,
) -> tuple[float, float]:
    """
    Compute low/high bounds for forecast total.
    Uses MAPE and CV; conservative margins.
    """
    mape = mape_30d if mape_30d is not None else 0.35
    # Combine MAPE-based and volatility-based margin
    margin_factor = max(mape * 1.5, volatility_cv * 0.5, 0.15)
    margin_factor = min(margin_factor, 0.8)  # Cap at 80%

    low = forecast_expected_total * (1 - margin_factor)
    high = forecast_expected_total * (1 + margin_factor)
    return (max(0.0, low), max(0.0, high))


def _build_recommendation_and_reasoning(
    trend: TrendType,
    confidence: ConfidenceType,
    forecast_expected_total: float,
    horizon_days: int,
    lead_time_days: int | None,
    current_stock_units: float | None,
) -> tuple[str, list[str]]:
    """
    Generate plain-English recommendation and reasoning bullets.
    Conservative and actionable.
    """
    reasoning: list[str] = []
    daily_est = forecast_expected_total / horizon_days if horizon_days > 0 else 0.0

    # Trend reasoning
    if trend == "increasing":
        reasoning.append("Recent demand is trending upward compared to prior period.")
    elif trend == "decreasing":
        reasoning.append("Recent demand is trending downward compared to prior period.")
    elif trend == "stable":
        reasoning.append("Demand is stable with no significant trend change.")
    else:
        reasoning.append("Insufficient history to assess demand trend.")

    # Confidence reasoning
    if confidence == "high":
        reasoning.append("Forecast accuracy (MAPE) is good; plan with moderate buffer.")
    elif confidence == "medium":
        reasoning.append("Forecast accuracy is moderate; consider adding safety stock.")
    else:
        reasoning.append("Forecast accuracy is uncertain; use conservative replenishment.")

    # Recommendation
    if daily_est <= 0:
        recommendation = "No significant demand forecast. Monitor orders before restocking."
        reasoning.append("Forecasted daily demand is near zero.")
        return recommendation, reasoning

    if lead_time_days is not None and current_stock_units is not None:
        lead_time_demand = daily_est * lead_time_days
        days_of_stock = current_stock_units / daily_est if daily_est > 0 else 999
        if days_of_stock < lead_time_days * 0.5:
            recommendation = (
                f"Consider restocking soon. Stock covers ~{int(days_of_stock)} days; "
                f"lead time is {lead_time_days} days."
            )
            reasoning.append(
                f"Current stock ({int(current_stock_units)} units) may not cover lead-time demand."
            )
        elif days_of_stock < lead_time_days * 1.2:
            recommendation = (
                "Monitor inventory. Stock is adequate for now but plan for next order."
            )
        else:
            recommendation = "Stock levels appear sufficient. Revisit when inventory drops."
    else:
        if trend == "increasing" and confidence in ("high", "medium"):
            recommendation = (
                f"Plan for higher demand. Expect ~{daily_est:.1f} units/day over the horizon."
            )
        elif trend == "decreasing":
            recommendation = (
                "Demand is declining. Avoid over-ordering; align restock with actual sell-through."
            )
        elif confidence == "low":
            recommendation = (
                "Use forecast as a rough guide. Gather more data before large orders."
            )
        else:
            recommendation = (
                f"Forecast suggests ~{daily_est:.1f} units/day. Plan replenishment accordingly."
            )

    return recommendation, reasoning


def build_intelligence(
    history_daily_units: list[float],
    forecast_expected_total: float,
    horizon_days: int,
    mape_30d: float | None,
    lead_time_days: int | None = None,
    current_stock_units: float | None = None,
) -> IntelligenceResult:
    """
    Build forecast intelligence from history and forecast outputs.

    Args:
        history_daily_units: Daily units in chronological order.
        forecast_expected_total: Sum of predicted units over horizon.
        horizon_days: Forecast horizon in days.
        mape_30d: 30-day backtest MAPE, or None.
        lead_time_days: Optional lead time for restock context.
        current_stock_units: Optional current on-hand for restock context.

    Returns:
        IntelligenceResult with trend, confidence, estimates, and recommendation.
    """
    trend = _detect_trend(history_daily_units)
    confidence = _classify_confidence(mape_30d)
    volatility_cv = _compute_volatility_cv(history_daily_units)

    daily_demand_estimate = (
        forecast_expected_total / horizon_days if horizon_days > 0 else 0.0
    )

    forecast_low, forecast_high = _compute_forecast_bounds(
        forecast_expected_total, horizon_days, mape_30d, volatility_cv
    )

    recommendation, reasoning = _build_recommendation_and_reasoning(
        trend, confidence, forecast_expected_total, horizon_days,
        lead_time_days, current_stock_units,
    )

    return IntelligenceResult(
        trend=trend,
        confidence=confidence,
        daily_demand_estimate=round(daily_demand_estimate, 4),
        volatility_cv=round(volatility_cv, 4),
        forecast_low=round(forecast_low, 2),
        forecast_expected=round(forecast_expected_total, 2),
        forecast_high=round(forecast_high, 2),
        recommendation=recommendation,
        reasoning=reasoning,
    )
