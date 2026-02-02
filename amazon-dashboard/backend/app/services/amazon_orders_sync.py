"""
Amazon orders sync service (Phase 10.2 + 10.3 + 10.4).

Computes last_updated_after, sets status running -> ok/error.
When dry_run=False: calls SP-API GET /orders/v0/orders, paginates, upserts amazon_order.
When include_items=True: fetches order items, upserts amazon_order_item, bridges to order_items.
"""
from __future__ import annotations

import logging
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.crypto import TokenEncryptionError, decrypt_token
from app.integrations.amazon_spapi import SpApiClient, SpApiClientError
from app.models.amazon_connection import AmazonConnection, AmazonCredential
from app.models.amazon_order import AmazonOrder
from app.models.amazon_order_item import AmazonOrderItem
from app.models.marketplace import Marketplace
from app.models.order_item import OrderItem
from app.models.product import Product

logger = logging.getLogger(__name__)

STATUS_RUNNING = "running"
STATUS_OK = "ok"
STATUS_ERROR = "error"
OVERLAP_MINUTES = 10
CURSOR_OVERLAP_MINUTES = 2
DEFAULT_LOOKBACK_DAYS = 30
ORDER_ITEMS_LOOKBACK_DAYS = 30
MAX_ERROR_LEN = 500
ORDERS_PATH = "/orders/v0/orders"
ORDER_ITEMS_PATH_TEMPLATE = "/orders/v0/orders/{order_id}/orderItems"


def _compute_last_updated_after(connection: AmazonConnection) -> datetime:
    """Last sync time minus overlap, or now minus default lookback if never synced."""
    now = datetime.now(timezone.utc)
    if connection.last_orders_sync_at:
        return connection.last_orders_sync_at - timedelta(minutes=OVERLAP_MINUTES)
    return now - timedelta(days=DEFAULT_LOOKBACK_DAYS)


def _get_marketplace_ids(connection: AmazonConnection) -> list[str]:
    """Parse connection.marketplaces_json into list of marketplace IDs (no secrets)."""
    m = connection.marketplaces_json
    if not m:
        return []
    if isinstance(m, dict):
        return [str(v) for v in m.values() if v]
    if isinstance(m, list):
        return [str(x) for x in m if x]
    return []


def _get_credential_for_connection(db: Session, connection_id: int) -> AmazonCredential | None:
    """Return the first credential for the connection (single-tenant)."""
    return db.scalar(
        select(AmazonCredential).where(AmazonCredential.connection_id == connection_id).limit(1)
    )


def _parse_iso(iso: str | None) -> datetime | None:
    if not iso or not iso.strip():
        return None
    s = iso.strip().replace("Z", "+00:00")
    try:
        return datetime.fromisoformat(s)
    except (ValueError, TypeError):
        return None


def _order_total_amount(order: dict[str, Any]) -> Decimal | None:
    ot = order.get("OrderTotal")
    if not isinstance(ot, dict):
        return None
    amt = ot.get("Amount")
    if amt is None:
        return None
    try:
        return Decimal(str(amt))
    except (ValueError, TypeError):
        return None


def _order_total_currency(order: dict[str, Any]) -> str | None:
    ot = order.get("OrderTotal")
    if not isinstance(ot, dict):
        return None
    c = ot.get("CurrencyCode")
    return str(c) if c else None


def _upsert_order(db: Session, order: dict[str, Any]) -> datetime | None:
    """Upsert one order; return LastUpdateDate as datetime or None."""
    amazon_order_id = order.get("AmazonOrderId")
    marketplace_id = order.get("MarketplaceId")
    if not amazon_order_id or not marketplace_id:
        return None
    amazon_order_id = str(amazon_order_id).strip()
    marketplace_id = str(marketplace_id).strip()
    if not amazon_order_id or not marketplace_id:
        return None

    row = db.scalar(
        select(AmazonOrder).where(
            AmazonOrder.amazon_order_id == amazon_order_id,
            AmazonOrder.marketplace_id == marketplace_id,
        )
    )
    if row is None:
        row = AmazonOrder(amazon_order_id=amazon_order_id, marketplace_id=marketplace_id)
        db.add(row)
        db.flush()

    row.purchase_date = _parse_iso(order.get("PurchaseDate"))
    row.last_update_date = _parse_iso(order.get("LastUpdateDate"))
    row.order_status = str(order.get("OrderStatus")) if order.get("OrderStatus") is not None else None
    row.order_total_amount = _order_total_amount(order)
    row.order_total_currency = _order_total_currency(order)
    row.raw_payload = order
    db.flush()
    return row.last_update_date


