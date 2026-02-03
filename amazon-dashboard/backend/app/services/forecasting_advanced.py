"""Sprint 15: Seasonality-aware forecast, spike handling, confidence bounds, drift, overrides."""
from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import date, timedelta
from typing import Any

import numpy as np
import pandas as pd

from app.services.forecasting import (
    _series_from_points,
    backtest_30d,
    safe_mape,
    seasonal_naive_weekly,
)

logger = logging.getLogger(__name__)

MIN_HISTORY_DAYS_SEASONALITY = 28
BACKTEST_DAYS = 30
DRIFT_WINDOW_DAYS = 14
DRIFT_MAPE_THRESHOLD_MULTIPLIER = 1.5
CONFIDENCE_Z = 1.96
SPIKE_PERCENTILE_CAP = 95
WEEKLY_SEASONALITY_WEEKS = 12


@dataclass
class DriftResult:
    flag: bool
    window_days: int
    mae: float
    mape: float
    threshold_mape: float


@dataclass
class AppliedOverride:
    id: int
    override_type: str
    value: float
    start_date: str
    end_date: str


def _to_date(ts) -> date:
    if isinstance(ts, date) and not hasattr(ts, "date"):
        return ts
    return ts.date() if hasattr(ts, "date") else ts


def _cap_spikes_for_training(series: pd.Series, percentile: float = SPIKE_PERCENTILE_CAP) -> pd.Series:
    """Cap extreme spikes to percentile for training only. Uses IQR for robustness."""
    if series.empty or len(series) < 4:
        return series
    arr = series.values.astype(float)
    q1, q99 = np.nanpercentile(arr, [100 - percentile, percentile])
    if q1 == q99:
        return series
    capped = np.clip(arr, q1, q99)
    return pd.Series(capped, index=series.index)


def _weekly_seasonality_factors(series: pd.Series, weeks: int = WEEKLY_SEASONALITY_WEEKS) -> pd.Series:
    """Day-of-week factors (0=Monday .. 6=Sunday) from last `weeks` weeks. Mean per weekday / overall mean."""
    if series.empty or len(series) < 7:
        return pd.Series(1.0, index=range(7))
    series = series.sort_index()
    tail = series.last(f"{weeks * 7}D") if len(series) >= weeks * 7 else series
    if tail.empty:
        return pd.Series(1.0, index=range(7))
    overall_mean = float(tail.mean())
    if overall_mean <= 0:
        return pd.Series(1.0, index=range(7))
    weekday_means = tail.groupby(tail.index.dayofweek).mean()
    factors = weekday_means / overall_mean
    for d in range(7):
        if d not in factors.index:
            factors[d] = 1.0
    factors = factors.reindex(range(7), fill_value=1.0)
    return factors


def _level_trend_baseline(series: pd.Series) -> float:
    """Simple level: 7-day moving average at end, or mean if too short."""
    if series.empty:
        return 0.0
    last = series.last("7D")
    if len(last) > 0 and last.notna().any():
        return float(last.mean())
    return float(series.mean()) if series.notna().any() else 0.0


def seasonality_forecast(
    series: pd.Series,
    horizon_days: int,
    cap_spikes: bool = True,
) -> pd.Series:
    """
    Forecast = baseline * weekly_seasonality_factor per day.
    If < MIN_HISTORY_DAYS_SEASONALITY, fall back to seasonal_naive_weekly.
    Missing days in series are already 0 (from _series_from_points).
    """
    if series.empty or horizon_days <= 0:
        return pd.Series(dtype=float)

    for_training = _cap_spikes_for_training(series) if cap_spikes else series
    last_date = series.index.max()
    last_date = _to_date(last_date)
    n_days = len(series)

    if n_days < MIN_HISTORY_DAYS_SEASONALITY:
        logger.debug(
            "forecasting_advanced: insufficient history (%s days), using seasonal_naive_weekly",
            n_days,
        )
        return seasonal_naive_weekly(series, horizon_days)

    baseline = _level_trend_baseline(for_training)
    factors = _weekly_seasonality_factors(for_training)
    out_dates = [last_date + timedelta(days=i) for i in range(1, horizon_days + 1)]
    forecasts = []
    for d in out_dates:
        dow = d.weekday()
        fac = float(factors.loc[dow]) if dow in factors.index else 1.0
        forecasts.append(max(0.0, baseline * fac))
    return pd.Series(forecasts, index=pd.DatetimeIndex(out_dates))


