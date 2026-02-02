from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Marketplace(Base):
    __tablename__ = "marketplaces"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    code: Mapped[str] = mapped_column(String(10), unique=True, index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    currency: Mapped[str | None] = mapped_column(String(10), nullable=True, comment="NULL when created from sync without mapping")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    order_items: Mapped[list["OrderItem"]] = relationship(
        "OrderItem", foreign_keys="OrderItem.marketplace_id"
    )
    ad_spend_daily: Mapped[list["AdSpendDaily"]] = relationship(
        "AdSpendDaily", foreign_keys="AdSpendDaily.marketplace_id"
    )