def _fetch_and_upsert_orders(
    db: Session,
    connection: AmazonConnection,
    refresh_token: str,
    last_updated_after: datetime,
    marketplace_ids: list[str],
) -> tuple[datetime | None, int]:
    """Call SP-API, paginate, upsert orders; return (max LastUpdateDate seen or None, total orders count)."""
    client = SpApiClient(refresh_token=refresh_token)
    marketplace_ids_str = ",".join(marketplace_ids)
    params: dict[str, Any] = {
        "MarketplaceIds": marketplace_ids_str,
        "LastUpdatedAfter": last_updated_after.strftime("%Y-%m-%dT%H:%M:%SZ"),
    }
    max_last_update: datetime | None = None
    total_orders = 0
    page = 0

    while True:
        page += 1
        resp = client.request("GET", ORDERS_PATH, params=params)
        if resp.status_code != 200:
            raise SpApiClientError(
                f"Orders API returned {resp.status_code}",
                method="GET",
                path=ORDERS_PATH,
                status_code=resp.status_code,
                response_body=resp.text[:MAX_ERROR_LEN] if resp.text else None,
            )
        data = resp.json()
        payload = data.get("payload") if isinstance(data, dict) else {}
        if not isinstance(payload, dict):
            payload = {}
        orders = payload.get("Orders")
        if not isinstance(orders, list):
            orders = []

        for o in orders:
            if isinstance(o, dict):
                dt = _upsert_order(db, o)
                total_orders += 1
                if dt and (max_last_update is None or dt > max_last_update):
                    max_last_update = dt

        logger.info(
            "orders_sync_page",
            extra={
                "connection_id": connection.id,
                "page": page,
                "orders_count": len(orders),
            },
        )

        next_token = payload.get("NextToken") if isinstance(payload.get("NextToken"), str) else None
        if not next_token:
            break
        params = {"NextToken": next_token}

    return (max_last_update, total_orders)


# ----- Order items (Phase 10.4) -----


def _sp_api_marketplace_id_to_code(connection: AmazonConnection, marketplace_id: str) -> str | None:
    """Resolve SP-API marketplace_id to internal code from connection.marketplaces_json (e.g. ATVPDKIKX0DER -> NA)."""
    m = connection.marketplaces_json
    if not m or not isinstance(m, dict):
        return None
    for code, mid in m.items():
        if str(mid).strip() == str(marketplace_id).strip():
            return str(code).strip() if code else None
    return None


def _get_or_create_marketplace_by_code(db: Session, code: str) -> Marketplace | None:
    """Get Marketplace by code; create minimal row if missing (for bridge). Currency left NULL when created from sync."""
    row = db.scalar(select(Marketplace).where(Marketplace.code == code))
    if row is not None:
        return row
    row = Marketplace(code=code, name=code, currency=None)
    db.add(row)
    db.flush()
    return row


def _get_or_create_product_by_sku(db: Session, sku: str, asin: str | None, title: str | None) -> Product | None:
    """Get Product by sku; create minimal row if missing (for bridge)."""
    sku = (sku or "").strip()
    if not sku or len(sku) > 100:
        return None
    row = db.scalar(select(Product).where(Product.sku == sku))
    if row is not None:
        return row
    asin = (asin or "").strip()[:20] or "—"
    title = (title or "").strip()[:500] or "—"
    row = Product(sku=sku, asin=asin, title=title)
    db.add(row)
    db.flush()
    return row


def _item_price_amount(item: dict[str, Any]) -> Decimal | None:
    """Extract item price amount from SP-API order item payload."""
    price = item.get("ItemPrice")
    if not isinstance(price, dict):
        return None
    amt = price.get("Amount")
    if amt is None:
        return None
    try:
        return Decimal(str(amt))
    except (ValueError, TypeError):
        return None


