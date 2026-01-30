from __future__ import annotations

from datetime import date

from sqlalchemy import Date, ForeignKey, Integer
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class InventorySnapshot(Base):
    __tablename__ = "inventory_snapshots"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    date: Mapped[date] = mapped_column(Date, index=True, nullable=False)
    sku: Mapped[str] = mapped_column(ForeignKey("products.sku"), nullable=False)
    on_hand: Mapped[int] = mapped_column(Integer, nullable=False)
