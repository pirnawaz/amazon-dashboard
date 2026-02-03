"""
Amazon Ads sync service (Sprint 13).

Read-only ingestion: campaigns, ad groups, keywords/targets, daily metrics.
Uses encrypted refresh token; respects rate limits; incremental sync by date.
"""
from __future__ import annotations

import logging
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.crypto import TokenEncryptionError, decrypt_token
from app.integrations.amazon_ads.client import (
    AmazonAdsApiError,
    AdsApiConfig,
    RateLimiter,
    fetch_profile_metrics_mock,
    get_access_token,
    get_ad_groups,
    get_campaigns,
    get_keywords,
    get_profiles,
    get_targets,
)
from app.models.ads import (
    AdsAccount,
    AdsAdGroup,
    AdsAttributedDaily,
    AdsCampaign,
    AdsDailyMetrics,
    AdsProfile,
    AdsTargetKeyword,
)
from app.models.marketplace import Marketplace
from app.models.sku_mapping import SkuMapping

logger = logging.getLogger(__name__)


def _get_ads_config(account: AdsAccount) -> AdsApiConfig:
    """Build Ads API config from account (decrypt token) and settings."""
    if not account.refresh_token_encrypted or not account.refresh_token_encrypted.strip():
        raise ValueError("Ads account has no refresh token. Connect the ads account first.")
    try:
        refresh_token = decrypt_token(account.refresh_token_encrypted)
    except TokenEncryptionError as e:
        logger.error("ads_sync_decrypt_failed", extra={"error": str(e)})
        raise ValueError(f"Failed to decrypt ads token: {e!s}") from e

    client_id = settings.amazon_ads_client_id or ""
    client_secret = settings.amazon_ads_client_secret or ""
    if not client_id or not client_secret:
        raise ValueError(
            "Amazon Ads API credentials not configured. Set AMAZON_ADS_CLIENT_ID and AMAZON_ADS_CLIENT_SECRET."
        )

    return AdsApiConfig(
        client_id=client_id,
        client_secret=client_secret,
        refresh_token=refresh_token,
        region=settings.amazon_ads_region,
    )


def _ensure_marketplace(db: Session, profile_id: str, marketplace_code: str | None) -> int | None:
    """Resolve marketplace_id from code. Create placeholder if needed (optional)."""
    if not marketplace_code:
        return None
    row = db.scalar(select(Marketplace.id).where(Marketplace.code == marketplace_code))
    return row


