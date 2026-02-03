"""Pydantic schemas for Amazon Ads API (Sprint 13)."""
from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, Field


class AdsAccountResponse(BaseModel):
    """Ads account as returned by API (no token)."""

    id: int
    created_at: datetime
    updated_at: datetime
    status: str
    has_refresh_token: bool
    last_sync_at: datetime | None
    last_sync_status: str | None
    last_sync_error: str | None

    model_config = {"from_attributes": True}


class AdsAccountConnectRequest(BaseModel):
    """Connect ads account: store refresh token (plaintext; encrypted at rest)."""

    refresh_token: str = Field(..., min_length=1, description="LWA refresh token for Amazon Ads")


class AdsProfileResponse(BaseModel):
    """Ads profile (advertiser profile) per marketplace."""

    id: int
    ads_account_id: int
    profile_id: str
    marketplace_id: int | None
    marketplace_code: str | None = None
    name: str | None
    profile_type: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class AdsSyncTriggerResponse(BaseModel):
    """Response after triggering ads sync."""

    ok: bool
    message: str
    profiles_upserted: int = 0
    campaigns_upserted: int = 0
    ad_groups_upserted: int = 0
    targets_keywords_upserted: int = 0
    metrics_upserted: int = 0
    attribution_upserted: int = 0
    error: str | None = None


class AdsDashboardSummary(BaseModel):
    """Ads dashboard summary: spend, sales, ACOS, ROAS per marketplace."""

    spend: Decimal
    sales: Decimal
    acos: Decimal | None = Field(None, description="ACOS = spend/sales * 100 when sales > 0")
    roas: Decimal | None = Field(None, description="ROAS = sales/spend when spend > 0")
    marketplace: str
    days: int


class AdsTimeseriesPoint(BaseModel):
    """Single day in ads timeseries."""

    date: date
    spend: float
    sales: float
    acos: float | None = None
    roas: float | None = None


class AdsTimeseriesResponse(BaseModel):
    """Ads timeseries by date."""

    days: int
    marketplace: str
    points: list[AdsTimeseriesPoint]
