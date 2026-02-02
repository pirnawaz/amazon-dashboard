"""
Amazon FBA inventory sync service (Phase 11.1 + 11.2).

Phase 11.2: Real SP-API getInventorySummaries with pagination.
Sets last_inventory_sync_status: running -> ok | error.
Upserts amazon_inventory_item by (marketplace_id, seller_sku).
dry_run=true: call SP-API, count rows, do NOT upsert.
Writes audit_log: amazon.inventory.sync (success) and amazon.inventory.sync_error (failure).
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.crypto import TokenEncryptionError, decrypt_token
from app.integrations.amazon_spapi import SpApiClient, SpApiClientError
from app.integrations.amazon_spapi.inventory import fetch_all_inventory_summaries
from app.models.amazon_connection import AmazonConnection, AmazonCredential
from app.models.amazon_inventory_item import AmazonInventoryItem
from app.services.audit_log import write_audit_log

logger = logging.getLogger(__name__)

STATUS_NEVER = "never"
STATUS_RUNNING = "running"
STATUS_OK = "ok"
STATUS_ERROR = "error"
MAX_ERROR_LEN = 500


def _get_marketplace_ids(connection: AmazonConnection) -> list[str]:
    """
    Parse connection.marketplaces_json into list of marketplace IDs.

    Supports: dict (values as IDs), list of strings, list of objects with
    marketplace_id, marketplaceId, or id.
    """
    m = connection.marketplaces_json
    if not m:
        return []
    if isinstance(m, dict):
        return [str(v) for v in m.values() if v]
    if isinstance(m, list):
        out: list[str] = []
        for x in m:
            if x is None:
                continue
            if isinstance(x, str) and x.strip():
                out.append(x.strip())
                continue
            if isinstance(x, dict):
                mid = (
                    x.get("marketplace_id")
                    or x.get("marketplaceId")
                    or x.get("id")
                )
                if mid is not None and str(mid).strip():
                    out.append(str(mid).strip())
        return out
    return []


def _get_credential_for_connection(db: Session, connection_id: int) -> AmazonCredential | None:
    """Return the first credential for the connection (single-tenant)."""
    return db.scalar(
        select(AmazonCredential).where(AmazonCredential.connection_id == connection_id).limit(1)
    )


def _upsert_inventory_item(db: Session, item: dict[str, Any]) -> None:
    """Upsert one amazon_inventory_item by (marketplace_id, seller_sku)."""
    marketplace_id = str(item["marketplace_id"]).strip()
    seller_sku = str(item["seller_sku"]).strip()
    if not marketplace_id or not seller_sku:
        return
    row = db.scalar(
        select(AmazonInventoryItem).where(
            AmazonInventoryItem.marketplace_id == marketplace_id,
            AmazonInventoryItem.seller_sku == seller_sku,
        )
    )
    payload = item.get("raw_payload")
    if row is None:
        row = AmazonInventoryItem(
            marketplace_id=marketplace_id,
            seller_sku=seller_sku,
            fn_sku=item.get("fn_sku"),
            asin=item.get("asin"),
            quantity_available=item.get("quantity_available"),
            quantity_reserved=item.get("quantity_reserved"),
            raw_payload=payload,
        )
        db.add(row)
        db.flush()
    else:
        row.fn_sku = item.get("fn_sku")
        row.asin = item.get("asin")
        row.quantity_available = item.get("quantity_available")
        row.quantity_reserved = item.get("quantity_reserved")
        row.raw_payload = payload
        row.updated_at = datetime.now(timezone.utc)
        db.flush()


def run_inventory_sync(
    db: Session,
    connection: AmazonConnection,
    actor_user_id: int,
    dry_run: bool = False,
) -> int:
    """
    Run FBA inventory sync for the given connection (Phase 11.2: real SP-API).

    - Loads credential, decrypts refresh token; raises TokenEncryptionError if key missing.
    - Sets last_inventory_sync_status to running, then ok or error.
    - Calls getInventorySummaries per marketplace with pagination.
    - dry_run=true: call SP-API, count rows, do NOT upsert.
    - dry_run=false: upsert each normalized row into amazon_inventory_item.
    - Updates last_inventory_sync_* and writes audit_log (success: amazon.inventory.sync;
      failure: amazon.inventory.sync_error).
    - Returns items_upserted count (or items fetched count when dry_run).
    """
    connection_id = connection.id
    connection.last_inventory_sync_status = STATUS_RUNNING
    connection.last_inventory_sync_error = None
    db.flush()

    try:
        marketplace_ids = _get_marketplace_ids(connection)
        if not marketplace_ids:
            err = "No marketplaces configured (set marketplaces_json on connection)."
            connection.last_inventory_sync_status = STATUS_ERROR
            connection.last_inventory_sync_error = err[:MAX_ERROR_LEN]
            connection.updated_at = datetime.now(timezone.utc)
            db.flush()
            logger.warning(
                "inventory_sync_failure",
                extra={"connection_id": connection_id, "error_summary": err[:200]},
            )
            write_audit_log(
                db,
                actor_user_id=actor_user_id,
                action="amazon.inventory.sync",
                resource_type="amazon_connection",
                resource_id="global",
                metadata={"ok": False, "error_summary": err[:200], "dry_run": dry_run},
            )
            raise RuntimeError(err)

        cred = _get_credential_for_connection(db, connection.id)
        if cred is None or not cred.has_refresh_token:
            err = "Missing credential or refresh token (save credential with token first)."
            connection.last_inventory_sync_status = STATUS_ERROR
            connection.last_inventory_sync_error = err[:MAX_ERROR_LEN]
            connection.updated_at = datetime.now(timezone.utc)
            db.flush()
            logger.warning(
                "inventory_sync_failure",
                extra={"connection_id": connection_id, "error_summary": err[:200]},
            )
            write_audit_log(
                db,
                actor_user_id=actor_user_id,
                action="amazon.inventory.sync_error",
                resource_type="amazon_connection",
                resource_id="global",
                metadata={"error": err[:200], "dry_run": dry_run},
            )
            raise RuntimeError(err)

        try:
            decrypted = decrypt_token(cred.lwa_refresh_token_encrypted or "")
        except TokenEncryptionError as e:
            err = str(e)[:MAX_ERROR_LEN]
            connection.last_inventory_sync_status = STATUS_ERROR
            connection.last_inventory_sync_error = err
            connection.updated_at = datetime.now(timezone.utc)
            db.flush()
            logger.warning(
                "inventory_sync_failure",
                extra={"connection_id": connection_id, "error_summary": err[:200]},
            )
            write_audit_log(
                db,
                actor_user_id=actor_user_id,
                action="amazon.inventory.sync_error",
                resource_type="amazon_connection",
                resource_id="global",
                metadata={"error": err[:200], "dry_run": dry_run},
            )
            raise

        client = SpApiClient(refresh_token=decrypted)
        items = fetch_all_inventory_summaries(client, marketplace_ids, details=True)

        items_upserted = 0
        if not dry_run:
            for item in items:
                _upsert_inventory_item(db, item)
                items_upserted += 1
        else:
            items_upserted = len(items)

        now = datetime.now(timezone.utc)
        connection.last_inventory_sync_status = STATUS_OK
        connection.last_inventory_sync_error = None
        connection.last_inventory_sync_items_count = items_upserted
        connection.updated_at = now
        if not dry_run and items_upserted > 0:
            connection.last_inventory_sync_at = now
        db.flush()

        write_audit_log(
            db,
            actor_user_id=actor_user_id,
            action="amazon.inventory.sync",
            resource_type="amazon_connection",
            resource_id="global",
            metadata={
                "ok": True,
                "dry_run": dry_run,
                "items": items_upserted,
                "marketplaces": marketplace_ids,
            },
        )
        logger.info(
            "inventory_sync_success",
            extra={
                "connection_id": connection_id,
                "dry_run": dry_run,
                "items_upserted": items_upserted,
            },
        )
        return items_upserted
    except (TokenEncryptionError, SpApiClientError, RuntimeError):
        raise
    except Exception as e:
        err_msg = str(e)[:MAX_ERROR_LEN]
        connection.last_inventory_sync_status = STATUS_ERROR
        connection.last_inventory_sync_error = err_msg
        connection.updated_at = datetime.now(timezone.utc)
        db.flush()
        logger.warning(
            "inventory_sync_failure",
            extra={
                "connection_id": connection_id,
                "dry_run": dry_run,
                "error_summary": err_msg[:200],
            },
        )
        write_audit_log(
            db,
            actor_user_id=actor_user_id,
            action="amazon.inventory.sync_error",
            resource_type="amazon_connection",
            resource_id="global",
            metadata={"error": err_msg[:200], "dry_run": dry_run},
        )
        raise
