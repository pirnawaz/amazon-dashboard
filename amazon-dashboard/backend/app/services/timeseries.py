"""Time series extraction from DB for forecasting. Phase 12.2: mapped demand with sku_mappings."""
from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import date, timedelta

from sqlalchemy import case, func, or_, select
from sqlalchemy.orm import Session

from app.models.marketplace import Marketplace
from app.models.order_item import OrderItem
from app.models.product import Product
from app.models.sku_mapping import SkuMapping
from app.schemas.sku_mapping import (
    SKU_MAPPING_STATUS_CONFIRMED,
    SKU_MAPPING_STATUS_DISCONTINUED,
    SKU_MAPPING_STATUS_IGNORED,
    SKU_MAPPING_STATUS_PENDING,
)

logger = logging.getLogger(__name__)


@dataclass
class DemandMeta:
    """Metadata for mapped demand: excluded and unmapped counts."""

    excluded_units: int
    excluded_rows: int
    excluded_skus: int
    unmapped_units: int
    unmapped_skus: int
    ignored_units: int
    discontinued_units: int


def get_data_end_date_total(db: Session, marketplace_code: str) -> date | None:
    """
    Return MAX(order_items.order_date) for total (optionally filtered by marketplace).
    Returns None if no rows.
    """
    q = select(func.max(OrderItem.order_date)).select_from(OrderItem)
    if marketplace_code != "ALL":
        q = q.join(Marketplace, OrderItem.marketplace_id == Marketplace.id).where(
            Marketplace.code == marketplace_code
        )
    result = db.scalar(q)
    return result


def get_data_end_date_sku(
    db: Session, sku: str, marketplace_code: str
) -> date | None:
    """
    Return MAX(order_items.order_date) for given sku (optionally filtered by marketplace).
    Returns None if no rows.
    """
    q = (
        select(func.max(OrderItem.order_date))
        .select_from(OrderItem)
        .where(OrderItem.sku == sku)
    )
    if marketplace_code != "ALL":
        q = q.join(Marketplace, OrderItem.marketplace_id == Marketplace.id).where(
            Marketplace.code == marketplace_code
        )
    result = db.scalar(q)
    return result


def get_daily_units_total(
    db: Session,
    start_date: date,
    end_date: date | None,
    marketplace: str,
) -> list[tuple[date, int]]:
    """
    Aggregate SUM(order_items.units) per day over history range.
    If end_date is None, use get_data_end_date_total(); if still None, use date.today() and return empty-shaped series.
    Filter by marketplace if marketplace != "ALL".
    Return complete daily date range (fill missing days with 0).
    """
    if end_date is None:
        end_date = get_data_end_date_total(db, marketplace)
    if end_date is None:
        end_date = date.today()
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
    end_date: date | None,
    marketplace: str,
) -> list[tuple[date, int]]:
    """
    Aggregate SUM(units) per day filtered by sku.
    If end_date is None, use get_data_end_date_sku(); if still None, use date.today() and return empty-shaped series.
    Filter by marketplace if marketplace != "ALL".
    Return complete daily date range (fill missing days with 0).
    """
    if end_date is None:
        end_date = get_data_end_date_sku(db, sku, marketplace)
    if end_date is None:
        end_date = date.today()
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


