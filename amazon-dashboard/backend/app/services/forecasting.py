"""Baseline forecasting: seasonal naive weekly and moving average 7."""
from __future__ import annotations

from datetime import date, timedelta

import pandas as pd


def safe_mape(actuals: list[float], preds: list[float]) -> float:
    """
    MAPE only over points where actual > 0; skip others.
    If no such points, return 0.0.
    """
    errors = []
    for a, p in zip(actuals, preds):
        if a > 0:
            errors.append(abs(a - p) / a)
    if not errors:
        return 0.0
    return float(sum(errors) / len(errors))


def _series_from_points(points: list[tuple[date, int]]) -> pd.Series:
    """Build a pandas Series indexed by date from (date, units) list. Fills missing days with 0."""
    if not points:
        return pd.Series(dtype=float)
    dates = [p[0] for p in points]
    units = [p[1] for p in points]
    return pd.Series(units, index=pd.DatetimeIndex(dates)).sort_index()


def seasonal_naive_weekly(series: pd.Series, horizon_days: int) -> pd.Series:
    """
    For each future date, forecast = value from 7 days ago (same weekday).
    If insufficient history, fall back to mean of available.
    Returns a Series of forecast values indexed by date (next horizon_days).
    """
    if series.empty or horizon_days <= 0:
        return pd.Series(dtype=float)

    last_date = series.index.max()
    if not isinstance(last_date, date):
        last_date = last_date.date() if hasattr(last_date, "date") else last_date

    mean_val = float(series.mean()) if series.notna().any() else 0.0
    out_dates = [last_date + timedelta(days=i) for i in range(1, horizon_days + 1)]
    forecasts = []

    for d in out_dates:
        lookback = d - timedelta(days=7)
        lookback_ts = pd.Timestamp(lookback)
        if lookback_ts in series.index and pd.notna(series.loc[lookback_ts]):
            forecasts.append(float(series.loc[lookback_ts]))
        else:
            forecasts.append(mean_val)

    return pd.Series(forecasts, index=pd.DatetimeIndex(out_dates))


def moving_average_7(series: pd.Series, horizon_days: int) -> pd.Series:
    """
    Forecast = rolling mean over last 7 days. Constant forecast for entire horizon.
    """
    if series.empty or horizon_days <= 0:
        return pd.Series(dtype=float)

    last = series.last("7D")
    mean_val = float(last.mean()) if len(last) > 0 and last.notna().any() else float(series.mean()) if series.notna().any() else 0.0

    last_date = series.index.max()
    if hasattr(last_date, "date"):
        last_date = last_date.date()
    out_dates = [last_date + timedelta(days=i) for i in range(1, horizon_days + 1)]
    return pd.Series([mean_val] * horizon_days, index=pd.DatetimeIndex(out_dates))


def backtest_30d(
    points: list[tuple[date, int]],
    use_seasonal_naive: bool = True,
) -> tuple[float, float, list[dict]]:
    """
    Evaluate MAE and MAPE over the last 30 days; return backtest points.
    For each day t in last 30 days: predicted = seasonal naive (t-7) if available else moving average.
    Returns (mae_30d, mape_30d, backtest_points) where backtest_points are {date, actual_units, predicted_units}.
    """
    mae_30d = 0.0
    mape_30d = 0.0
    backtest_points: list[dict] = []

    if len(points) < 8:
        return (mae_30d, mape_30d, backtest_points)

    series = _series_from_points(points)
    series = series.sort_index()
    last_30_start = series.index.max() - timedelta(days=29)
    eval_series = series[series.index >= last_30_start]

    actuals: list[float] = []
    preds: list[float] = []

    for eval_date in eval_series.index:
        eval_d = eval_date.date() if hasattr(eval_date, "date") else eval_date
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
        backtest_points.append({
            "date": eval_d.isoformat(),
            "actual_units": int(actual),
            "predicted_units": round(predicted, 4),
        })

    if actuals and preds:
        errors_abs = [abs(a - p) for a, p in zip(actuals, preds)]
        mae_30d = float(sum(errors_abs) / len(errors_abs))
        mape_30d = safe_mape(actuals, preds)

    return (mae_30d, mape_30d, backtest_points)
