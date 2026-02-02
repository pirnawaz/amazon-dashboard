"""SKU mapping and unmapped-SKU service (Phase 12.1, 12.4)."""
from __future__ import annotations

from datetime import date, datetime
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.inventory import InventoryLevel
from app.models.marketplace import Marketplace
from app.models.order_item import OrderItem
from app.models.product import Product
from app.models.sku_mapping import SkuMapping
from app.schemas.sku_mapping import (
    UnmappedSkuRow,
    UnmappedSkuWithSuggestion,
)

# Sentinel: when passed to upsert_sku_mapping, means "do not change this field".
LEAVE_UNCHANGED: Any = object()


def get_sku_mapping_by_id(db: Session, mapping_id: int) -> SkuMapping | None:
    """Return SkuMapping by id or None."""
    return db.scalar(select(SkuMapping).where(SkuMapping.id == mapping_id))


def get_sku_mapping_by_sku_marketplace(
    db: Session, sku: str, marketplace_code: str
) -> SkuMapping | None:
    """Return SkuMapping by (sku, marketplace_code) or None."""
    return db.scalar(
        select(SkuMapping).where(
            SkuMapping.sku == sku,
            SkuMapping.marketplace_code == marketplace_code,
        )
    )


def list_sku_mappings(
    db: Session,
    marketplace_code: str | None = None,
    status: str | None = None,
    limit: int = 100,
    offset: int = 0,
) -> tuple[int, list[SkuMapping]]:
    """Return (total count, list of SkuMapping) with optional filters and pagination."""
    base = select(SkuMapping)
    count_base = select(func.count()).select_from(SkuMapping)
    if marketplace_code:
        base = base.where(SkuMapping.marketplace_code == marketplace_code)
        count_base = count_base.where(SkuMapping.marketplace_code == marketplace_code)
    if status:
        base = base.where(SkuMapping.status == status)
        count_base = count_base.where(SkuMapping.status == status)
    total = db.scalar(count_base) or 0
    base = base.order_by(SkuMapping.sku, SkuMapping.marketplace_code).offset(offset).limit(limit)
    rows = list(db.scalars(base).all())
    return (total, rows)


def update_sku_mapping(
    db: Session,
    mapping_id: int,
    *,
    asin: str | None = None,
    fnsku: str | None = None,
    product_id: int | None = None,
    status: str | None = None,
    notes: str | None = None,
) -> SkuMapping | None:
    """Update a mapping by id; only non-None fields are updated. Returns mapping or None."""
    row = get_sku_mapping_by_id(db, mapping_id)
    if row is None:
        return None
    if asin is not None:
        row.asin = asin
    if fnsku is not None:
        row.fnsku = fnsku
    if product_id is not None:
        row.product_id = product_id
    if status is not None:
        row.status = status
    if notes is not None:
        row.notes = notes
    db.flush()
    return row


def upsert_sku_mapping(
    db: Session,
    sku: str,
    marketplace_code: str,
    *,
    asin: Any = None,
    fnsku: Any = None,
    product_id: Any = None,
    status: Any = None,
    notes: Any = None,
) -> SkuMapping:
    """Get or create mapping by (sku, marketplace_code); set fields (LEAVE_UNCHANGED = do not change)."""
    row = get_sku_mapping_by_sku_marketplace(db, sku, marketplace_code)
    if row is None:
        row = SkuMapping(
            sku=sku,
            marketplace_code=marketplace_code,
            asin=asin if asin is not LEAVE_UNCHANGED else None,
            fnsku=fnsku if fnsku is not LEAVE_UNCHANGED else None,
            product_id=product_id if product_id is not LEAVE_UNCHANGED else None,
            status=status if status is not LEAVE_UNCHANGED else "pending",
            notes=notes if notes is not LEAVE_UNCHANGED else None,
        )
        db.add(row)
        db.flush()
        return row
    if asin is not LEAVE_UNCHANGED:
        row.asin = asin
    if fnsku is not LEAVE_UNCHANGED:
        row.fnsku = fnsku
    if product_id is not LEAVE_UNCHANGED:
        row.product_id = product_id
    if status is not LEAVE_UNCHANGED:
        row.status = status
    if notes is not LEAVE_UNCHANGED:
        row.notes = notes
    db.flush()
    return row


