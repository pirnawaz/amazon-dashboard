"""
Phase 11.3: Bridge amazon_inventory_item (FBA) into internal inventory_levels.

Path A — Internal inventory model (inventory_levels) exists. We extended it with
source_key and as_of_at; keyed by (source, source_key). This bridge:
- Reads all amazon_inventory_item rows
- Resolves marketplace_id -> internal code via connection.marketplaces_json
- Ensures Product(seller_sku) and Marketplace(code) exist (create if missing, same as orders bridge)
- Upserts inventory_levels by (source='spapi', source_key=marketplace_id|seller_sku)
- Maps: quantity_available -> on_hand_units, quantity_reserved -> reserved_units, updated_at -> as_of_at
- Idempotent: repeated runs do not create duplicates
- Per-row failures: continue and report partial failure; audit_log for bridge runs and errors
- Caller must commit; bridge does not commit (retry-safe)
"""
from __future__ import annotations

import logging
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.amazon_connection import AmazonConnection
from app.models.amazon_inventory_item import AmazonInventoryItem
from app.models.marketplace import Marketplace
from app.models.product import Product
from app.services.audit_log import write_audit_log
from app.services.inventory_service import (
    SOURCE_SPAPI,
    get_inventory_by_source_key,
)

logger = logging.getLogger(__name__)


def _marketplace_id_to_code(connection: AmazonConnection, marketplace_id: str) -> str | None:
    """Resolve SP-API marketplace_id to internal code from connection.marketplaces_json."""
    m = connection.marketplaces_json
    if not m or not isinstance(m, dict):
        return None
    for code, mid in m.items():
        if str(mid).strip() == str(marketplace_id).strip():
            return str(code).strip() if code else None
    return None


def _get_or_create_marketplace_by_code(db: Session, code: str) -> Marketplace | None:
    """Get Marketplace by code; create minimal row if missing (same pattern as orders bridge)."""
    row = db.scalar(select(Marketplace).where(Marketplace.code == code))
    if row is not None:
        return row
    row = Marketplace(code=code, name=code, currency=None)
    db.add(row)
    db.flush()
    return row


def _get_or_create_product_by_sku(
    db: Session,
    sku: str,
    asin: str | None,
) -> Product | None:
    """Get Product by sku; create minimal row if missing (same pattern as orders bridge)."""
    sku = (sku or "").strip()
    if not sku or len(sku) > 100:
        return None
    row = db.scalar(select(Product).where(Product.sku == sku))
    if row is not None:
        return row
    asin = (asin or "").strip()[:20] or "—"
    title = "—"
    row = Product(sku=sku, asin=asin, title=title)
    db.add(row)
    db.flush()
    return row


def _spapi_source_key(marketplace_id: str, seller_sku: str) -> str:
    """Stable identifier for SP-API bridge row; unique per (marketplace_id, seller_sku)."""
    return f"{marketplace_id}|{seller_sku}"


def run_inventory_bridge(
    db: Session,
    connection: AmazonConnection,
    actor_user_id: int,
) -> dict[str, Any]:
    """
    Bridge amazon_inventory_item rows into inventory_levels (Phase 11.3).

    - Ensures Product(seller_sku) and Marketplace(marketplace_id -> code) exist
    - Upserts by (source='spapi', source_key=marketplace_id|seller_sku)
    - Maps: quantity_available -> on_hand_units, quantity_reserved -> reserved_units,
      updated_at -> as_of_at. Does not delete historical inventory.
    - If a single row fails (e.g. no code for marketplace_id), continue and report partial failure.
    - Caller must commit. Returns {"upserted": int, "skipped": int, "errors": int, "error_summary": str | None}.
    """
    from app.models.inventory import InventoryLevel

    connection_id = connection.id
    items = list(db.scalars(select(AmazonInventoryItem).order_by(AmazonInventoryItem.id)).all())
    upserted = 0
    skipped = 0
    errors = 0
    error_messages: list[str] = []

    for item in items:
        marketplace_id = (item.marketplace_id or "").strip()
        seller_sku = (item.seller_sku or "").strip()
        if not marketplace_id or not seller_sku:
            skipped += 1
            continue

        code = _marketplace_id_to_code(connection, marketplace_id)
        if not code:
            errors += 1
            error_messages.append(f"no code for marketplace_id={marketplace_id!r}")
            logger.warning(
                "inventory_bridge_skip",
                extra={"marketplace_id": marketplace_id, "seller_sku": seller_sku[:50], "reason": "no_code"},
            )
            continue

        product = _get_or_create_product_by_sku(db, seller_sku, item.asin)
        if not product:
            errors += 1
            error_messages.append(f"invalid sku={seller_sku!r}")
            continue

        mkt = _get_or_create_marketplace_by_code(db, code)
        if not mkt:
            errors += 1
            error_messages.append(f"marketplace code={code!r}")
            continue

        source_key = _spapi_source_key(marketplace_id, seller_sku)
        on_hand = item.quantity_available if item.quantity_available is not None else 0
        reserved = item.quantity_reserved
        as_of_at = item.updated_at

        try:
            existing = get_inventory_by_source_key(db, SOURCE_SPAPI, source_key)
            if existing:
                existing.sku = product.sku
                existing.marketplace = code
                existing.on_hand_units = float(on_hand)
                existing.reserved_units = float(reserved) if reserved is not None else None
                existing.as_of_at = as_of_at
                db.flush()
            else:
                row = InventoryLevel(
                    sku=product.sku,
                    marketplace=code,
                    on_hand_units=float(on_hand),
                    reserved_units=float(reserved) if reserved is not None else None,
                    source=SOURCE_SPAPI,
                    source_key=source_key,
                    as_of_at=as_of_at,
                    note=None,
                )
                db.add(row)
                db.flush()
            upserted += 1
        except Exception as e:
            errors += 1
            err_msg = str(e)[:200]
            error_messages.append(err_msg)
            logger.warning(
                "inventory_bridge_row_error",
                extra={"marketplace_id": marketplace_id, "seller_sku": seller_sku[:50], "error": err_msg},
            )

    error_summary = "; ".join(error_messages[:5]) if error_messages else None
    if len(error_messages) > 5:
        error_summary = (error_summary or "") + f" (+{len(error_messages) - 5} more)"

    write_audit_log(
        db,
        actor_user_id=actor_user_id,
        action="amazon.inventory.bridge",
        resource_type="amazon_connection",
        resource_id="global",
        metadata={
            "upserted": upserted,
            "skipped": skipped,
            "errors": errors,
            "error_summary": error_summary,
        },
    )
    logger.info(
        "inventory_bridge_done",
        extra={"connection_id": connection_id, "upserted": upserted, "skipped": skipped, "errors": errors},
    )
    return {
        "upserted": upserted,
        "skipped": skipped,
        "errors": errors,
        "error_summary": error_summary,
    }
