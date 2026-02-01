"""Forecast API: total and per-SKU baseline forecasting."""
from __future__ import annotations

from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.routes.me import get_current_user
from app.db.session import get_db
from app.models.marketplace import Marketplace
from app.models.order_item import OrderItem
from app.models.product import Product
from app.models.user import User
from app.schemas.forecast import (
    BacktestPoint,
    ForecastIntelligence,
    ForecastPoint,
    ForecastRange,
    ForecastResponse,
)
from app.services.forecasting import (
    _series_from_points,
    backtest_30d,
    seasonal_naive_weekly,
)
from app.services.forecast_intelligence import build_intelligence
from app.services.timeseries import (
    get_data_end_date_sku,
    get_data_end_date_total,
    get_daily_units_by_sku,
    get_daily_units_total,
)

router = APIRouter()

MODEL_NAME = "seasonal_naive_weekly"


def _validate_marketplace(db: Session, marketplace: str) -> None:
    if marketplace == "ALL":
        return
    exists = db.scalar(select(Marketplace.id).where(Marketplace.code == marketplace))
    if not exists:
        raise HTTPException(
            status_code=400,
            detail=f"Marketplace code not found: {marketplace!r}",
        )


def _to_forecast_points(items: list[tuple[date, int]]) -> list[ForecastPoint]:
    return [ForecastPoint(date=d.isoformat(), units=u) for d, u in items]


def _forecast_series_to_points(series) -> list[ForecastPoint]:
    result = []
    for dt, v in series.items():
        d = dt.date() if hasattr(dt, "date") else dt
        date_str = d.isoformat() if hasattr(d, "isoformat") else str(d)[:10]
        result.append(ForecastPoint(date=date_str, units=int(round(v))))
    return result


@router.get("/forecast/total", response_model=ForecastResponse)
def forecast_total(
    history_days: int = Query(default=180, ge=30, le=365),
    horizon_days: int = Query(default=30, ge=7, le=60),
    marketplace: str = Query(default="ALL"),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ForecastResponse:
    _validate_marketplace(db, marketplace)
    end_date = get_data_end_date_total(db, marketplace)
    if end_date is None:
        end_date = date.today()
    start_date = end_date - timedelta(days=history_days - 1)

    actual_list = get_daily_units_total(db, start_date, end_date, marketplace)
    mae_30d, mape_30d, backtest_raw = backtest_30d(actual_list, use_seasonal_naive=True)
    backtest_points = [BacktestPoint(**p) for p in backtest_raw]

    series = _series_from_points(actual_list)
    forecast_series = seasonal_naive_weekly(series, horizon_days)
    forecast_list = _forecast_series_to_points(forecast_series)
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

    return ForecastResponse(
        kind="total",
        sku=None,
        marketplace=marketplace,
        history_days=history_days,
        horizon_days=horizon_days,
        model_name=MODEL_NAME,
        mae_30d=round(mae_30d, 4),
        data_end_date=end_date.isoformat(),
        mape_30d=round(mape_30d, 4),
        backtest_points=backtest_points,
        actual_points=_to_forecast_points(actual_list),
        forecast_points=forecast_list,
        intelligence=ForecastIntelligence(
            trend=intelligence_result.trend,
            confidence=intelligence_result.confidence,
            daily_demand_estimate=intelligence_result.daily_demand_estimate,
            volatility_cv=intelligence_result.volatility_cv,
            forecast_range=ForecastRange(
                low=intelligence_result.forecast_low,
                expected=intelligence_result.forecast_expected,
                high=intelligence_result.forecast_high,
            ),
        ),
        recommendation=intelligence_result.recommendation,
        reasoning=intelligence_result.reasoning,
    )


@router.get("/forecast/sku", response_model=ForecastResponse)
def forecast_sku(
    sku: str = Query(..., min_length=1),
    history_days: int = Query(default=180, ge=30, le=365),
    horizon_days: int = Query(default=30, ge=7, le=60),
    marketplace: str = Query(default="ALL"),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ForecastResponse:
    _validate_marketplace(db, marketplace)
    # Allow forecast if SKU exists in order_items even if not in products
    end_date = get_data_end_date_sku(db, sku, marketplace)
    if end_date is None:
        raise HTTPException(status_code=404, detail="SKU not found")
    start_date = end_date - timedelta(days=history_days - 1)

    actual_list = get_daily_units_by_sku(db, sku, start_date, end_date, marketplace)
    mae_30d, mape_30d, backtest_raw = backtest_30d(actual_list, use_seasonal_naive=True)
    backtest_points = [BacktestPoint(**p) for p in backtest_raw]

    series = _series_from_points(actual_list)
    forecast_series = seasonal_naive_weekly(series, horizon_days)
    forecast_list = _forecast_series_to_points(forecast_series)
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

    return ForecastResponse(
        kind="sku",
        sku=sku,
        marketplace=marketplace,
        history_days=history_days,
        horizon_days=horizon_days,
        model_name=MODEL_NAME,
        mae_30d=round(mae_30d, 4),
        data_end_date=end_date.isoformat(),
        mape_30d=round(mape_30d, 4),
        backtest_points=backtest_points,
        actual_points=_to_forecast_points(actual_list),
        forecast_points=forecast_list,
        intelligence=ForecastIntelligence(
            trend=intelligence_result.trend,
            confidence=intelligence_result.confidence,
            daily_demand_estimate=intelligence_result.daily_demand_estimate,
            volatility_cv=intelligence_result.volatility_cv,
            forecast_range=ForecastRange(
                low=intelligence_result.forecast_low,
                expected=intelligence_result.forecast_expected,
                high=intelligence_result.forecast_high,
            ),
        ),
        recommendation=intelligence_result.recommendation,
        reasoning=intelligence_result.reasoning,
    )


@router.get("/forecast/top-skus")
def forecast_top_skus(
    days: int = Query(default=30, ge=1, le=365),
    marketplace: str = Query(default="ALL"),
    limit: int = Query(default=20, ge=1, le=50),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return list of {sku, title, revenue} for SKU dropdown. JWT protected."""
    _validate_marketplace(db, marketplace)
    end_date = date.today()
    start_date = end_date - timedelta(days=days - 1)

    q = (
        select(
            OrderItem.sku,
            func.max(Product.title).label("title"),
            func.coalesce(func.sum(OrderItem.revenue), 0).label("revenue"),
        )
        .select_from(OrderItem)
        .outerjoin(Product, OrderItem.sku == Product.sku)
        .where(OrderItem.order_date >= start_date, OrderItem.order_date <= end_date)
        .group_by(OrderItem.sku)
    )
    if marketplace != "ALL":
        q = q.join(Marketplace, OrderItem.marketplace_id == Marketplace.id).where(
            Marketplace.code == marketplace
        )
    subq = q.subquery()
    q_ordered = select(subq).order_by(subq.c.revenue.desc()).limit(limit)
    rows = db.execute(q_ordered).all()

    return [
        {"sku": r.sku, "title": r.title or "", "revenue": float(r.revenue)}
        for r in rows
    ]