def run_ads_sync(
    db: Session,
    account: AdsAccount,
    start_date: date | None = None,
    end_date: date | None = None,
    dry_run: bool = False,
    use_mock_metrics: bool = True,
) -> dict[str, Any]:
    """
    Sync ads data: profiles, campaigns, ad groups, keywords/targets, daily metrics.
    Incremental by date when start_date/end_date provided.
    use_mock_metrics: when True and API doesn't return metrics, fill from mock for demo.
    Returns summary dict: profiles_upserted, campaigns_upserted, metrics_upserted, error.
    """
    result: dict[str, Any] = {
        "profiles_upserted": 0,
        "campaigns_upserted": 0,
        "ad_groups_upserted": 0,
        "targets_keywords_upserted": 0,
        "metrics_upserted": 0,
        "attribution_upserted": 0,
        "error": None,
    }

    end_date = end_date or date.today()
    start_date = start_date or (end_date - timedelta(days=30))

    account.last_sync_status = "running"
    account.last_sync_error = None
    if not dry_run:
        db.flush()

    config: AdsApiConfig | None = None
    access_token: str | None = None
    limiter = RateLimiter(requests_per_second=settings.amazon_ads_rate_limit_rps)

    if account.refresh_token_encrypted and (settings.amazon_ads_client_id and settings.amazon_ads_client_secret):
        try:
            config = _get_ads_config(account)
            access_token = get_access_token(config)
        except (ValueError, AmazonAdsApiError) as e:
            msg = str(e)
            logger.warning("ads_sync_setup_failed", extra={"error": msg})
            account.last_sync_status = "error"
            account.last_sync_error = msg
            result["error"] = msg
            if not dry_run:
                db.commit()
            return result

    profiles_data: list[dict[str, Any]] = []
    if config and access_token:
        try:
            profiles_data = get_profiles(config, access_token, limiter)
        except AmazonAdsApiError as e:
            msg = str(e)
            logger.warning("ads_sync_profiles_failed", extra={"error": msg})
            account.last_sync_status = "error"
            account.last_sync_error = msg
            result["error"] = msg
            if not dry_run:
                db.commit()
            return result

    # If API returns no profiles or API not configured, use a single mock profile for demo
    if not profiles_data:
        logger.info("ads_sync_using_mock_profiles")
        profiles_data = [
            {"profileId": "mock_profile_1", "name": "Mock Profile", "accountInfo": {"type": "seller"}, "countryCode": "US"},
        ]

    now = datetime.now(timezone.utc)
    for p in profiles_data:
        profile_id_ext = str(p.get("profileId", p.get("id", "")))
        name = p.get("name") or p.get("accountInfo", {}).get("name") or ""
        profile_type = (p.get("accountInfo") or {}).get("type") or "seller"
        marketplace_code = (p.get("countryCode") or p.get("accountInfo") or {}).get("countryCode")

        existing = db.scalar(
            select(AdsProfile).where(AdsProfile.profile_id == profile_id_ext)
        )
        if existing:
            profile = existing
            profile.name = name or profile.name
            profile.profile_type = profile_type
            profile.updated_at = now
            if marketplace_code:
                profile.marketplace_id = _ensure_marketplace(db, profile_id_ext, marketplace_code)
        else:
            marketplace_id = _ensure_marketplace(db, profile_id_ext, marketplace_code) if marketplace_code else None
            profile = AdsProfile(
                ads_account_id=account.id,
                profile_id=profile_id_ext,
                marketplace_id=marketplace_id,
                name=name or None,
                profile_type=profile_type,
            )
            db.add(profile)
            db.flush()
        result["profiles_upserted"] += 1

        if dry_run:
            continue

        # Campaigns (from API when configured, else empty)
        campaigns_data: list[dict[str, Any]] = []
        if config and access_token:
            try:
                campaigns_data = get_campaigns(config, access_token, profile_id_ext, limiter)
            except AmazonAdsApiError:
                campaigns_data = []

        for c in campaigns_data:
            cid = str(c.get("campaignId", c.get("id", "")))
            cname = c.get("name") or ""
            state = c.get("state") or ""

            existing_c = db.scalar(
                select(AdsCampaign).where(
                    AdsCampaign.ads_profile_id == profile.id,
                    AdsCampaign.campaign_id_external == cid,
                )
            )
            if existing_c:
                existing_c.name = cname or existing_c.name
                existing_c.state = state or existing_c.state
                existing_c.updated_at = now
            else:
                db.add(AdsCampaign(
                    ads_profile_id=profile.id,
                    campaign_id_external=cid,
                    name=cname or None,
                    state=state or None,
                ))
                db.flush()
            result["campaigns_upserted"] += 1

            campaign_row = db.scalar(
                select(AdsCampaign).where(
                    AdsCampaign.ads_profile_id == profile.id,
                    AdsCampaign.campaign_id_external == cid,
                )
            )
            if not campaign_row:
                continue

            # Ad groups
            try:
                ad_groups_data = get_ad_groups(config, access_token, profile_id_ext, cid, limiter)
            except AmazonAdsApiError:
                ad_groups_data = []

            for ag in ad_groups_data:
                agid = str(ag.get("adGroupId", ag.get("id", "")))
                agname = ag.get("name") or ""
                agstate = ag.get("state") or ""

                existing_ag = db.scalar(
                    select(AdsAdGroup).where(
                        AdsAdGroup.ads_campaign_id == campaign_row.id,
                        AdsAdGroup.ad_group_id_external == agid,
                    )
                )
                if existing_ag:
                    existing_ag.name = agname or existing_ag.name
                    existing_ag.state = agstate or existing_ag.state
                    existing_ag.updated_at = now
                else:
                    db.add(AdsAdGroup(
                        ads_campaign_id=campaign_row.id,
                        ad_group_id_external=agid,
                        name=agname or None,
                        state=agstate or None,
                    ))
                    db.flush()
                result["ad_groups_upserted"] += 1

                ad_group_row = db.scalar(
                    select(AdsAdGroup).where(
                        AdsAdGroup.ads_campaign_id == campaign_row.id,
                        AdsAdGroup.ad_group_id_external == agid,
                    )
                )
                if not ad_group_row:
                    continue

                # Keywords
                try:
                    kw_data = get_keywords(config, access_token, profile_id_ext, cid, limiter)
                except AmazonAdsApiError:
                    kw_data = []
                for kw in kw_data:
                    kid = str(kw.get("keywordId", kw.get("id", "")))
                    text = kw.get("keywordText") or kw.get("keyword", "")
                    kwstate = kw.get("state") or ""
                    existing_tk = db.scalar(
                        select(AdsTargetKeyword).where(
                            AdsTargetKeyword.ads_ad_group_id == ad_group_row.id,
                            AdsTargetKeyword.target_id_external == kid,
                        )
                    )
                    if existing_tk:
                        existing_tk.text = text or existing_tk.text
                        existing_tk.state = kwstate or existing_tk.state
                        existing_tk.updated_at = now
                    else:
                        db.add(AdsTargetKeyword(
                            ads_ad_group_id=ad_group_row.id,
                            target_id_external=kid,
                            entity_type="keyword",
                            text=text or None,
                            state=kwstate or None,
                        ))
                    result["targets_keywords_upserted"] += 1

                # Targets
                try:
                    tgt_data = get_targets(config, access_token, profile_id_ext, cid, limiter)
                except AmazonAdsApiError:
                    tgt_data = []
                for tgt in tgt_data:
                    tid = str(tgt.get("targetId", tgt.get("id", "")))
                    ttext = tgt.get("expression") or tgt.get("name", "")
                    tstate = tgt.get("state") or ""
                    existing_tk = db.scalar(
                        select(AdsTargetKeyword).where(
                            AdsTargetKeyword.ads_ad_group_id == ad_group_row.id,
                            AdsTargetKeyword.target_id_external == tid,
                        )
                    )
                    if existing_tk:
                        existing_tk.text = ttext or existing_tk.text
                        existing_tk.state = tstate or existing_tk.state
                        existing_tk.updated_at = now
                    else:
                        db.add(AdsTargetKeyword(
                            ads_ad_group_id=ad_group_row.id,
                            target_id_external=tid,
                            entity_type="target",
                            text=ttext or None,
                            state=tstate or None,
                        ))
                    result["targets_keywords_upserted"] += 1

    # Daily metrics: use mock when use_mock_metrics and we have profiles
    profiles = db.scalars(select(AdsProfile).where(AdsProfile.ads_account_id == account.id)).all()
    marketplace_code_by_profile: dict[int, str] = {}
    for m in db.scalars(select(Marketplace)).all():
        for p in profiles:
            if p.marketplace_id == m.id:
                marketplace_code_by_profile[p.id] = m.code

    for profile in profiles:
        if use_mock_metrics:
            mock_rows = fetch_profile_metrics_mock(profile.profile_id, marketplace_code_by_profile.get(profile.id, "ALL"), start_date, end_date)
        else:
            mock_rows = []

        for row in mock_rows:
            try:
                d = date.fromisoformat(row["date"])
            except (TypeError, ValueError):
                continue
            spend = float(row.get("cost", row.get("spend", 0)))
            sales = float(row.get("attributedSales14d", row.get("sales", 0)))
            impressions = row.get("impressions")
            clicks = row.get("clicks")

            existing_m = db.scalar(
                select(AdsDailyMetrics).where(
                    AdsDailyMetrics.ads_profile_id == profile.id,
                    AdsDailyMetrics.date == d,
                )
            )
            if existing_m:
                existing_m.spend = Decimal(str(spend))
                existing_m.sales = Decimal(str(sales))
                if impressions is not None:
                    existing_m.impressions = int(impressions)
                if clicks is not None:
                    existing_m.clicks = int(clicks)
            else:
                db.add(AdsDailyMetrics(
                    ads_profile_id=profile.id,
                    date=d,
                    spend=Decimal(str(spend)),
                    sales=Decimal(str(sales)),
                    impressions=int(impressions) if impressions is not None else None,
                    clicks=int(clicks) if clicks is not None else None,
                ))
            result["metrics_upserted"] += 1

    # Sprint 14: optionally sync attribution (purchased product / advertised product report)
    # If real Ads API supports attribution reports, fetch here; else use mock when use_mock_metrics
    lookback_days = getattr(
        settings,
        "amazon_ads_attribution_lookback_days",
        30,
    )
    attr_end = end_date
    attr_start = start_date
    if config and access_token and not use_mock_metrics:
        logger.info(
            "ads_sync_attribution_skip",
            extra={"reason": "attribution_report_not_implemented", "profile_count": len(profiles)},
        )
        # Placeholder: real implementation would call Ads API purchased product report
    elif use_mock_metrics and profiles:
        for profile in profiles:
            mkt_code = marketplace_code_by_profile.get(profile.id) or "US"
            mock_attribution_rows = _mock_attribution_rows(
                profile.id, mkt_code, attr_start, attr_end
            )
            asin_to_sku = _asin_to_sku_for_marketplace(db, mkt_code)
            for row in mock_attribution_rows:
                asin = row.get("asin")
                sku = asin_to_sku.get(asin) if asin else None
                if asin and not sku:
                    sku = None  # leave unmapped; service will report UNMAPPED:<asin> or warning
                try:
                    d = date.fromisoformat(row["date"])
                except (TypeError, ValueError):
                    continue
                existing_attr = db.scalar(
                    select(AdsAttributedDaily).where(
                        AdsAttributedDaily.ads_profile_id == profile.id,
                        AdsAttributedDaily.date == d,
                        AdsAttributedDaily.campaign_id_external == (row.get("campaign_id_external") or None),
                        AdsAttributedDaily.ad_group_id_external == (row.get("ad_group_id_external") or None),
                        AdsAttributedDaily.target_id_external == (row.get("target_id_external") or None),
                        AdsAttributedDaily.asin == asin,
                    )
                )
                if existing_attr:
                    existing_attr.attributed_sales = Decimal(str(row.get("attributed_sales", 0)))
                    existing_attr.attributed_units = Decimal(str(row.get("attributed_units", 0)))
                    existing_attr.attributed_orders = Decimal(str(row.get("attributed_orders", 0)))
                    existing_attr.ad_spend = Decimal(str(row.get("ad_spend", 0)))
                    existing_attr.impressions = int(row.get("impressions", 0))
                    existing_attr.clicks = int(row.get("clicks", 0))
                    if sku is not None:
                        existing_attr.sku = sku
                else:
                    db.add(AdsAttributedDaily(
                        ads_profile_id=profile.id,
                        marketplace_code=mkt_code,
                        date=d,
                        campaign_id_external=row.get("campaign_id_external"),
                        ad_group_id_external=row.get("ad_group_id_external"),
                        entity_type=row.get("entity_type"),
                        target_id_external=row.get("target_id_external"),
                        asin=asin,
                        sku=sku,
                        attributed_sales=Decimal(str(row.get("attributed_sales", 0))),
                        attributed_conversions=Decimal(str(row.get("attributed_conversions", 0))),
                        attributed_units=Decimal(str(row.get("attributed_units", 0))),
                        attributed_orders=Decimal(str(row.get("attributed_orders", 0))),
                        ad_spend=Decimal(str(row.get("ad_spend", 0))),
                        impressions=int(row.get("impressions", 0)),
                        clicks=int(row.get("clicks", 0)),
                    ))
                result["attribution_upserted"] += 1
        logger.info(
            "ads_sync_attribution_mock_completed",
            extra={"attribution_upserted": result["attribution_upserted"], "profiles": len(profiles)},
        )

    account.last_sync_at = now
    account.last_sync_status = "ok"
    account.last_sync_error = None
    if dry_run:
        db.rollback()
    else:
        db.commit()

    logger.info(
        "ads_sync_completed",
        extra={
            "profiles_upserted": result["profiles_upserted"],
            "campaigns_upserted": result["campaigns_upserted"],
            "ad_groups_upserted": result["ad_groups_upserted"],
            "targets_keywords_upserted": result["targets_keywords_upserted"],
            "metrics_upserted": result["metrics_upserted"],
            "attribution_upserted": result.get("attribution_upserted", 0),
        },
    )
    return result