def get_daily_units_total_mapped(
    db: Session,
    start_date: date,
    end_date: date | None,
    marketplace_code: str | None,
    include_unmapped: bool = False,
) -> tuple[list[tuple[date, int]], DemandMeta]:
    """
    Aggregate daily units from order_items using sku_mappings: include only confirmed by default.
    Join order_items → marketplaces (code), left join sku_mappings on (sku, marketplace_code).
    If include_unmapped=True, add units from unmapped/pending rows to the series.
    Returns (series, meta) where meta has excluded_units, unmapped_units, etc.
    """
    if end_date is None:
        end_date = get_data_end_date_total(db, marketplace_code or "ALL")
    if end_date is None:
        end_date = date.today()

    confirmed_case = case((SkuMapping.status == SKU_MAPPING_STATUS_CONFIRMED, OrderItem.units), else_=0)
    ignored_case = case((SkuMapping.status == SKU_MAPPING_STATUS_IGNORED, OrderItem.units), else_=0)
    discontinued_case = case((SkuMapping.status == SKU_MAPPING_STATUS_DISCONTINUED, OrderItem.units), else_=0)
    unmapped_case = case(
        (SkuMapping.id.is_(None), OrderItem.units),
        (SkuMapping.status == SKU_MAPPING_STATUS_PENDING, OrderItem.units),
        else_=0,
    )

    q = (
        select(
            OrderItem.order_date,
            func.sum(confirmed_case).label("confirmed_units"),
            func.sum(ignored_case).label("ignored_units"),
            func.sum(discontinued_case).label("discontinued_units"),
            func.sum(unmapped_case).label("unmapped_units"),
        )
        .select_from(OrderItem)
        .join(Marketplace, OrderItem.marketplace_id == Marketplace.id)
        .outerjoin(
            SkuMapping,
            (OrderItem.sku == SkuMapping.sku) & (Marketplace.code == SkuMapping.marketplace_code),
        )
        .where(
            OrderItem.order_date >= start_date,
            OrderItem.order_date <= end_date,
        )
    )
    if marketplace_code and marketplace_code != "ALL":
        q = q.where(Marketplace.code == marketplace_code)
    q = q.group_by(OrderItem.order_date)
    rows = {r.order_date: r for r in db.execute(q).all()}

    meta_q = (
        select(
            func.sum(confirmed_case).label("confirmed_units"),
            func.sum(ignored_case).label("ignored_units"),
            func.sum(discontinued_case).label("discontinued_units"),
            func.sum(unmapped_case).label("unmapped_units"),
        )
        .select_from(OrderItem)
        .join(Marketplace, OrderItem.marketplace_id == Marketplace.id)
        .outerjoin(
            SkuMapping,
            (OrderItem.sku == SkuMapping.sku) & (Marketplace.code == SkuMapping.marketplace_code),
        )
        .where(
            OrderItem.order_date >= start_date,
            OrderItem.order_date <= end_date,
        )
    )
    if marketplace_code and marketplace_code != "ALL":
        meta_q = meta_q.where(Marketplace.code == marketplace_code)
    meta_row = db.execute(meta_q).one_or_none()
    ignored_total = int(meta_row.ignored_units or 0) if meta_row else 0
    discontinued_total = int(meta_row.discontinued_units or 0) if meta_row else 0
    unmapped_total = int(meta_row.unmapped_units or 0) if meta_row else 0
    excluded_total = ignored_total + discontinued_total

    out_mapped: list[tuple[date, int]] = []
    d = start_date
    while d <= end_date:
        r = rows.get(d)
        if r is None:
            out_mapped.append((d, 0))
        else:
            inc = int(r.confirmed_units or 0)
            if include_unmapped:
                inc += int(r.unmapped_units or 0)
            out_mapped.append((d, inc))
        d += timedelta(days=1)

    meta = DemandMeta(
        excluded_units=excluded_total,
        excluded_rows=0,
        excluded_skus=0,
        unmapped_units=unmapped_total,
        unmapped_skus=0,
        ignored_units=ignored_total,
        discontinued_units=discontinued_total,
    )
    return (out_mapped, meta)


