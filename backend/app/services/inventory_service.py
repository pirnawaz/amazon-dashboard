"""Inventory levels service: get, upsert, list, delete."""
from __future__ import annotations

import math
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.inventory import InventoryLevel
from app.schemas.inventory import InventoryUpsertRequest

STALE_DAYS = 7  # Configurable: stale if not updated in 7+ days


def get_inventory(
    db: Session,
    sku: str,
    marketplace: str,
) -> InventoryLevel | None:
    """Return inventory level for sku+marketplace or None."""
    return db.scalar(
        select(InventoryLevel).where(
            InventoryLevel.sku == sku,
            InventoryLevel.marketplace == marketplace,
        )
    )


def upsert_inventory(db: Session, data: InventoryUpsertRequest) -> InventoryLevel:
    """Create or update inventory level; updates updated_at."""
    row = get_inventory(db, data.sku, data.marketplace)
    now = datetime.now(timezone.utc)
    if row is None:
        row = InventoryLevel(
            sku=data.sku,
            marketplace=data.marketplace,
            on_hand_units=data.on_hand_units,
            reserved_units=data.reserved_units,
            source=data.source,
            note=data.note,
        )
        db.add(row)
        db.flush()
    else:
        row.on_hand_units = data.on_hand_units
        row.reserved_units = data.reserved_units
        row.source = data.source
        row.note = data.note
        row.updated_at = now
    db.commit()
    db.refresh(row)
    return row


def list_inventory(
    db: Session,
    marketplace: str | None = None,
    q: str | None = None,
    limit: int = 200,
) -> list[InventoryLevel]:
    """List inventory levels with optional marketplace and SKU substring filter."""
    stmt = select(InventoryLevel).order_by(
        InventoryLevel.marketplace,
        InventoryLevel.sku,
    )
    if marketplace is not None and marketplace != "":
        stmt = stmt.where(InventoryLevel.marketplace == marketplace)
    if q is not None and q.strip() != "":
        stmt = stmt.where(InventoryLevel.sku.ilike(f"%{q.strip()}%"))
    stmt = stmt.limit(max(1, min(limit, 500)))
    return list(db.scalars(stmt).all())


def delete_inventory(db: Session, sku: str, marketplace: str) -> None:
    """Delete inventory level for sku+marketplace if present."""
    row = get_inventory(db, sku, marketplace)
    if row is not None:
        db.delete(row)
        db.commit()


def freshness_days(updated_at: datetime) -> int:
    """Floor of (now - updated_at) in days."""
    now = datetime.now(timezone.utc)
    if updated_at.tzinfo is None:
        updated_at = updated_at.replace(tzinfo=timezone.utc)
    delta = now - updated_at
    return max(0, int(math.floor(delta.total_seconds() / 86400)))


def is_stale(freshness_days: int) -> bool:
    return freshness_days >= STALE_DAYS