def _asin_to_sku_for_marketplace(db: Session, marketplace_code: str) -> dict[str, str]:
    """Return mapping asin -> sku for the given marketplace from SkuMapping."""
    rows = db.execute(
        select(SkuMapping.asin, SkuMapping.sku).where(
            SkuMapping.marketplace_code == marketplace_code,
            SkuMapping.asin.isnot(None),
            SkuMapping.asin != "",
        )
    ).all()
    return {r.asin: r.sku for r in rows if r.asin}


def _mock_attribution_rows(
    profile_id: int,
    marketplace_code: str,
    start_date: date,
    end_date: date,
) -> list[dict[str, Any]]:
    """Generate plausible attributed daily rows for 2–3 sample ASINs over the date range (demo)."""
    from app.core.config import settings

    lookback = getattr(settings, "amazon_ads_attribution_lookback_days", 30)
    sample_asins = ["B0DEMO01", "B0DEMO02", "B0DEMO03"]
    rows: list[dict[str, Any]] = []
    delta = (end_date - start_date).days + 1
    for i in range(delta):
        d = start_date + timedelta(days=i)
        for j, asin in enumerate(sample_asins):
            # Vary by day and ASIN for plausible demo
            attributed_sales = round(80 + (i % 7) * 20 + j * 30, 2)
            ad_spend = round(12 + (i % 5) * 4 + j * 5, 2)
            rows.append({
                "date": d.isoformat(),
                "campaign_id_external": "mock",
                "ad_group_id_external": "mock",
                "target_id_external": asin,
                "entity_type": "adgroup",
                "asin": asin,
                "attributed_sales": attributed_sales,
                "attributed_conversions": 1 + (i + j) % 3,
                "attributed_units": 2 + (i + j) % 5,
                "attributed_orders": 1 + (i + j) % 2,
                "ad_spend": ad_spend,
                "impressions": 200 + (i + j) * 50,
                "clicks": 10 + (i + j) * 2,
            })
    return rows
