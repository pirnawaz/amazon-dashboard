"""Forecast override and forecast run models. Sprint 15."""
from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, Numeric, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class ForecastOverride(Base):
    """Owner-controlled manual overrides: absolute units/day or multiplier over a date range."""

    __tablename__ = "forecast_override"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True, autoincrement=True)
    sku: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    marketplace_code: Mapped[str | None] = mapped_column(String(20), nullable=True, index=True)
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date] = mapped_column(Date, nullable=False)
    override_type: Mapped[str] = mapped_column(String(32), nullable=False)
    value: Mapped[Decimal] = mapped_column(Numeric(14, 4), nullable=False)
    reason: Mapped[str | None] = mapped_column(String(512), nullable=True)
    created_by_user_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    created_by_email: Mapped[str | None] = mapped_column(String(320), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class ForecastRun(Base):
    """Minimal metadata for a forecast run (model version, metrics, drift flag)."""

    __tablename__ = "forecast_run"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True, autoincrement=True)
    sku: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    marketplace_code: Mapped[str | None] = mapped_column(String(20), nullable=True, index=True)
    model_version: Mapped[str] = mapped_column(String(64), nullable=False)
    data_end_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    horizon_days: Mapped[int] = mapped_column(Integer, nullable=False)
    mae_30d: Mapped[Decimal | None] = mapped_column(Numeric(14, 4), nullable=True)
    mape_30d: Mapped[Decimal | None] = mapped_column(Numeric(14, 4), nullable=True)
    drift_flag: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