def get_daily_units_by_sku_mapped(
    db: Session,
    sku: str,
    start_date: date,
    end_date: date | None,
    marketplace_code: str | None,
    include_unmapped: bool = False,
) -> tuple[list[tuple[date, int]], DemandMeta]:
    """
    Daily units for a single (sku, marketplace_code), respecting mapping: include only when
    mapping status is confirmed, or (include_unmapped and no mapping or pending).
    Excludes ignored/discontinued.
    """
    if end_date is None:
        end_date = get_data_end_date_sku(db, sku, marketplace_code or "ALL")
    if end_date is None:
        end_date = date.today()

    confirmed_case = case((SkuMapping.status == SKU_MAPPING_STATUS_CONFIRMED, OrderItem.units), else_=0)
    unmapped_case = case(
        (SkuMapping.id.is_(None), OrderItem.units),
        (SkuMapping.status == SKU_MAPPING_STATUS_PENDING, OrderItem.units),
        else_=0,
    )
    ignored_case = case((SkuMapping.status == SKU_MAPPING_STATUS_IGNORED, OrderItem.units), else_=0)
    discontinued_case = case((SkuMapping.status == SKU_MAPPING_STATUS_DISCONTINUED, OrderItem.units), else_=0)

    base_filter = OrderItem.sku == sku
    q = (
        select(
            OrderItem.order_date,
            func.sum(confirmed_case).label("confirmed_units"),
            func.sum(unmapped_case).label("unmapped_units"),
            func.sum(ignored_case).label("ignored_units"),
            func.sum(discontinued_case).label("discontinued_units"),
        )
        .select_from(OrderItem)
        .join(Marketplace, OrderItem.marketplace_id == Marketplace.id)
        .outerjoin(
            SkuMapping,
            (OrderItem.sku == SkuMapping.sku) & (Marketplace.code == SkuMapping.marketplace_code),
        )
        .where(
            base_filter,
            OrderItem.order_date >= start_date,
            OrderItem.order_date <= end_date,
        )
    )
    if marketplace_code and marketplace_code != "ALL":
        q = q.where(Marketplace.code == marketplace_code)
    q = q.group_by(OrderItem.order_date)
    rows = {r.order_date: r for r in db.execute(q).all()}

    meta_q = (
        select(
            func.sum(confirmed_case).label("confirmed_units"),
            func.sum(unmapped_case).label("unmapped_units"),
            func.sum(ignored_case).label("ignored_units"),
            func.sum(discontinued_case).label("discontinued_units"),
        )
        .select_from(OrderItem)
        .join(Marketplace, OrderItem.marketplace_id == Marketplace.id)
        .outerjoin(
            SkuMapping,
            (OrderItem.sku == SkuMapping.sku) & (Marketplace.code == SkuMapping.marketplace_code),
        )
        .where(
            base_filter,
            OrderItem.order_date >= start_date,
            OrderItem.order_date <= end_date,
        )
    )
    if marketplace_code and marketplace_code != "ALL":
        meta_q = meta_q.where(Marketplace.code == marketplace_code)
    meta_row = db.execute(meta_q).one_or_none()
    ignored_total = int(meta_row.ignored_units or 0) if meta_row else 0
    discontinued_total = int(meta_row.discontinued_units or 0) if meta_row else 0
    unmapped_total = int(meta_row.unmapped_units or 0) if meta_row else 0

    out_list: list[tuple[date, int]] = []
    d = start_date
    while d <= end_date:
        r = rows.get(d)
        if r is None:
            out_list.append((d, 0))
        else:
            inc = int(r.confirmed_units or 0)
            if include_unmapped:
                inc += int(r.unmapped_units or 0)
            out_list.append((d, inc))
        d += timedelta(days=1)

    meta = DemandMeta(
        excluded_units=ignored_total + discontinued_total,
        excluded_rows=0,
        excluded_skus=0,
        unmapped_units=unmapped_total,
        unmapped_skus=0,
        ignored_units=ignored_total,
        discontinued_units=discontinued_total,
    )
    return (out_list, meta)


