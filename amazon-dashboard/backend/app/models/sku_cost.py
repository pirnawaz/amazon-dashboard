"""Sprint 14: Per-SKU COGS (unit cost). marketplace_code NULL = global."""
from __future__ import annotations

from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, Numeric, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class SkuCost(Base):
    """Per-SKU unit cost (COGS). One row per (sku, marketplace_code); marketplace_code NULL = global."""

    __tablename__ = "sku_cost"

    id: Mapped[int] = mapped_column(primary_key=True, index=True, autoincrement=True)
    sku: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    marketplace_code: Mapped[str | None] = mapped_column(String(20), nullable=True, index=True)
    unit_cost: Mapped[Decimal] = mapped_column(Numeric(12, 4), nullable=False)
    currency: Mapped[str | None] = mapped_column(String(10), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
