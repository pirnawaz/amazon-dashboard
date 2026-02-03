"""Restock recommendation snapshot. Sprint 16."""
from __future__ import annotations

from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, ForeignKey, Integer, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class RestockRecommendation(Base):
    """Persisted restock recommendation snapshot per generation run."""

    __tablename__ = "restock_recommendation"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True, autoincrement=True)
    generated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    sku: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    marketplace_code: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    supplier_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("supplier.id", ondelete="SET NULL"), nullable=True, index=True
    )
    on_hand_units: Mapped[Decimal] = mapped_column(Numeric(14, 4), nullable=False)
    inbound_units: Mapped[Decimal] = mapped_column(Numeric(14, 4), nullable=False)
    reserved_units: Mapped[Decimal] = mapped_column(Numeric(14, 4), nullable=False)
    available_units: Mapped[Decimal] = mapped_column(Numeric(14, 4), nullable=False)
    daily_demand_forecast: Mapped[Decimal] = mapped_column(Numeric(14, 4), nullable=False)
    lead_time_days_mean: Mapped[int] = mapped_column(Integer, nullable=False)
    lead_time_days_std: Mapped[int] = mapped_column(Integer, nullable=False)
    safety_stock_units: Mapped[Decimal] = mapped_column(Numeric(14, 4), nullable=False)
    reorder_point_units: Mapped[Decimal] = mapped_column(Numeric(14, 4), nullable=False)
    target_stock_units: Mapped[Decimal] = mapped_column(Numeric(14, 4), nullable=False)
    recommended_order_units: Mapped[Decimal] = mapped_column(Numeric(14, 4), nullable=False)
    recommended_order_units_rounded: Mapped[Decimal] = mapped_column(Numeric(14, 4), nullable=False)
    priority_score: Mapped[Decimal] = mapped_column(Numeric(14, 4), nullable=False)
    reason_flags: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by_user_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    created_by_email: Mapped[str | None] = mapped_column(String(320), nullable=True)
