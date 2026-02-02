"""
SP-API FBA Inventory integration (Phase 11.2).

Calls getInventorySummaries with pagination; normalizes to amazon_inventory_item fields.
"""

from app.integrations.amazon_spapi.inventory.inventory_client import (
    fetch_all_inventory_summaries,
    normalize_inventory_summary,
)

__all__ = ["fetch_all_inventory_summaries", "normalize_inventory_summary"]