def _upsert_amazon_order_item(
    db: Session,
    item: dict[str, Any],
    amazon_order_id: str,
    marketplace_id: str,
) -> None:
    """Upsert one amazon_order_item; idempotent on (order_item_id, amazon_order_id, marketplace_id)."""
    order_item_id = item.get("OrderItemId")
    if not order_item_id:
        return
    order_item_id = str(order_item_id).strip()
    seller_sku = str(item.get("SellerSKU")).strip() if item.get("SellerSKU") is not None else None
    asin = str(item.get("ASIN")).strip() if item.get("ASIN") is not None else None
    qty = item.get("QuantityOrdered")
    if qty is not None and not isinstance(qty, int):
        try:
            qty = int(qty)
        except (ValueError, TypeError):
            qty = None
    price_currency = None
    price_obj = item.get("ItemPrice")
    if isinstance(price_obj, dict) and price_obj.get("CurrencyCode"):
        price_currency = str(price_obj.get("CurrencyCode"))

    row = db.scalar(
        select(AmazonOrderItem).where(
            AmazonOrderItem.order_item_id == order_item_id,
            AmazonOrderItem.amazon_order_id == amazon_order_id,
            AmazonOrderItem.marketplace_id == marketplace_id,
        )
    )
    if row is None:
        row = AmazonOrderItem(
            order_item_id=order_item_id,
            amazon_order_id=amazon_order_id,
            marketplace_id=marketplace_id,
        )
        db.add(row)
        db.flush()
    row.seller_sku = seller_sku or None
    row.asin = asin or None
    row.quantity_ordered = qty
    row.item_price_amount = _item_price_amount(item)
    row.item_price_currency = price_currency
    row.raw_payload = item
    db.flush()


def _fetch_order_items(client: SpApiClient, amazon_order_id: str) -> list[dict[str, Any]]:
    """GET /orders/v0/orders/{orderId}/orderItems; return list of item dicts."""
    path = ORDER_ITEMS_PATH_TEMPLATE.format(order_id=amazon_order_id)
    resp = client.request("GET", path)
    if resp.status_code != 200:
        return []
    data = resp.json()
    payload = data.get("payload") if isinstance(data, dict) else {}
    if not isinstance(payload, dict):
        return []
    items = payload.get("OrderItems")
    return items if isinstance(items, list) else []


SOURCE_SPAPI = "spapi"


def _bridge_to_order_items(
    db: Session,
    connection: AmazonConnection,
    amazon_order_id: str,
    marketplace_id: str,
    order_date: date,
    items: list[dict[str, Any]],
) -> None:
    """Upsert internal order_items from amazon order items; idempotent on source='spapi' + source_order_item_id (Amazon OrderItemId)."""
    code = _sp_api_marketplace_id_to_code(connection, marketplace_id)
    if not code:
        return
    mkt = _get_or_create_marketplace_by_code(db, code)
    if not mkt:
        return
    order_id_str = amazon_order_id[:100] if len(amazon_order_id) > 100 else amazon_order_id
    for item in items:
        order_item_id = (item.get("OrderItemId") or "").strip()
        if not order_item_id:
            continue
        sku = (item.get("SellerSKU") or "").strip()
        if not sku:
            continue
        qty = item.get("QuantityOrdered")
        if qty is not None and not isinstance(qty, int):
            try:
                qty = int(qty)
            except (ValueError, TypeError):
                qty = 0
        if qty is None:
            qty = 0
        revenue = _item_price_amount(item)
        if revenue is None:
            revenue = Decimal("0")
        product = _get_or_create_product_by_sku(
            db,
            sku,
            str(item.get("ASIN")).strip() if item.get("ASIN") else None,
            (item.get("Title") or "—")[:500],
        )
        if not product:
            continue
        existing = db.scalar(
            select(OrderItem).where(
                OrderItem.source == SOURCE_SPAPI,
                OrderItem.source_order_item_id == order_item_id,
            )
        )
        if existing:
            existing.order_id = order_id_str
            existing.order_date = order_date
            existing.marketplace_id = mkt.id
            existing.sku = product.sku
            existing.units = qty
            existing.revenue = float(revenue)
        else:
            db.add(
                OrderItem(
                    order_id=order_id_str,
                    order_date=order_date,
                    marketplace_id=mkt.id,
                    sku=product.sku,
                    units=qty,
                    revenue=float(revenue),
                    source=SOURCE_SPAPI,
                    source_order_item_id=order_item_id,
                )
            )
        db.flush()


