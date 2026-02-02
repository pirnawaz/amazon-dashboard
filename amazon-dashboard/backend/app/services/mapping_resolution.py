"""Phase 12.2: Resolve order-item SKU + marketplace to mapping classification for demand/forecast."""
from __future__ import annotations

from typing import Literal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.marketplace import Marketplace
from app.models.sku_mapping import SkuMapping
from app.schemas.sku_mapping import (
    SKU_MAPPING_STATUS_CONFIRMED,
    SKU_MAPPING_STATUS_DISCONTINUED,
    SKU_MAPPING_STATUS_IGNORED,
    SKU_MAPPING_STATUS_PENDING,
)

Classification = Literal[
    "mapped_confirmed",
    "mapped_ignored",
    "mapped_discontinued",
    "unmapped_or_pending",
]


def get_mapping_map(
    db: Session,
    marketplace_codes: list[str] | None = None,
) -> dict[tuple[str, str], SkuMapping]:
    """
    Load all relevant sku_mappings (optionally filtered by marketplace codes) into a dict.
    Key: (sku, marketplace_code).
    """
    stmt = select(SkuMapping)
    if marketplace_codes:
        stmt = stmt.where(SkuMapping.marketplace_code.in_(marketplace_codes))
    rows = db.execute(stmt).scalars().all()
    return {(r.sku, r.marketplace_code): r for r in rows}


def classify_sku(
    db: Session,
    sku: str,
    marketplace_code: str,
) -> tuple[Classification, SkuMapping | None]:
    """
    Classify (sku, marketplace_code) using sku_mappings.
    pending counts as unmapped_or_pending.
    Returns (classification, mapping_or_none).
    """
    mapping = db.scalar(
        select(SkuMapping).where(
            SkuMapping.sku == sku,
            SkuMapping.marketplace_code == marketplace_code,
        )
    )
    if mapping is None:
        return ("unmapped_or_pending", None)
    if mapping.status == SKU_MAPPING_STATUS_CONFIRMED:
        return ("mapped_confirmed", mapping)
    if mapping.status == SKU_MAPPING_STATUS_IGNORED:
        return ("mapped_ignored", mapping)
    if mapping.status == SKU_MAPPING_STATUS_DISCONTINUED:
        return ("mapped_discontinued", mapping)
    # pending or any other
    return ("unmapped_or_pending", mapping)


def should_include_sku(
    classification: Classification,
    *,
    include_unmapped: bool = False,
    include_pending: bool = False,
) -> bool:
    """
    Whether to include this SKU in demand/forecast series.
    Default: include only mapped_confirmed.
    include_unmapped / include_pending: when True, also include unmapped_or_pending.
    ignored and discontinued are never included.
    """
    if classification == "mapped_confirmed":
        return True
    if classification in ("mapped_ignored", "mapped_discontinued"):
        return False
    # unmapped_or_pending
    return include_unmapped or include_pending
