"""Amazon FBA inventory item (Phase 11.1). Idempotent on (marketplace_id, seller_sku)."""
from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlalchemy import DateTime, Index, Integer, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class AmazonInventoryItem(Base):
    """FBA inventory item row; idempotent on (marketplace_id, seller_sku)."""

    __tablename__ = "amazon_inventory_item"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
    marketplace_id: Mapped[str] = mapped_column(Text, nullable=False, index=True)
    seller_sku: Mapped[str] = mapped_column(Text, nullable=False, index=True)
    fn_sku: Mapped[str | None] = mapped_column(Text, nullable=True)
    asin: Mapped[str | None] = mapped_column(Text, nullable=True)
    quantity_available: Mapped[int | None] = mapped_column(Integer, nullable=True)
    quantity_reserved: Mapped[int | None] = mapped_column(Integer, nullable=True)
    raw_payload: Mapped[dict[str, Any] | None] = mapped_column(
        JSONB(astext_type=Text()),
        nullable=True,
        comment="Stub/SP-API payload; no secrets.",
    )

    __table_args__ = (
        UniqueConstraint(
            "marketplace_id",
            "seller_sku",
            name="uq_amazon_inventory_item_marketplace_id_seller_sku",
        ),
        Index("ix_amazon_inventory_item_marketplace_id", "marketplace_id"),
        Index("ix_amazon_inventory_item_seller_sku", "seller_sku"),
    )
