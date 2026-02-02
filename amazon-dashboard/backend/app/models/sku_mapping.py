"""Phase 12.1: SKU mapping (sku + marketplace_code -> product, status) for catalog visibility."""
from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class SkuMapping(Base):
    """Maps (sku, marketplace_code) to internal product and status. Uniqueness on (sku, marketplace_code)."""

    __tablename__ = "sku_mappings"
    __table_args__ = (
        UniqueConstraint("sku", "marketplace_code", name="uq_sku_mappings_sku_marketplace_code"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True, autoincrement=True)
    sku: Mapped[str] = mapped_column(String(255), nullable=False)
    marketplace_code: Mapped[str] = mapped_column(String(20), nullable=False)
    asin: Mapped[str | None] = mapped_column(String(20), nullable=True)
    fnsku: Mapped[str | None] = mapped_column(String(255), nullable=True)
    product_id: Mapped[int | None] = mapped_column(
        ForeignKey("products.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="pending", index=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
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

    product: Mapped["Product | None"] = relationship("Product", backref="sku_mappings")
