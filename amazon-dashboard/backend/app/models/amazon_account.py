"""Sprint 18: Amazon account (multi-account groundwork). One row per logical Amazon account."""
from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, DateTime, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class AmazonAccount(Base):
    """Friendly label for an Amazon account; integrations (SP-API, Ads) link to this."""

    __tablename__ = "amazon_account"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true")
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

    # Optional: relationships to connections/ads when needed
    # amazon_connections: Mapped[list["AmazonConnection"]] = relationship(...)
    # ads_accounts: Mapped[list["AdsAccount"]] = relationship(...)
