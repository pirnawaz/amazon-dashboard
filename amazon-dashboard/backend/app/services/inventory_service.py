"""Inventory levels service: get, upsert, list, delete.

Phase 11.3: Multiple rows per (sku, marketplace) allowed (e.g. manual + spapi).
get_inventory returns the best row: prefer source='spapi', then latest as_of_at.
Manual upsert keys by (source='manual', source_key='manual_<sku>_<marketplace>').
Phase 11.4: Hour-based freshness (warning/critical) from config; freshness_from_timestamp helper.
Phase 11.5: Manual endpoints only act on source='manual'; spapi rows are read-only to manual API.
get_on_hand_for_restock returns (on_hand, source, warning) for restock/forecast single source of truth.
"""
from __future__ import annotations

import math
from datetime import datetime, timezone
from typing import Literal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.inventory import InventoryLevel
from app.schemas.inventory import InventoryUpsertRequest

STALE_DAYS = 7  # Legacy: stale if not updated in 7+ days (freshness_days / is_stale)
FreshnessStatus = Literal["unknown", "fresh", "warning", "critical"]

SOURCE_MANUAL = "manual"
SOURCE_SPAPI = "spapi"


def _manual_source_key(sku: str, marketplace: str) -> str:
    """Stable key for manual inventory row (Phase 11.3)."""
    return f"manual_{sku}_{marketplace}"


def get_inventory(
    db: Session,
    sku: str,
    marketplace: str,
) -> InventoryLevel | None:
    """
    Return the best inventory level for sku+marketplace or None.

    Phase 11.3: Prefer source='spapi', then latest as_of_at, so restock/forecast
    see SP-API data when present without changing callers.
    """
    stmt = (
        select(InventoryLevel)
        .where(
            InventoryLevel.sku == sku,
            InventoryLevel.marketplace == marketplace,
        )
        .order_by(
            # Prefer spapi (1) over manual (0)
            (InventoryLevel.source == SOURCE_SPAPI).desc(),
            InventoryLevel.as_of_at.desc().nulls_last(),
        )
        .limit(1)
    )
    return db.scalar(stmt)


def get_inventory_by_source_key(db: Session, source: str, source_key: str) -> InventoryLevel | None:
    """Return inventory level by (source, source_key) for idempotent upsert."""
    return db.scalar(
        select(InventoryLevel).where(
            InventoryLevel.source == source,
            InventoryLevel.source_key == source_key,
        )
    )


def upsert_inventory(db: Session, data: InventoryUpsertRequest) -> InventoryLevel:
    """
    Create or update inventory level (manual only). Updates updated_at.

    Phase 11.5: Manual endpoints must only act on source='manual'. Spapi rows are read-only
    to manual API — we never overwrite or delete them. We only look up by (SOURCE_MANUAL, manual_key).
    """
    source_key = _manual_source_key(data.sku, data.marketplace)
    row = get_inventory_by_source_key(db, SOURCE_MANUAL, source_key)
    now = datetime.now(timezone.utc)
    if row is None:
        row = InventoryLevel(
            sku=data.sku,
            marketplace=data.marketplace,
            on_hand_units=data.on_hand_units,
            reserved_units=data.reserved_units or 0,
            source=SOURCE_MANUAL,
            source_key=source_key,
            as_of_at=now,
            note=data.note,
        )
        db.add(row)
        db.flush()
    else:
        row.on_hand_units = data.on_hand_units
        row.reserved_units = data.reserved_units or 0
        row.note = data.note
        row.as_of_at = now
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
    """
    List inventory levels with optional marketplace and SKU substring filter.

    Phase 11.3: Returns one row per (sku, marketplace) — the best row (prefer spapi,
    then latest as_of_at). Fetches more rows then dedupes so limit applies to result count.
    """
    stmt = select(InventoryLevel).order_by(
        InventoryLevel.marketplace,
        InventoryLevel.sku,
        (InventoryLevel.source == SOURCE_SPAPI).desc(),
        InventoryLevel.as_of_at.desc().nulls_last(),
    )
    if marketplace is not None and marketplace != "":
        stmt = stmt.where(InventoryLevel.marketplace == marketplace)
    if q is not None and q.strip() != "":
        stmt = stmt.where(InventoryLevel.sku.ilike(f"%{q.strip()}%"))
    stmt = stmt.limit(max(1, min(limit, 500)) * 2)
    rows = list(db.scalars(stmt).all())
    seen: set[tuple[str, str]] = set()
    result: list[InventoryLevel] = []
    for row in rows:
        key = (row.sku, row.marketplace)
        if key in seen:
            continue
        seen.add(key)
        result.append(row)
        if len(result) >= max(1, min(limit, 500)):
            break
    return result


def delete_inventory(db: Session, sku: str, marketplace: str) -> None:
    """
    Delete only the manual inventory row for sku+marketplace (Phase 11.5).

    Spapi rows are read-only to manual endpoints; we never delete them.
    Only the row with source='manual' and source_key='manual_<sku>_<marketplace>' is removed.
    """
    row = get_inventory_by_source_key(db, SOURCE_MANUAL, _manual_source_key(sku, marketplace))
    if row is not None:
        db.delete(row)
        db.commit()


def get_on_hand_for_restock(
    db: Session, sku: str, marketplace: str
) -> tuple[float, str | None, str | None]:
    """
    Phase 11.5: Single source of truth for on-hand in restock/forecast.

    Returns (on_hand_units, source, warning_message).
    - If a row exists (spapi preferred, then manual): (available_units(), row.source, None).
    - If no row: (0.0, None, "No inventory data found"). Caller should not crash; may attach warning.
    """
    row = get_inventory(db, sku, marketplace)
    if row is not None:
        return (float(row.available_units()), row.source, None)
    return (0.0, None, "No inventory data found")


def _age_hours(ts: datetime) -> float:
    """Age in hours from ts to now (>= 0)."""
    now = datetime.now(timezone.utc)
    if ts.tzinfo is None:
        ts = ts.replace(tzinfo=timezone.utc)
    delta = now - ts
    return max(0.0, delta.total_seconds() / 3600.0)


def freshness_from_timestamp(ts: datetime | None) -> tuple[FreshnessStatus, float | None]:
    """
    Phase 11.4: Return (freshness_status, age_hours) for a timestamp.
    unknown + None when ts is None; otherwise fresh/warning/critical and age in hours.
    Uses INVENTORY_STALE_WARNING_HOURS and INVENTORY_STALE_CRITICAL_HOURS from config.
    """
    if ts is None:
        return ("unknown", None)
    age = _age_hours(ts)
    wh = getattr(settings, "inventory_stale_warning_hours", 24)
    ch = getattr(settings, "inventory_stale_critical_hours", 72)
    if age >= ch:
        return ("critical", round(age, 2))
    if age >= wh:
        return ("warning", round(age, 2))
    return ("fresh", round(age, 2))


def freshness_days(updated_at: datetime) -> int:
    """Floor of (now - updated_at) in days."""
    now = datetime.now(timezone.utc)
    if updated_at.tzinfo is None:
        updated_at = updated_at.replace(tzinfo=timezone.utc)
    delta = now - updated_at
    return max(0, int(math.floor(delta.total_seconds() / 86400)))


def is_stale(freshness_days: int) -> bool:
    return freshness_days >= STALE_DAYS
