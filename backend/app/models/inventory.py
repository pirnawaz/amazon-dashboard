"""Inventory levels: manual (or later Amazon) stock per SKU per marketplace."""
from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, Integer, Numeric, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class InventoryLevel(Base):
    """Per-SKU, per-marketplace inventory (on-hand, reserved, source)."""

    __tablename__ = "inventory_levels"
    __table_args__ = (
        UniqueConstraint("sku", "marketplace", name="uq_inventory_levels_sku_marketplace"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    sku: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    marketplace: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    on_hand_units: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)
    reserved_units: Mapped[float | None] = mapped_column(Numeric(14, 2), nullable=True, default=0)
    source: Mapped[str] = mapped_column(String(50), nullable=False, default="manual")
    note: Mapped[str | None] = mapped_column(String(500), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    def available_units(self) -> float:
        """Computed: max(on_hand - reserved, 0)."""
        reserved = self.reserved_units or 0
        return max(float(self.on_hand_units) - float(reserved), 0.0)
