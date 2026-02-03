"""Amazon Ads API models (Sprint 13): account, profiles, campaigns, ad groups, targets/keywords, daily metrics."""
from __future__ import annotations

from datetime import date, datetime
from typing import TYPE_CHECKING

from sqlalchemy import BigInteger, Date, DateTime, ForeignKey, Index, Integer, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.marketplace import Marketplace


class AdsAccount(Base):
    """Single app-level Amazon Ads account (OAuth refresh token stored encrypted)."""

    __tablename__ = "ads_account"

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
    status: Mapped[str] = mapped_column(String(50), nullable=False, server_default="pending")
    refresh_token_encrypted: Mapped[str | None] = mapped_column(Text, nullable=True)
    last_sync_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_sync_status: Mapped[str | None] = mapped_column(String(50), nullable=True)
    last_sync_error: Mapped[str | None] = mapped_column(Text, nullable=True)

    profiles: Mapped[list["AdsProfile"]] = relationship(
        "AdsProfile",
        back_populates="account",
        cascade="all, delete-orphan",
    )

    __table_args__ = (Index("ix_ads_account_status", "status"),)

    @property
    def has_refresh_token(self) -> bool:
        return bool(self.refresh_token_encrypted and self.refresh_token_encrypted.strip())


class AdsProfile(Base):
    """Advertiser profile (Amazon Ads API profile) per marketplace."""

    __tablename__ = "ads_profile"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    ads_account_id: Mapped[int] = mapped_column(
        ForeignKey("ads_account.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    profile_id: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    marketplace_id: Mapped[int | None] = mapped_column(
        ForeignKey("marketplaces.id", ondelete="SET NULL"),
        nullable=True,
    )
    name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    profile_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
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

    account: Mapped["AdsAccount"] = relationship("AdsAccount", back_populates="profiles")
    marketplace: Mapped["Marketplace | None"] = relationship(
        "Marketplace", foreign_keys=[marketplace_id]
    )
    campaigns: Mapped[list["AdsCampaign"]] = relationship(
        "AdsCampaign",
        back_populates="profile",
        cascade="all, delete-orphan",
    )
    daily_metrics: Mapped[list["AdsDailyMetrics"]] = relationship(
        "AdsDailyMetrics",
        back_populates="profile",
        cascade="all, delete-orphan",
    )
    attributed_daily: Mapped[list["AdsAttributedDaily"]] = relationship(
        "AdsAttributedDaily",
        back_populates="profile",
        cascade="all, delete-orphan",
    )


class AdsCampaign(Base):
    """Campaign under an ads profile."""

    __tablename__ = "ads_campaign"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    ads_profile_id: Mapped[int] = mapped_column(
        ForeignKey("ads_profile.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    campaign_id_external: Mapped[str] = mapped_column(String(64), nullable=False)
    name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    state: Mapped[str | None] = mapped_column(String(50), nullable=True)
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

    profile: Mapped["AdsProfile"] = relationship("AdsProfile", back_populates="campaigns")
    ad_groups: Mapped[list["AdsAdGroup"]] = relationship(
        "AdsAdGroup",
        back_populates="campaign",
        cascade="all, delete-orphan",
    )

    __table_args__ = (Index("ix_ads_campaign_ads_profile_id", "ads_profile_id"),)


class AdsAdGroup(Base):
    """Ad group under a campaign."""

    __tablename__ = "ads_ad_group"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    ads_campaign_id: Mapped[int] = mapped_column(
        ForeignKey("ads_campaign.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    ad_group_id_external: Mapped[str] = mapped_column(String(64), nullable=False)
    name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    state: Mapped[str | None] = mapped_column(String(50), nullable=True)
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

    campaign: Mapped["AdsCampaign"] = relationship("AdsCampaign", back_populates="ad_groups")
    targets_keywords: Mapped[list["AdsTargetKeyword"]] = relationship(
        "AdsTargetKeyword",
        back_populates="ad_group",
        cascade="all, delete-orphan",
    )


class AdsTargetKeyword(Base):
    """Target or keyword under an ad group (entity_type: 'keyword' or 'target')."""

    __tablename__ = "ads_target_keyword"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    ads_ad_group_id: Mapped[int] = mapped_column(
        ForeignKey("ads_ad_group.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    target_id_external: Mapped[str] = mapped_column(String(64), nullable=False)
    entity_type: Mapped[str] = mapped_column(String(32), nullable=False, server_default="keyword")
    text: Mapped[str | None] = mapped_column(String(512), nullable=True)
    state: Mapped[str | None] = mapped_column(String(50), nullable=True)
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

    ad_group: Mapped["AdsAdGroup"] = relationship("AdsAdGroup", back_populates="targets_keywords")


class AdsDailyMetrics(Base):
    """Daily metrics per ads profile (spend, sales, impressions, clicks)."""

    __tablename__ = "ads_daily_metrics"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    ads_profile_id: Mapped[int] = mapped_column(
        ForeignKey("ads_profile.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    spend: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, server_default="0")
    sales: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, server_default="0")
    impressions: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    clicks: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    profile: Mapped["AdsProfile"] = relationship("AdsProfile", back_populates="daily_metrics")

    __table_args__ = (
        Index("ix_ads_daily_metrics_ads_profile_id", "ads_profile_id"),
        Index("ix_ads_daily_metrics_date", "date"),
    )


class AdsAttributedDaily(Base):
    """Daily attributed performance per Ads entity and ASIN/SKU (Sprint 14)."""

    __tablename__ = "ads_attributed_daily"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    ads_profile_id: Mapped[int] = mapped_column(
        ForeignKey("ads_profile.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    marketplace_id: Mapped[str | None] = mapped_column(String(32), nullable=True)
    marketplace_code: Mapped[str | None] = mapped_column(String(20), nullable=True, index=True)
    date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    campaign_id_external: Mapped[str | None] = mapped_column(String(64), nullable=True)
    ad_group_id_external: Mapped[str | None] = mapped_column(String(64), nullable=True)
    entity_type: Mapped[str | None] = mapped_column(String(32), nullable=True)
    target_id_external: Mapped[str | None] = mapped_column(String(64), nullable=True)
    asin: Mapped[str | None] = mapped_column(String(32), nullable=True, index=True)
    sku: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    attributed_sales: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, server_default="0")
    attributed_conversions: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, server_default="0")
    attributed_units: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, server_default="0")
    attributed_orders: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, server_default="0")
    ad_spend: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, server_default="0")
    impressions: Mapped[int] = mapped_column(BigInteger, nullable=False, server_default="0")
    clicks: Mapped[int] = mapped_column(BigInteger, nullable=False, server_default="0")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    profile: Mapped["AdsProfile"] = relationship("AdsProfile", back_populates="attributed_daily")

    __table_args__ = (
        Index("ix_ads_attributed_daily_ads_profile_id", "ads_profile_id"),
        Index("ix_ads_attributed_daily_date", "date"),
        Index("ix_ads_attributed_daily_sku", "sku"),
        Index("ix_ads_attributed_daily_asin", "asin"),
        Index("ix_ads_attributed_daily_marketplace_code", "marketplace_code"),
    )
