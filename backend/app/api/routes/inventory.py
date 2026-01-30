from __future__ import annotations

from datetime import date, timedelta
from math import ceil

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.routes.me import get_current_user
from app.db.session import get_db
from app.models.inventory_snapshot import InventorySnapshot
from app.models.marketplace import Marketplace
from app.models.order_item import OrderItem
from app.models.product import Product
from app.models.user import User
from app.schemas.inventory import RestockResponse, RestockRow

router = APIRouter()

RISK_CRITICAL = "CRITICAL"
RISK_LOW = "LOW"
RISK_OK = "OK"


def _risk_level(days_of_cover: float, avg_daily_units: float) -> str:
    if avg_daily_units == 0:
        return RISK_OK
    if days_of_cover < 7:
        return RISK_CRITICAL
    if days_of_cover < 14:
        return RISK_LOW
    return RISK_OK


@router.get("/inventory/restock", response_model=RestockResponse)
def restock(
    days: int = Query(default=30, ge=1, le=365),
    target_days: int = Query(default=30, ge=1, le=365),
    marketplace: str = Query(default="ALL"),
    limit: int = Query(default=50, ge=1, le=200),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> RestockResponse:
    # A) Validate marketplace
    marketplace_id: int | None = None
    if marketplace != "ALL":
        m = db.scalar(select(Marketplace).where(Marketplace.code == marketplace))
        if not m:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Marketplace '{marketplace}' not found",
            )
        marketplace_id = m.id

    # B) Date range
    end_date = date.today()
    start_date = end_date - timedelta(days=days - 1)

    # C) Sales aggregation per SKU (order_items in range, optional marketplace filter)
    order_q = (
        select(OrderItem.sku, func.coalesce(func.sum(OrderItem.units), 0).label("total_units"))
        .where(OrderItem.order_date >= start_date, OrderItem.order_date <= end_date)
        .group_by(OrderItem.sku)
    )
    if marketplace_id is not None:
        order_q = order_q.where(OrderItem.marketplace_id == marketplace_id)
    sales_rows = db.execute(order_q).all()
    total_units_by_sku = {row.sku: int(row.total_units) for row in sales_rows}

    # D) Latest on_hand per SKU (max date per sku, then join back)
    latest_subq = (
        select(
            InventorySnapshot.sku,
            func.max(InventorySnapshot.date).label("max_date"),
        )
        .group_by(InventorySnapshot.sku)
    ).subquery()
    on_hand_q = (
        select(
            InventorySnapshot.sku,
            func.coalesce(InventorySnapshot.on_hand, 0).label("on_hand"),
        )
        .join(
            latest_subq,
            (InventorySnapshot.sku == latest_subq.c.sku)
            & (InventorySnapshot.date == latest_subq.c.max_date),
        )
    )
    on_hand_rows = db.execute(on_hand_q).all()
    on_hand_by_sku = {row.sku: int(row.on_hand) for row in on_hand_rows}

    # Union of SKUs: those with sales in period or those with inventory
    all_skus = set(total_units_by_sku.keys()) | set(on_hand_by_sku.keys())
    if not all_skus:
        return RestockResponse(
            days=days,
            target_days=target_days,
            marketplace=marketplace,
            limit=limit,
            items=[],
        )

    # Products: title, asin per SKU
    products_q = select(Product.sku, Product.title, Product.asin).where(Product.sku.in_(all_skus))
    products_rows = db.execute(products_q).all()
    product_by_sku = {
        row.sku: {"title": row.title, "asin": row.asin}
        for row in products_rows
    }

    # Build rows: avg_daily_units, on_hand, days_of_cover, reorder_qty, risk_level
    rows: list[RestockRow] = []
    for sku in all_skus:
        total_units = total_units_by_sku.get(sku, 0)
        avg_daily_units = total_units / days if days else 0.0
        on_hand = on_hand_by_sku.get(sku, 0)
        if on_hand is None:
            on_hand = 0

        if avg_daily_units <= 0:
            days_of_cover = 9999.0
            reorder_qty = 0
        else:
            days_of_cover = on_hand / avg_daily_units
            desired = target_days * avg_daily_units
            reorder_qty = int(ceil(max(0.0, desired - on_hand)))

        risk_level = _risk_level(days_of_cover, avg_daily_units)
        info = product_by_sku.get(sku, {})
        title = info.get("title")
        asin = info.get("asin")
        rows.append(
            RestockRow(
                sku=sku,
                title=title,
                asin=asin,
                on_hand=on_hand,
                avg_daily_units=round(avg_daily_units, 4),
                days_of_cover=round(days_of_cover, 2),
                reorder_qty=reorder_qty,
                risk_level=risk_level,
            )
        )

    # H) Sort: CRITICAL first, then LOW, then OK; within each days_of_cover asc, then reorder_qty desc
    risk_order = {RISK_CRITICAL: 0, RISK_LOW: 1, RISK_OK: 2}
    rows.sort(
        key=lambda r: (
            risk_order[r.risk_level],
            r.days_of_cover,
            -r.reorder_qty,
        )
    )

    # I) Limit
    items = rows[:limit]
    return RestockResponse(
        days=days,
        target_days=target_days,
        marketplace=marketplace,
        limit=limit,
        items=items,
    )
