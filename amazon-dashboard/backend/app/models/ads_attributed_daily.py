"""Sprint 14: Ads attributed daily performance for SKU-level profitability."""
from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import BigInteger, Date, DateTime, Integer, Numeric, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class AdsAttributedDaily(Base):
    """Daily attributed performance per Ads entity and ASIN/SKU for profitability analysis.

    Stores attributed sales, conversions, ad spend, impressions, clicks at the
    campaign/ad-group/target/ASIN level for a given date and marketplace.
    """

    __tablename__ = "ads_attributed_daily"
    __table_args__ = (
        UniqueConstraint(
            "profile_id",
            "date",
            "campaign_id_external",
            "ad_group_id_external",
            "target_id_external",
            "asin",
            name="uq_ads_attributed_daily_key",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True, autoincrement=True)
    profile_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    marketplace_code: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    date: Mapped[date] = mapped_column(Date, nullable=False, index=True)

    # Ads entity identifiers (external IDs from Amazon Ads)
    campaign_id_external: Mapped[str | None] = mapped_column(String(255), nullable=True)
    ad_group_id_external: Mapped[str | None] = mapped_column(String(255), nullable=True)
    entity_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    target_id_external: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # ASIN/SKU mapping
    asin: Mapped[str | None] = mapped_column(String(20), nullable=True, index=True)
    sku: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)

    # Attributed performance metrics
    attributed_sales: Mapped[Decimal] = mapped_column(
        Numeric(14, 2), nullable=False, default=Decimal("0")
    )
    attributed_conversions: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    attributed_units: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    attributed_orders: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    # Ad spend and engagement
    ad_spend: Mapped[Decimal] = mapped_column(
        Numeric(14, 2), nullable=False, default=Decimal("0")
    )
    impressions: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0)
    clicks: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0)

    # Timestamps
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
