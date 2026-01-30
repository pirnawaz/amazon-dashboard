"""Baseline forecasting: seasonal naive weekly and moving average 7."""
from __future__ import annotations

from datetime import date, timedelta

import pandas as pd


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


def backtest_mae_30d(
    points: list[tuple[date, int]],
    use_seasonal_naive: bool = True,
) -> float:
    """
    Evaluate MAE over the last 30 days of the history window.
    For each day t in last 30 days: build forecast for t using data before t only;
    predicted = seasonal naive (value from t-7) if available else moving average;
    MAE = mean(abs(actual - predicted)).
    """
    if len(points) < 8:
        return 0.0

    series = _series_from_points(points)
    series = series.sort_index()
    last_30_start = series.index.max() - timedelta(days=29)
    eval_series = series[series.index >= last_30_start]

    errors = []
    for eval_date in eval_series.index:
        eval_d = eval_date.date() if hasattr(eval_date, "date") else eval_date
        hist = series[series.index < eval_date]
        if hist.empty:
            continue
        actual = float(series.loc[eval_date])
        # Predict: seasonal naive (t-7) if available else moving average
        lookback = eval_d - timedelta(days=7)
        lookback_ts = pd.Timestamp(lookback)
        if use_seasonal_naive and lookback_ts in hist.index and pd.notna(hist.loc[lookback_ts]):
            predicted = float(hist.loc[lookback_ts])
        else:
            last_7 = hist.last("7D")
            predicted = float(last_7.mean()) if len(last_7) > 0 and last_7.notna().any() else float(hist.mean()) if hist.notna().any() else 0.0
        errors.append(abs(actual - predicted))

    return float(pd.Series(errors).mean()) if errors else 0.0