def confidence_bounds_from_backtest(
    points: list[tuple[date, int]],
    forecast_series: pd.Series,
    use_seasonal_naive: bool = True,
    z: float = CONFIDENCE_Z,
) -> list[dict[str, Any]]:
    """
    Use residuals from backtest_30d to estimate std; per-day bounds = forecast ± z*std, floor 0.
    Returns list of {date, predicted_units, lower, upper}.
    """
    mae_30d, _, backtest_points = backtest_30d(points, use_seasonal_naive=use_seasonal_naive)
    residuals = [
        abs(p["actual_units"] - p["predicted_units"])
        for p in backtest_points
    ]
    if len(residuals) < 5:
        residual_std = max(mae_30d, 1.0)
        logger.debug("forecasting_advanced: few residuals, using conservative std=%s", residual_std)
    else:
        residual_std = float(np.std(residuals))
        if residual_std <= 0:
            residual_std = max(mae_30d, 1.0)

    half_width = z * residual_std
    result = []
    for dt, pred in forecast_series.items():
        d = _to_date(dt)
        pred_f = float(pred)
        low = max(0.0, pred_f - half_width)
        high = max(0.0, pred_f + half_width)
        result.append({
            "date": d.isoformat(),
            "predicted_units": round(pred_f, 4),
            "lower": round(low, 4),
            "upper": round(high, 4),
        })
    return result


def detect_drift(
    points: list[tuple[date, int]],
    use_seasonal_naive: bool = True,
    window_days: int = DRIFT_WINDOW_DAYS,
    mape_threshold_multiplier: float = DRIFT_MAPE_THRESHOLD_MULTIPLIER,
) -> DriftResult:
    """
    Compare last `window_days` actuals vs predicted (same model as backtest).
    Flag drift if MAPE in window exceeds (historical backtest MAPE * multiplier).
    """
    if len(points) < window_days + 7:
        return DriftResult(
            flag=False,
            window_days=window_days,
            mae=0.0,
            mape=0.0,
            threshold_mape=0.0,
        )
    mae_30d, mape_30d, _ = backtest_30d(points, use_seasonal_naive=use_seasonal_naive)
    series = _series_from_points(points)
    series = series.sort_index()
    last_n_start = series.index.max() - timedelta(days=window_days - 1)
    eval_series = series[series.index >= last_n_start]
    actuals: list[float] = []
    preds: list[float] = []
    for eval_date in eval_series.index:
        eval_d = _to_date(eval_date)
        hist = series[series.index < eval_date]
        if hist.empty:
            continue
        actual = float(series.loc[eval_date])
        lookback = eval_d - timedelta(days=7)
        lookback_ts = pd.Timestamp(lookback)
        if use_seasonal_naive and lookback_ts in hist.index and pd.notna(hist.loc[lookback_ts]):
            predicted = float(hist.loc[lookback_ts])
        else:
            last_7 = hist.last("7D")
            predicted = (
                float(last_7.mean())
                if len(last_7) > 0 and last_7.notna().any()
                else float(hist.mean()) if hist.notna().any() else 0.0
            )
        actuals.append(actual)
        preds.append(predicted)
    if not actuals or not preds:
        return DriftResult(
            flag=False,
            window_days=window_days,
            mae=0.0,
            mape=0.0,
            threshold_mape=mape_30d * mape_threshold_multiplier,
        )
    window_mae = float(sum(abs(a - p) for a, p in zip(actuals, preds)) / len(actuals))
    window_mape = safe_mape(actuals, preds)
    threshold_mape = mape_30d * mape_threshold_multiplier
    flag = window_mape > threshold_mape and threshold_mape > 0
    if flag:
        logger.info(
            "forecasting_advanced: drift detected window_mape=%.4f threshold_mape=%.4f",
            window_mape,
            threshold_mape,
        )
    return DriftResult(
        flag=flag,
        window_days=window_days,
        mae=round(window_mae, 4),
        mape=round(window_mape, 4),
        threshold_mape=round(threshold_mape, 4),
    )


