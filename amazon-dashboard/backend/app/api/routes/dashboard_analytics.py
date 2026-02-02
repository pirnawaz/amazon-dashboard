from __future__ import annotations

from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.routes.me import get_current_user
from app.db.session import get_db
from app.models.ad_spend_daily import AdSpendDaily
from app.models.marketplace import Marketplace
from app.models.order_item import OrderItem
from app.models.product import Product
from app.models.user import User
from app.schemas.dashboard_timeseries import (
    DashboardTimeseriesPoint,
    DashboardTimeseriesResponse,
    TopProductRow,
    TopProductsResponse,
)

router = APIRouter()

VALID_DAYS = (1, 365)
VALID_TOP_LIMIT = (1, 50)


def _validate_marketplace(db: Session, marketplace: str) -> None:
    if marketplace == "ALL":
        return
    exists = db.scalar(select(Marketplace.id).where(Marketplace.code == marketplace))
    if not exists:
        raise HTTPException(
            status_code=400,
            detail=f"Marketplace code not found: {marketplace!r}",
        )


@router.get("/dashboard/timeseries", response_model=DashboardTimeseriesResponse)
def dashboard_timeseries(
    days: int = Query(default=90, ge=1, le=365),
    marketplace: str = Query(default="ALL"),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> DashboardTimeseriesResponse:
    _validate_marketplace(db, marketplace)
    end_date = date.today()
    start_date = end_date - timedelta(days=days - 1)

    # All dates in range (inclusive)
    date_list = [start_date + timedelta(days=i) for i in range(days)]

    # Orders per day: revenue, units, count distinct order_id
    order_q = (
        select(
            OrderItem.order_date,
            func.coalesce(func.sum(OrderItem.revenue), 0).label("revenue"),
            func.coalesce(func.sum(OrderItem.units), 0).label("units"),
            func.count(func.distinct(OrderItem.order_id)).label("orders"),
        )
        .where(OrderItem.order_date >= start_date, OrderItem.order_date <= end_date)
        .group_by(OrderItem.order_date)
    )
    if marketplace != "ALL":
        order_q = order_q.join(Marketplace, OrderItem.marketplace_id == Marketplace.id).where(
            Marketplace.code == marketplace
        )
    order_rows = {row.order_date: row for row in db.execute(order_q).all()}

    # Ad spend per day (sum across marketplaces when ALL)
    ad_q = (
        select(
            AdSpendDaily.date,
            func.coalesce(func.sum(AdSpendDaily.spend), 0).label("spend"),
        )
        .where(AdSpendDaily.date >= start_date, AdSpendDaily.date <= end_date)
        .group_by(AdSpendDaily.date)
    )
    if marketplace != "ALL":
        ad_q = ad_q.join(Marketplace, AdSpendDaily.marketplace_id == Marketplace.id).where(
            Marketplace.code == marketplace
        )
    ad_rows = {row.date: float(row.spend) for row in db.execute(ad_q).all()}

    points: list[DashboardTimeseriesPoint] = []
    for d in date_list:
        order_row = order_rows.get(d)
        revenue = float(order_row.revenue) if order_row else 0.0
        units = int(order_row.units) if order_row else 0
        orders = int(order_row.orders) if order_row else 0
        ad_spend = ad_rows.get(d, 0.0)
        net_profit_placeholder = revenue - ad_spend
        points.append(
            DashboardTimeseriesPoint(
                date=d,
                revenue=revenue,
                units=units,
                orders=orders,
                ad_spend=ad_spend,
                net_profit_placeholder=net_profit_placeholder,
            )
        )

    return DashboardTimeseriesResponse(days=days, marketplace=marketplace, points=points)


@router.get("/dashboard/top-products", response_model=TopProductsResponse)
def dashboard_top_products(
    days: int = Query(default=30, ge=1, le=365),
    marketplace: str = Query(default="ALL"),
    limit: int = Query(default=10, ge=1, le=50),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> TopProductsResponse:
    _validate_marketplace(db, marketplace)
    end_date = date.today()
    start_date = end_date - timedelta(days=days - 1)

    # Top SKUs by revenue: join order_items -> products, aggregate by sku, order by revenue desc
    q = (
        select(
            OrderItem.sku,
            func.max(Product.title).label("title"),
            func.max(Product.asin).label("asin"),
            func.coalesce(func.sum(OrderItem.revenue), 0).label("revenue"),
            func.coalesce(func.sum(OrderItem.units), 0).label("units"),
            func.count(func.distinct(OrderItem.order_id)).label("orders"),
        )
        .select_from(OrderItem)
        .outerjoin(Product, OrderItem.sku == Product.sku)
        .where(OrderItem.order_date >= start_date, OrderItem.order_date <= end_date)
        .group_by(OrderItem.sku)
        .order_by(func.coalesce(func.sum(OrderItem.revenue), 0).desc())
        .limit(limit)
    )
    if marketplace != "ALL":
        q = q.join(Marketplace, OrderItem.marketplace_id == Marketplace.id).where(
            Marketplace.code == marketplace
        )

    rows = db.execute(q).all()
    products = [
        TopProductRow(
            sku=row.sku,
            title=row.title,
            asin=row.asin,
            revenue=float(row.revenue),
            units=int(row.units),
            orders=int(row.orders),
        )
        for row in rows
    ]

    return TopProductsResponse(days=days, marketplace=marketplace, limit=limit, products=products)
