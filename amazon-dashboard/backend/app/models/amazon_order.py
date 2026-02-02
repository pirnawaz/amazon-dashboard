"""Amazon SP-API order (Phase 10.3). Single table for orders; order items later."""
from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import DateTime, Index, Integer, Numeric, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class AmazonOrder(Base):
    """SP-API order row; idempotent on (amazon_order_id, marketplace_id)."""

    __tablename__ = "amazon_order"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    amazon_order_id: Mapped[str] = mapped_column(Text, nullable=False, index=True)
    marketplace_id: Mapped[str] = mapped_column(Text, nullable=False, index=True)
    purchase_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_update_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    order_status: Mapped[str | None] = mapped_column(Text, nullable=True)
    order_total_amount: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), nullable=True)
    order_total_currency: Mapped[str | None] = mapped_column(Text, nullable=True)
    raw_payload: Mapped[dict[str, Any] | None] = mapped_column(
        JSONB(astext_type=Text()),
        nullable=True,
        comment="Debug payload; no secrets.",
    )

    __table_args__ = (
        UniqueConstraint("amazon_order_id", "marketplace_id", name="uq_amazon_order_amazon_order_id_marketplace_id"),
        Index("ix_amazon_order_amazon_order_id", "amazon_order_id"),
        Index("ix_amazon_order_marketplace_id", "marketplace_id"),
        Index("ix_amazon_order_last_update_date", "last_update_date"),
    )
