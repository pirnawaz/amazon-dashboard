"""Amazon SP-API order item (Phase 10.4). Idempotent on (order_item_id, amazon_order_id, marketplace_id)."""
from __future__ import annotations

from decimal import Decimal
from typing import Any

from sqlalchemy import Integer, Numeric, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class AmazonOrderItem(Base):
    """SP-API order item row; idempotent on (order_item_id, amazon_order_id, marketplace_id)."""

    __tablename__ = "amazon_order_item"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    order_item_id: Mapped[str] = mapped_column(Text, nullable=False, index=True)
    amazon_order_id: Mapped[str] = mapped_column(Text, nullable=False, index=True)
    marketplace_id: Mapped[str] = mapped_column(Text, nullable=False, index=True)
    seller_sku: Mapped[str | None] = mapped_column(Text, nullable=True)
    asin: Mapped[str | None] = mapped_column(Text, nullable=True)
    quantity_ordered: Mapped[int | None] = mapped_column(Integer, nullable=True)
    item_price_amount: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), nullable=True)
    item_price_currency: Mapped[str | None] = mapped_column(Text, nullable=True)
    raw_payload: Mapped[dict[str, Any] | None] = mapped_column(
        JSONB(astext_type=Text()),
        nullable=True,
        comment="Debug payload; no secrets.",
    )

    __table_args__ = (
        UniqueConstraint(
            "order_item_id",
            "amazon_order_id",
            "marketplace_id",
            name="uq_aoi_order_item_amazon_order_mkt",
        ),
    )