ITEMS_SYNC_PARTIAL_WARNING = "Some orders failed item sync; see logs"


def run_order_items_sync(
    db: Session,
    connection: AmazonConnection,
    refresh_token: str,
) -> tuple[int, int]:
    """
    For orders in last ORDER_ITEMS_LOOKBACK_DAYS, fetch items from SP-API, upsert amazon_order_item, bridge to order_items.
    Returns (items_count, orders_failed_count). Caller must commit.
    Logs items_sync_start, items_sync_order, items_sync_success, items_sync_failure.
    """
    cutoff = datetime.now(timezone.utc) - timedelta(days=ORDER_ITEMS_LOOKBACK_DAYS)
    orders = db.execute(
        select(AmazonOrder)
        .where(AmazonOrder.purchase_date.isnot(None), AmazonOrder.purchase_date >= cutoff)
        .order_by(AmazonOrder.id)
    ).scalars().all()
    if not orders:
        logger.info("items_sync_start", extra={"connection_id": connection.id, "orders_count": 0})
        logger.info("items_sync_success", extra={"connection_id": connection.id})
        return (0, 0)

    logger.info(
        "items_sync_start",
        extra={"connection_id": connection.id, "orders_count": len(orders)},
    )
    client = SpApiClient(refresh_token=refresh_token)
    items_count = 0
    orders_failed = 0
    for order in orders:
        amazon_order_id = order.amazon_order_id
        marketplace_id = order.marketplace_id
        order_date = order.purchase_date.date() if order.purchase_date else date.today()
        try:
            items = _fetch_order_items(client, amazon_order_id)
        except Exception as e:
            orders_failed += 1
            logger.warning(
                "items_sync_order",
                extra={
                    "connection_id": connection.id,
                    "amazon_order_id": amazon_order_id,
                    "error_summary": str(e)[:200],
                },
            )
            continue
        logger.info(
            "items_sync_order",
            extra={
                "connection_id": connection.id,
                "amazon_order_id": amazon_order_id,
                "items_count": len(items),
            },
        )
        for item in items:
            if isinstance(item, dict):
                _upsert_amazon_order_item(db, item, amazon_order_id, marketplace_id)
        _bridge_to_order_items(db, connection, amazon_order_id, marketplace_id, order_date, items)
        items_count += len(items)
    logger.info(
        "items_sync_success",
        extra={"connection_id": connection.id, "items_count": items_count, "orders_failed": orders_failed},
    )
    return (items_count, orders_failed)


