"""Sprint 14: SKU cost (COGS) table for profitability calculations."""
from __future__ import annotations

from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, Integer, Numeric, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class SkuCost(Base):
    """Per-SKU cost of goods sold (COGS) for profitability analysis.

    If marketplace_code is NULL, the cost applies globally to all marketplaces.
    Otherwise, it applies only to the specified marketplace.
    """

    __tablename__ = "sku_cost"
    __table_args__ = (
        UniqueConstraint("sku", "marketplace_code", name="uq_sku_cost_sku_marketplace"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True, autoincrement=True)
    sku: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    marketplace_code: Mapped[str | None] = mapped_column(String(20), nullable=True, index=True)
    unit_cost: Mapped[Decimal] = mapped_column(Numeric(12, 4), nullable=False)
    currency: Mapped[str | None] = mapped_column(String(10), nullable=True)

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
