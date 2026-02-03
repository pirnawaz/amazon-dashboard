"""Amazon SP-API connection tracking (single-tenant, extensible to multi-marketplace)."""
from __future__ import annotations

import enum
from datetime import datetime
from typing import Any

from sqlalchemy import DateTime, ForeignKey, Index, Integer, Text, func
from sqlalchemy.dialects.postgresql import ENUM, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class ConnectionStatus(str, enum.Enum):
    PENDING = "pending"
    ACTIVE = "active"
    ERROR = "error"
    DISCONNECTED = "disconnected"


class AmazonConnection(Base):
    """Single app-level SP-API connection (one row = one seller account)."""

    __tablename__ = "amazon_connection"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    amazon_account_id: Mapped[int | None] = mapped_column(
        ForeignKey("amazon_account.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
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
    status: Mapped[ConnectionStatus] = mapped_column(
        ENUM(
            "pending",
            "active",
            "error",
            "disconnected",
            name="connection_status",
            create_type=False,
        ),
        nullable=False,
        server_default="pending",
    )
    last_success_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    last_error_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    last_error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    marketplaces_json: Mapped[dict[str, Any] | None] = mapped_column(
        JSONB(astext_type=Text()),
        nullable=True,
        comment="List/dict of marketplace IDs for future multi-marketplace.",
    )
    seller_identifier: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        index=True,
        comment="Seller ID or merchant identifier from SP-API.",
    )
    last_check_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="When SP-API ping was last run.",
    )
    last_check_ok: Mapped[bool | None] = mapped_column(
        nullable=True,
        comment="True if last ping succeeded, False if failed.",
    )
    last_check_error: Mapped[str | None] = mapped_column(Text, nullable=True, comment="Last ping error message if failed.")
    last_orders_sync_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="When orders sync was last completed successfully.",
    )
    last_orders_sync_status: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        comment="running | ok | error",
    )
    last_orders_sync_error: Mapped[str | None] = mapped_column(Text, nullable=True, comment="Last orders sync error if failed.")
    last_orders_sync_orders_count: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
        comment="Orders synced in last run.",
    )
    last_orders_sync_items_count: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
        comment="Order items synced in last run.",
    )
    last_inventory_sync_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="When inventory sync last completed successfully.",
    )
    last_inventory_sync_status: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        server_default="never",
        comment="never | running | ok | error",
    )
    last_inventory_sync_error: Mapped[str | None] = mapped_column(
        Text, nullable=True, comment="Last inventory sync error if failed."
    )
    last_inventory_sync_items_count: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
        comment="Inventory items upserted in last run.",
    )

    credentials: Mapped[list["AmazonCredential"]] = relationship(
        "AmazonCredential",
        back_populates="connection",
        foreign_keys="AmazonCredential.connection_id",
        cascade="all, delete-orphan",
    )

    __table_args__ = (
        Index("ix_amazon_connection_status", "status"),
        Index("ix_amazon_connection_updated_at", "updated_at"),
    )


class AmazonCredential(Base):
    """LWA refresh token and metadata per connection (one credential row per connection in single-tenant)."""

    __tablename__ = "amazon_credential"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
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
    connection_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("amazon_connection.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    lwa_refresh_token_encrypted: Mapped[str | None] = mapped_column(Text, nullable=True)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)

    @property
    def has_refresh_token(self) -> bool:
        """True if a refresh token (ciphertext) is stored. Does not decrypt."""
        return bool(
            self.lwa_refresh_token_encrypted
            and self.lwa_refresh_token_encrypted.strip()
        )

    connection: Mapped["AmazonConnection"] = relationship(
        "AmazonConnection",
        back_populates="credentials",
        foreign_keys=[connection_id],
    )

    __table_args__ = (Index("ix_amazon_credential_updated_at", "updated_at"),)
