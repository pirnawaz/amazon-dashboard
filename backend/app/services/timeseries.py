"""Time series extraction from DB for forecasting."""
from __future__ import annotations

from datetime import date, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.marketplace import Marketplace
from app.models.order_item import OrderItem


def get_daily_units_total(
    db: Session,
    start_date: date,
    end_date: date,
    marketplace: str,
) -> list[tuple[date, int]]:
    """
    Aggregate SUM(order_items.units) per day over history range.
    Filter by marketplace if marketplace != "ALL".
    Return complete daily date range (fill missing days with 0).
    """
    q = (
        select(OrderItem.order_date, func.coalesce(func.sum(OrderItem.units), 0).label("units"))
        .where(OrderItem.order_date >= start_date, OrderItem.order_date <= end_date)
        .group_by(OrderItem.order_date)
    )
    if marketplace != "ALL":
        q = q.join(Marketplace, OrderItem.marketplace_id == Marketplace.id).where(
            Marketplace.code == marketplace
        )
    rows = {row.order_date: int(row.units) for row in db.execute(q).all()}

    out: list[tuple[date, int]] = []
    d = start_date
    while d <= end_date:
        out.append((d, rows.get(d, 0)))
        d += timedelta(days=1)
    return out


def get_daily_units_by_sku(
    db: Session,
    sku: str,
    start_date: date,
    end_date: date,
    marketplace: str,
) -> list[tuple[date, int]]:
    """
    Aggregate SUM(units) per day filtered by sku.
    Filter by marketplace if marketplace != "ALL".
    Return complete daily date range (fill missing days with 0).
    """
    q = (
        select(OrderItem.order_date, func.coalesce(func.sum(OrderItem.units), 0).label("units"))
        .where(
            OrderItem.sku == sku,
            OrderItem.order_date >= start_date,
            OrderItem.order_date <= end_date,
        )
        .group_by(OrderItem.order_date)
    )
    if marketplace != "ALL":
        q = q.join(Marketplace, OrderItem.marketplace_id == Marketplace.id).where(
            Marketplace.code == marketplace
        )
    rows = {row.order_date: int(row.units) for row in db.execute(q).all()}

    out: list[tuple[date, int]] = []
    d = start_date
    while d <= end_date:
        out.append((d, rows.get(d, 0)))
        d += timedelta(days=1)
    return out
