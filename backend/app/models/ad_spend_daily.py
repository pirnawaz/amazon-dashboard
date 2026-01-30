from __future__ import annotations

from datetime import date

from sqlalchemy import Date, ForeignKey, Integer, Numeric
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class AdSpendDaily(Base):
    __tablename__ = "ad_spend_daily"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    date: Mapped[date] = mapped_column(Date, index=True, nullable=False)
    marketplace_id: Mapped[int] = mapped_column(ForeignKey("marketplaces.id"), nullable=False)
    spend: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