def run_orders_sync(
    db: Session,
    connection: AmazonConnection,
    dry_run: bool = False,
    include_items: bool = False,
) -> None:
    """
    Run orders sync for the given connection.

    - Computes last_updated_after (last_orders_sync_at - 10 min, or now - 30 days if never synced).
    - Sets last_orders_sync_status to running at start.
    - dry_run=True: no SP-API; status ok, cursor unchanged.
    - dry_run=False: load credential, decrypt token, call SP-API GET /orders/v0/orders,
      paginate via NextToken, upsert amazon_order; advance cursor to max LastUpdateDate - overlap.
    - When include_items=True and dry_run=False: after orders sync, run_order_items_sync (fetch items, upsert amazon_order_item, bridge to order_items).
    - On success: status ok; last_orders_sync_at = max_last_update - overlap (if any orders), else unchanged.
    - On failure: status error + trimmed last_orders_sync_error (500 chars).
    - Caller must commit the session.
    """
    connection_id = connection.id
    last_updated_after = _compute_last_updated_after(connection)

    logger.info(
        "orders_sync_start",
        extra={
            "connection_id": connection_id,
            "dry_run": dry_run,
            "last_updated_after": last_updated_after.isoformat(),
        },
    )

    connection.last_orders_sync_status = STATUS_RUNNING
    connection.last_orders_sync_error = None
    db.flush()

    try:
        if dry_run:
            now = datetime.now(timezone.utc)
            connection.last_orders_sync_status = STATUS_OK
            connection.last_orders_sync_error = None
            connection.updated_at = now
            db.flush()
            logger.info(
                "orders_sync_success",
                extra={"connection_id": connection_id, "dry_run": True},
            )
            return

        marketplace_ids = _get_marketplace_ids(connection)
        if not marketplace_ids:
            err = "No marketplaces configured (set marketplaces_json on connection)."
            connection.last_orders_sync_status = STATUS_ERROR
            connection.last_orders_sync_error = err[:MAX_ERROR_LEN]
            connection.updated_at = datetime.now(timezone.utc)
            db.flush()
            logger.warning("orders_sync_failure", extra={"connection_id": connection_id, "error_summary": err[:200]})
            raise RuntimeError(err)

        cred = _get_credential_for_connection(db, connection.id)
        if cred is None or not cred.has_refresh_token:
            err = "Missing credential or refresh token (save credential with token first)."
            connection.last_orders_sync_status = STATUS_ERROR
            connection.last_orders_sync_error = err[:MAX_ERROR_LEN]
            connection.updated_at = datetime.now(timezone.utc)
            db.flush()
            logger.warning("orders_sync_failure", extra={"connection_id": connection_id, "error_summary": err[:200]})
            raise RuntimeError(err)

        try:
            decrypted = decrypt_token(cred.lwa_refresh_token_encrypted or "")
        except TokenEncryptionError as e:
            err = str(e)[:MAX_ERROR_LEN]
            connection.last_orders_sync_status = STATUS_ERROR
            connection.last_orders_sync_error = err
            connection.updated_at = datetime.now(timezone.utc)
            db.flush()
            logger.warning("orders_sync_failure", extra={"connection_id": connection_id, "error_summary": err[:200]})
            raise

        max_last_update, orders_count = _fetch_and_upsert_orders(
            db, connection, decrypted, last_updated_after, marketplace_ids
        )
        connection.last_orders_sync_orders_count = orders_count
        connection.last_orders_sync_items_count = None

        if include_items:
            try:
                items_count, orders_failed = run_order_items_sync(db, connection, decrypted)
                connection.last_orders_sync_items_count = items_count
                if orders_failed > 0:
                    connection.last_orders_sync_status = STATUS_ERROR
                    connection.last_orders_sync_error = ITEMS_SYNC_PARTIAL_WARNING[:MAX_ERROR_LEN]
                    connection.updated_at = datetime.now(timezone.utc)
                    db.flush()
                    logger.warning(
                        "orders_sync_success_partial_items",
                        extra={
                            "connection_id": connection_id,
                            "orders_count": orders_count,
                            "items_count": items_count,
                            "orders_failed": orders_failed,
                        },
                    )
                    return
            except Exception as e:
                connection.last_orders_sync_status = STATUS_ERROR
                connection.last_orders_sync_error = "Order items sync failed."[:MAX_ERROR_LEN]
                connection.updated_at = datetime.now(timezone.utc)
                if max_last_update is not None:
                    connection.last_orders_sync_at = max_last_update - timedelta(minutes=CURSOR_OVERLAP_MINUTES)
                db.flush()
                logger.warning(
                    "items_sync_failure",
                    extra={"connection_id": connection_id, "error_summary": str(e)[:200]},
                )
                return  # do not re-raise; keep safe message on connection

        now = datetime.now(timezone.utc)
        connection.last_orders_sync_status = STATUS_OK
        connection.last_orders_sync_error = None
        connection.updated_at = now
        if max_last_update is not None:
            connection.last_orders_sync_at = max_last_update - timedelta(minutes=CURSOR_OVERLAP_MINUTES)
        db.flush()

        logger.info(
            "orders_sync_success",
            extra={
                "connection_id": connection_id,
                "dry_run": False,
                "include_items": include_items,
                "orders_count": orders_count,
                "items_count": connection.last_orders_sync_items_count,
                "max_last_update": max_last_update.isoformat() if max_last_update else None,
            },
        )
    except Exception as e:
        err_msg = str(e)[:MAX_ERROR_LEN]
        connection.last_orders_sync_status = STATUS_ERROR
        connection.last_orders_sync_error = err_msg
        connection.updated_at = datetime.now(timezone.utc)
        db.flush()
        logger.warning(
            "orders_sync_failure",
            extra={
                "connection_id": connection_id,
                "dry_run": dry_run,
                "error_summary": err_msg[:200],
            },
        )
        raise