def get_daily_units_by_product_mapped(
    db: Session,
    product_id: int,
    start_date: date,
    end_date: date | None,
    marketplace_code: str | None,
    include_unmapped: bool = False,
) -> tuple[list[tuple[date, int]], DemandMeta]:
    """
    Daily units attributed to product_id via sku_mappings (confirmed) or, if include_unmapped,
    via order_items.sku = products.sku for that product_id (direct match).
    Excludes ignored/discontinued. Unmapped/pending only included when include_unmapped and direct match.
    """
    if end_date is None:
        end_date = date.today()

    product_sku = db.scalar(select(Product.sku).where(Product.id == product_id))
    confirmed_for_product = case(
        (
            (SkuMapping.status == SKU_MAPPING_STATUS_CONFIRMED) & (SkuMapping.product_id == product_id),
            OrderItem.units,
        ),
        else_=0,
    )
    unmapped_direct = case(
        (
            or_(SkuMapping.id.is_(None), SkuMapping.status == SKU_MAPPING_STATUS_PENDING)
            & (OrderItem.sku == product_sku),
            OrderItem.units,
        ),
        else_=0,
    )
    unmapped_other_cond = or_(SkuMapping.id.is_(None), SkuMapping.status == SKU_MAPPING_STATUS_PENDING)
    if product_sku is not None:
        unmapped_other_cond = unmapped_other_cond & (OrderItem.sku != product_sku)
    unmapped_other = case((unmapped_other_cond, OrderItem.units), else_=0)
    ignored_case = case((SkuMapping.status == SKU_MAPPING_STATUS_IGNORED, OrderItem.units), else_=0)
    discontinued_case = case((SkuMapping.status == SKU_MAPPING_STATUS_DISCONTINUED, OrderItem.units), else_=0)

    q = (
        select(
            OrderItem.order_date,
            func.sum(confirmed_for_product).label("included_units"),
            func.sum(unmapped_direct).label("unmapped_direct_units"),
            func.sum(ignored_case).label("ignored_units"),
            func.sum(discontinued_case).label("discontinued_units"),
            func.sum(unmapped_other).label("unmapped_other_units"),
        )
        .select_from(OrderItem)
        .join(Marketplace, OrderItem.marketplace_id == Marketplace.id)
        .outerjoin(
            SkuMapping,
            (OrderItem.sku == SkuMapping.sku) & (Marketplace.code == SkuMapping.marketplace_code),
        )
        .where(
            OrderItem.order_date >= start_date,
            OrderItem.order_date <= end_date,
        )
    )
    if marketplace_code and marketplace_code != "ALL":
        q = q.where(Marketplace.code == marketplace_code)
    q = q.group_by(OrderItem.order_date)
    rows = {r.order_date: r for r in db.execute(q).all()}

    meta_q = (
        select(
            func.sum(confirmed_for_product).label("included"),
            func.sum(unmapped_direct).label("unmapped_direct"),
            func.sum(ignored_case).label("ignored_units"),
            func.sum(discontinued_case).label("discontinued_units"),
            func.sum(unmapped_other).label("unmapped_other"),
        )
        .select_from(OrderItem)
        .join(Marketplace, OrderItem.marketplace_id == Marketplace.id)
        .outerjoin(
            SkuMapping,
            (OrderItem.sku == SkuMapping.sku) & (Marketplace.code == SkuMapping.marketplace_code),
        )
        .where(
            OrderItem.order_date >= start_date,
            OrderItem.order_date <= end_date,
        )
    )
    if marketplace_code and marketplace_code != "ALL":
        meta_q = meta_q.where(Marketplace.code == marketplace_code)
    meta_row = db.execute(meta_q).one_or_none()
    ignored_total = int(meta_row.ignored_units or 0) if meta_row else 0
    discontinued_total = int(meta_row.discontinued_units or 0) if meta_row else 0
    unmapped_other_total = int(meta_row.unmapped_other or 0) if meta_row else 0
    unmapped_direct_total = int(meta_row.unmapped_direct or 0) if meta_row else 0

    out_list: list[tuple[date, int]] = []
    d = start_date
    while d <= end_date:
        r = rows.get(d)
        if r is None:
            out_list.append((d, 0))
        else:
            inc = int(r.included_units or 0)
            if include_unmapped:
                inc += int(r.unmapped_direct_units or 0)
            out_list.append((d, inc))
        d += timedelta(days=1)

    meta = DemandMeta(
        excluded_units=ignored_total + discontinued_total,
        excluded_rows=0,
        excluded_skus=0,
        unmapped_units=unmapped_direct_total + unmapped_other_total,
        unmapped_skus=0,
        ignored_units=ignored_total,
        discontinued_units=discontinued_total,
    )
    return (out_list, meta)


def get_units_health_for_range(
    db: Session,
    start_date: date,
    end_date: date,
    marketplace_code: str | None = None,
) -> tuple[int, int, int, int, int]:
    """
    Return (total_units, confirmed_units, unmapped_units, ignored_units, discontinued_units)
    for the date range from order_items with sku_mappings join.
    """
    confirmed_case = case((SkuMapping.status == SKU_MAPPING_STATUS_CONFIRMED, OrderItem.units), else_=0)
    unmapped_case = case(
        (SkuMapping.id.is_(None), OrderItem.units),
        (SkuMapping.status == SKU_MAPPING_STATUS_PENDING, OrderItem.units),
        else_=0,
    )
    ignored_case = case((SkuMapping.status == SKU_MAPPING_STATUS_IGNORED, OrderItem.units), else_=0)
    discontinued_case = case((SkuMapping.status == SKU_MAPPING_STATUS_DISCONTINUED, OrderItem.units), else_=0)

    q = (
        select(
            func.sum(OrderItem.units).label("total_units"),
            func.sum(confirmed_case).label("confirmed_units"),
            func.sum(unmapped_case).label("unmapped_units"),
            func.sum(ignored_case).label("ignored_units"),
            func.sum(discontinued_case).label("discontinued_units"),
        )
        .select_from(OrderItem)
        .join(Marketplace, OrderItem.marketplace_id == Marketplace.id)
        .outerjoin(
            SkuMapping,
            (OrderItem.sku == SkuMapping.sku) & (Marketplace.code == SkuMapping.marketplace_code),
        )
        .where(
            OrderItem.order_date >= start_date,
            OrderItem.order_date <= end_date,
        )
    )
    if marketplace_code and marketplace_code != "ALL":
        q = q.where(Marketplace.code == marketplace_code)
    row = db.execute(q).one_or_none()
    if row is None:
        return (0, 0, 0, 0, 0)
    return (
        int(row.total_units or 0),
        int(row.confirmed_units or 0),
        int(row.unmapped_units or 0),
        int(row.ignored_units or 0),
        int(row.discontinued_units or 0),
    )
