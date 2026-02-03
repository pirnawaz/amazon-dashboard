from __future__ import annotations

from datetime import date, timedelta
from decimal import Decimal

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.cache import cache_get, cache_set
from app.core.config import settings
from app.api.routes.me import get_current_user
from app.db.session import get_db
from app.models.ad_spend_daily import AdSpendDaily
from app.models.marketplace import Marketplace
from app.models.order_item import OrderItem
from app.models.user import User
from app.schemas.dashboard import DashboardSummary

router = APIRouter()


@router.get("/dashboard/summary", response_model=DashboardSummary)
def dashboard_summary(
    days: int = Query(default=None, ge=1, le=365),
    marketplace: str = Query(default="ALL"),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> DashboardSummary:
    if days is None:
        days = settings.dashboard_default_days
    cache_key = f"dashboard_summary:{marketplace}:{days}"
    hit = cache_get(cache_key)
    if hit is not None:
        return hit  # type: ignore[return-value]

    end_date = date.today()
    start_date = end_date - timedelta(days=days - 1)

    # Order aggregates: revenue, units, distinct order count
    order_q = (
        select(
            func.coalesce(func.sum(OrderItem.revenue), 0).label("revenue"),
            func.coalesce(func.sum(OrderItem.units), 0).label("units"),
            func.count(func.distinct(OrderItem.order_id)).label("orders"),
        )
        .where(OrderItem.order_date >= start_date, OrderItem.order_date <= end_date)
    )
    if marketplace != "ALL":
        order_q = order_q.join(Marketplace, OrderItem.marketplace_id == Marketplace.id).where(
            Marketplace.code == marketplace
        )
    order_row = db.execute(order_q).one()

    # Ad spend aggregate
    ad_q = select(func.coalesce(func.sum(AdSpendDaily.spend), 0).label("spend")).where(
        AdSpendDaily.date >= start_date, AdSpendDaily.date <= end_date
    )
    if marketplace != "ALL":
        ad_q = ad_q.join(Marketplace, AdSpendDaily.marketplace_id == Marketplace.id).where(
            Marketplace.code == marketplace
        )
    ad_row = db.execute(ad_q).one()

    revenue = Decimal(str(order_row.revenue))
    ad_spend = Decimal(str(ad_row.spend))
    net_profit_placeholder = revenue - ad_spend

    result = DashboardSummary(
        revenue=revenue,
        units=int(order_row.units),
        orders=int(order_row.orders),
        ad_spend=ad_spend,
        net_profit_placeholder=net_profit_placeholder,
    )
    cache_set(cache_key, result)
    return result
