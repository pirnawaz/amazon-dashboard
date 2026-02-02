"""
SP-API FBA Inventory client (Phase 11.2).

Calls GET /fba/inventory/v1/summaries with pagination.
Normalizes response to marketplace_id, seller_sku, fn_sku, asin, quantity_available,
quantity_reserved, raw_payload. Safe logging (no tokens or secrets).
"""
from __future__ import annotations

import logging
from typing import Any

from app.integrations.amazon_spapi import SpApiClient, SpApiClientError

logger = logging.getLogger(__name__)

FBA_INVENTORY_SUMMARIES_PATH = "/fba/inventory/v1/summaries"
GRANULARITY_TYPE = "Marketplace"


def _safe_int(value: Any) -> int | None:
    """Coerce to int or return None. Do not guess."""
    if value is None:
        return None
    if isinstance(value, int):
        return value
    try:
        return int(value)
    except (ValueError, TypeError):
        return None


def _safe_str(value: Any) -> str | None:
    """Coerce to non-empty string or return None."""
    if value is None:
        return None
    s = str(value).strip()
    return s if s else None


def normalize_inventory_summary(
    raw: dict[str, Any],
    marketplace_id: str,
) -> dict[str, Any] | None:
    """
    Normalize one FBA inventory summary to amazon_inventory_item shape.

    Extracts: marketplace_id, seller_sku (required), fn_sku, asin, quantity_available,
    quantity_reserved, raw_payload. If seller_sku is missing, returns None.
    Maps fulfillable/available/totalQuantity -> quantity_available; reserved/pending -> quantity_reserved.
    """
    seller_sku = (
        _safe_str(raw.get("sellerSku"))
        or _safe_str(raw.get("seller_sku"))
    )
    if not seller_sku:
        return None

    fn_sku = _safe_str(raw.get("fnSku")) or _safe_str(raw.get("fn_sku"))
    asin = _safe_str(raw.get("asin")) or _safe_str(raw.get("ASIN"))

    # quantity_available: fulfillableQuantity, availableQuantity, totalQuantity, or similar
    quantity_available = (
        _safe_int(raw.get("fulfillableQuantity"))
        if raw.get("fulfillableQuantity") is not None
        else _safe_int(raw.get("fulfillable"))
    )
    if quantity_available is None:
        quantity_available = _safe_int(raw.get("availableQuantity")) or _safe_int(raw.get("available"))
    if quantity_available is None:
        quantity_available = _safe_int(raw.get("totalQuantity")) or _safe_int(raw.get("total"))

    # quantity_reserved: totalReservedQuantity, reservedQuantity, pendingQuantity, or similar
    quantity_reserved = (
        _safe_int(raw.get("totalReservedQuantity"))
        if raw.get("totalReservedQuantity") is not None
        else _safe_int(raw.get("reservedQuantity"))
    )
    if quantity_reserved is None:
        quantity_reserved = _safe_int(raw.get("reserved")) or _safe_int(raw.get("pendingQuantity")) or _safe_int(raw.get("pending"))

    return {
        "marketplace_id": marketplace_id,
        "seller_sku": seller_sku,
        "fn_sku": fn_sku,
        "asin": asin,
        "quantity_available": quantity_available,
        "quantity_reserved": quantity_reserved,
        "raw_payload": raw,
    }


def _fetch_page(
    client: SpApiClient,
    marketplace_id: str,
    details: bool = True,
    next_token: str | None = None,
) -> tuple[list[dict[str, Any]], str | None]:
    """
    Call getInventorySummaries for one page. Returns (list of raw summary dicts, nextToken or None).
    """
    params: dict[str, Any] = {
        "marketplaceIds": marketplace_id,
        "granularityType": GRANULARITY_TYPE,
        "granularityId": marketplace_id,
        "details": "true" if details else "false",
    }
    if next_token:
        params["nextToken"] = next_token

    resp = client.request("GET", FBA_INVENTORY_SUMMARIES_PATH, params=params)
    if resp.status_code != 200:
        raise SpApiClientError(
            f"FBA Inventory API returned {resp.status_code}",
            method="GET",
            path=FBA_INVENTORY_SUMMARIES_PATH,
            status_code=resp.status_code,
            response_body=resp.text[:2000] if resp.text else None,
        )

    data = resp.json()
    payload = data.get("payload") if isinstance(data, dict) else {}
    if not isinstance(payload, dict):
        payload = {}

    summaries = payload.get("inventorySummaries")
    if not isinstance(summaries, list):
        summaries = []

    next_token_out = payload.get("nextToken")
    if not isinstance(next_token_out, str) or not next_token_out.strip():
        next_token_out = None

    logger.info(
        "fba_inventory_page",
        extra={
            "marketplace_id": marketplace_id,
            "count": len(summaries),
            "has_next": next_token_out is not None,
        },
    )
    return (summaries, next_token_out)


def fetch_all_inventory_summaries(
    client: SpApiClient,
    marketplace_ids: list[str],
    details: bool = True,
) -> list[dict[str, Any]]:
    """
    Fetch all FBA inventory summaries for the given marketplace IDs with pagination.

    Calls getInventorySummaries per marketplace, follows nextToken until done.
    Returns list of normalized items: {marketplace_id, seller_sku, fn_sku, asin,
    quantity_available, quantity_reserved, raw_payload}. Skips rows without seller_sku.
    """
    result: list[dict[str, Any]] = []
    for marketplace_id in marketplace_ids:
        mid = str(marketplace_id).strip()
        if not mid:
            continue
        next_token: str | None = None
        page = 0
        while True:
            page += 1
            raw_list, next_token = _fetch_page(
                client,
                mid,
                details=details,
                next_token=next_token,
            )
            for raw in raw_list:
                if not isinstance(raw, dict):
                    continue
                item = normalize_inventory_summary(raw, mid)
                if item is not None:
                    result.append(item)
            if not next_token:
                break
    return result