def apply_overrides(
    forecast_series: pd.Series,
    bounds: list[dict[str, Any]],
    overrides: list[dict[str, Any]],
) -> tuple[pd.Series, list[dict[str, Any]], list[AppliedOverride]]:
    """
    Apply overrides to forecast and bounds. Overrides are for (start_date, end_date), type absolute or multiplier.
    Returns (adjusted_forecast_series, adjusted_bounds, applied_overrides).
    """
    applied: list[AppliedOverride] = []
    if not overrides:
        return forecast_series, bounds, applied

    out_series = forecast_series.copy()
    bounds_by_date = {b["date"]: dict(b) for b in bounds}

    for ov in overrides:
        start_s = ov.get("start_date")
        end_s = ov.get("end_date")
        if not start_s or not end_s:
            continue
        start_d = date.fromisoformat(start_s) if isinstance(start_s, str) else start_s
        end_d = date.fromisoformat(end_s) if isinstance(end_s, str) else end_s
        ov_type = ov.get("override_type") or "multiplier"
        try:
            val = float(ov.get("value", 0))
        except (TypeError, ValueError):
            continue
        ov_id = ov.get("id") or 0
        applied.append(
            AppliedOverride(
                id=ov_id,
                override_type=ov_type,
                value=val,
                start_date=start_s,
                end_date=end_s,
            )
        )
        for dt in list(out_series.index):
            d = _to_date(dt)
            if start_d <= d <= end_d:
                orig_pred = float(out_series.loc[dt])
                if ov_type == "absolute":
                    out_series.loc[dt] = max(0.0, val)
                else:
                    out_series.loc[dt] = max(0.0, orig_pred * val)
                pred = float(out_series.loc[dt])
                d_str = d.isoformat()
                if d_str in bounds_by_date:
                    b = bounds_by_date[d_str]
                    orig_low = b.get("lower", 0)
                    orig_high = b.get("upper", pred)
                    orig_p = b.get("predicted_units", orig_pred)
                    if ov_type == "absolute":
                        half = (orig_high - orig_p) if orig_p else 0
                        b["lower"] = round(max(0.0, val - half), 4)
                        b["upper"] = round(max(0.0, val + half), 4)
                    else:
                        scale = val
                        b["lower"] = round(max(0.0, orig_low * scale), 4)
                        b["upper"] = round(max(0.0, orig_high * scale), 4)
                    b["predicted_units"] = round(pred, 4)

    dates_order = [b["date"] for b in bounds]
    new_bounds = [bounds_by_date[d] for d in dates_order if d in bounds_by_date]
    return out_series, new_bounds, applied


def run_advanced_forecast(
    points: list[tuple[date, int]],
    horizon_days: int,
    overrides: list[dict[str, Any]] | None = None,
    cap_spikes: bool = True,
) -> tuple[
    pd.Series,
    list[dict[str, Any]],
    DriftResult,
    list[AppliedOverride],
    float,
    float,
    list[dict],
]:
    """
    Full pipeline: seasonality forecast, confidence bounds, drift, apply overrides.
    Returns (forecast_series, confidence_bounds, drift_result, applied_overrides, mae_30d, mape_30d, backtest_points).
    """
    overrides = overrides or []
    series = _series_from_points(points)
    mae_30d, mape_30d, backtest_points = backtest_30d(points, use_seasonal_naive=True)
    forecast_series = seasonality_forecast(series, horizon_days, cap_spikes=cap_spikes)
    bounds = confidence_bounds_from_backtest(points, forecast_series, use_seasonal_naive=True)
    drift_result = detect_drift(points, use_seasonal_naive=True, window_days=DRIFT_WINDOW_DAYS)
    forecast_series, bounds, applied = apply_overrides(forecast_series, bounds, overrides)
    return (
        forecast_series,
        bounds,
        drift_result,
        applied,
        mae_30d,
        mape_30d,
        backtest_points,
    )
