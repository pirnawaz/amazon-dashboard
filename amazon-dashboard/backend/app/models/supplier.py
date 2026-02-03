"""Supplier and SKU supplier settings. Sprint 16."""
from __future__ import annotations

from datetime import datetime
from decimal import Decimal

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Supplier(Base):
    """Supplier master: name, contact, notes."""

    __tablename__ = "supplier"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    contact_email: Mapped[str | None] = mapped_column(String(320), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    settings: Mapped[list["SkuSupplierSetting"]] = relationship(
        "SkuSupplierSetting", back_populates="supplier", foreign_keys="SkuSupplierSetting.supplier_id"
    )


class SkuSupplierSetting(Base):
    """Per-SKU, per-marketplace (optional) supplier settings: lead time, MOQ, pack size, service level."""

    __tablename__ = "sku_supplier_setting"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True, autoincrement=True)
    sku: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    marketplace_code: Mapped[str | None] = mapped_column(String(20), nullable=True, index=True)
    supplier_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("supplier.id", ondelete="CASCADE"), nullable=False, index=True
    )
    lead_time_days_mean: Mapped[int] = mapped_column(Integer, nullable=False)
    lead_time_days_std: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    moq_units: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    pack_size_units: Mapped[int] = mapped_column(Integer, nullable=False, server_default="1")
    reorder_policy: Mapped[str] = mapped_column(String(32), nullable=False, server_default="min_max")
    min_days_of_cover: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    max_days_of_cover: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    service_level: Mapped[Decimal] = mapped_column(Numeric(5, 4), nullable=False, server_default="0.95")
    holding_cost_rate: Mapped[Decimal | None] = mapped_column(Numeric(14, 6), nullable=True)
    stockout_cost_per_unit: Mapped[Decimal | None] = mapped_column(Numeric(14, 4), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    supplier: Mapped["Supplier"] = relationship("Supplier", back_populates="settings")