def get_unmapped_skus(
    db: Session,
    marketplace_code: str | None = None,
    limit: int = 100,
    offset: int = 0,
) -> tuple[int, list[UnmappedSkuRow]]:
    """List (sku, marketplace_code) that appear in orders/inventory but not in sku_mappings. Returns (total, items)."""
    oi_sku = select(OrderItem.sku, Marketplace.code).select_from(OrderItem).join(
        Marketplace, OrderItem.marketplace_id == Marketplace.id
    )
    il_sku = select(InventoryLevel.sku, InventoryLevel.marketplace.label("code")).select_from(InventoryLevel)
    union = oi_sku.union(il_sku).subquery()
    unmapped_base = (
        select(union.c.sku, union.c.code)
        .select_from(union)
        .outerjoin(
            SkuMapping,
            (union.c.sku == SkuMapping.sku) & (union.c.code == SkuMapping.marketplace_code),
        )
        .where(SkuMapping.id.is_(None))
        .distinct()
    )
    if marketplace_code:
        unmapped_base = unmapped_base.where(union.c.code == marketplace_code)
    count_q = select(func.count()).select_from(unmapped_base.subquery())
    total = db.scalar(count_q) or 0
    paginated = (
        select(union.c.sku, union.c.code)
        .select_from(union)
        .outerjoin(
            SkuMapping,
            (union.c.sku == SkuMapping.sku) & (union.c.code == SkuMapping.marketplace_code),
        )
        .where(SkuMapping.id.is_(None))
        .distinct()
    )
    if marketplace_code:
        paginated = paginated.where(union.c.code == marketplace_code)
    paginated = paginated.offset(offset).limit(limit)
    pairs = [(r.sku, r.code) for r in db.execute(paginated).all()]
    items: list[UnmappedSkuRow] = []
    for sku, mkt in pairs:
        order_count = db.scalar(
            select(func.count())
            .select_from(OrderItem)
            .join(Marketplace, OrderItem.marketplace_id == Marketplace.id)
            .where(OrderItem.sku == sku, Marketplace.code == mkt)
        ) or 0
        inv_count = db.scalar(
            select(func.count()).select_from(InventoryLevel).where(
                InventoryLevel.sku == sku, InventoryLevel.marketplace == mkt
            )
        ) or 0
        last_oi = db.scalar(
            select(func.max(OrderItem.order_date))
            .select_from(OrderItem)
            .join(Marketplace, OrderItem.marketplace_id == Marketplace.id)
            .where(OrderItem.sku == sku, Marketplace.code == mkt)
        )
        last_il = db.scalar(
            select(func.max(InventoryLevel.updated_at))
            .select_from(InventoryLevel)
            .where(InventoryLevel.sku == sku, InventoryLevel.marketplace == mkt)
        )
        last_seen: date | datetime | None = last_oi
        if last_il:
            il_date = last_il.date() if isinstance(last_il, datetime) else last_il
            cur = last_seen.date() if isinstance(last_seen, datetime) else last_seen
            if last_seen is None or (il_date and cur and il_date > cur):
                last_seen = last_il
        items.append(
            UnmappedSkuRow(
                sku=sku,
                marketplace_code=mkt,
                seen_in_orders=order_count > 0,
                seen_in_inventory=inv_count > 0,
                order_item_count=order_count,
                inventory_row_count=inv_count,
                last_seen_date=last_seen,
                suggested_asin=None,
            )
        )
    return (total, items)


def get_unmapped_skus_with_suggestions(
    db: Session,
    marketplace_code: str | None = None,
    limit: int = 100,
    offset: int = 0,
) -> tuple[int, list[UnmappedSkuWithSuggestion]]:
    """Like get_unmapped_skus but add suggested_product (sku_exact_match or asin_match) and suggestion_reason."""
    from app.schemas.sku_mapping import SuggestedProduct

    total, rows = get_unmapped_skus(db, marketplace_code=marketplace_code, limit=limit, offset=offset)
    items: list[UnmappedSkuWithSuggestion] = []
    for r in rows:
        suggested_product = None
        suggestion_reason: str | None = None
        # sku exact match: product with same sku
        product_by_sku = db.scalar(select(Product).where(Product.sku == r.sku))
        if product_by_sku:
            suggested_product = SuggestedProduct(
                id=product_by_sku.id,
                sku=product_by_sku.sku,
                title=product_by_sku.title or "",
            )
            suggestion_reason = "sku_exact_match"
        # asin match: we don't have ASIN on unmapped row easily; could join amazon_order_item. For now leave asin_match for when we have suggested_asin.
        items.append(
            UnmappedSkuWithSuggestion(
                sku=r.sku,
                marketplace_code=r.marketplace_code,
                seen_in_orders=r.seen_in_orders,
                seen_in_inventory=r.seen_in_inventory,
                order_item_count=r.order_item_count,
                inventory_row_count=r.inventory_row_count,
                last_seen_date=r.last_seen_date,
                suggested_asin=r.suggested_asin,
                suggested_product=suggested_product,
                suggestion_reason=suggestion_reason,
            )
        )
    return (total, items)
