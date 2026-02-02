"""Alert events and alert settings (Phase 7B)."""
from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, DateTime, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class AlertEvent(Base):
    """Generated alert event (restock, stale, order-by passed)."""

    __tablename__ = "alert_events"
    __table_args__ = ({"comment": "Alert events for inventory/restock notifications"},)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    alert_type: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    severity: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    sku: Mapped[str | None] = mapped_column(String(100), nullable=True, index=True)
    marketplace: Mapped[str | None] = mapped_column(String(20), nullable=True, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    dedupe_key: Mapped[str] = mapped_column(String(255), nullable=False, unique=True, index=True)
    is_acknowledged: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    acknowledged_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class AlertSettings(Base):
    """Single row (id=1) for alert/email settings."""

    __tablename__ = "alert_settings"
    __table_args__ = ({"comment": "Alert and email notification settings (single row id=1)"},)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    email_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    email_recipients: Mapped[str | None] = mapped_column(Text, nullable=True)
    send_inventory_stale: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    send_urgent_restock: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    send_reorder_soon: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    send_order_by_passed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    stale_days_threshold: Mapped[int] = mapped_column(Integer, nullable=False, default=7)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


ALERT_SETTINGS_ID = 1
