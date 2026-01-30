from __future__ import annotations

from datetime import date

from sqlalchemy import Date, ForeignKey, Integer, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class OrderItem(Base):
    __tablename__ = "order_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    order_id: Mapped[str] = mapped_column(String(100), index=True, nullable=False)
    order_date: Mapped[date] = mapped_column(Date, index=True, nullable=False)
    marketplace_id: Mapped[int] = mapped_column(ForeignKey("marketplaces.id"), nullable=False)
    sku: Mapped[str] = mapped_column(ForeignKey("products.sku"), nullable=False)
    units: Mapped[int] = mapped_column(Integer, nullable=False)
    revenue: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
