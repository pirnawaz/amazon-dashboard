"""Amazon Ads API routes (Sprint 13 + Sprint 14 attribution). Connect account, list profiles, trigger sync, dashboard summary, timeseries, SKU profitability."""
from __future__ import annotations

import logging
from datetime import date, timedelta
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps.account_context import resolve_amazon_account_id
from app.api.deps.permissions import require_can_trigger_sync, require_not_viewer
from app.api.routes.ads_deps import require_owner_for_connect
from app.api.routes.me import get_current_user
from app.core.crypto import TokenEncryptionError, encrypt_token
from app.db.session import get_db
from app.models.ads import AdsAccount, AdsDailyMetrics, AdsProfile
from app.models.marketplace import Marketplace
from app.models.sku_cost import SkuCost
from app.models.user import User
from app.schemas.ads import (
    AdsAccountConnectRequest,
    AdsAccountResponse,
    AdsDashboardSummary,
    AdsProfileResponse,
    AdsSyncTriggerResponse,
    AdsTimeseriesPoint,
    AdsTimeseriesResponse,
)
from app.schemas.ads_attribution import (
    SkuCostCreate,
    SkuCostResponse,
    SkuProfitabilityResponse,
    SkuProfitabilityRow,
    SkuTimeseriesPoint,
    SkuTimeseriesResponse,
)
from app.services.amazon_ads_sync import run_ads_sync
from app.services.ads_attribution import (
    get_sku_profitability,
    get_sku_profitability_timeseries,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ads", tags=["ads"])


def _get_or_create_ads_account(db: Session, amazon_account_id: int | None = None) -> AdsAccount:
    """Return ads account for account; when amazon_account_id omitted, first row (backward compatible)."""
    q = select(AdsAccount).order_by(AdsAccount.id).limit(1)
    if amazon_account_id is not None:
        q = q.where(AdsAccount.amazon_account_id == amazon_account_id)
    acc = db.scalar(q)
    if acc is not None:
        return acc
    acc = AdsAccount(status="pending", amazon_account_id=amazon_account_id)
    db.add(acc)
    db.flush()
    return acc


@router.put("/account/connect", response_model=AdsAccountResponse)
def connect_ads_account(
    body: AdsAccountConnectRequest,
    user: User = Depends(require_owner_for_connect),
    db: Session = Depends(get_db),
    amazon_account_id: int | None = Depends(resolve_amazon_account_id),
) -> AdsAccountResponse:
    """Connect Amazon Ads account: store refresh token (encrypted at rest). Owner only. Respects X-Amazon-Account-Id."""
    logger.info("ads_connect_request", extra={"user_id": user.id})
    acc = _get_or_create_ads_account(db, amazon_account_id)
    try:
        acc.refresh_token_encrypted = encrypt_token(body.refresh_token.strip())
    except TokenEncryptionError as e:
        logger.warning("ads_connect_encrypt_failed", extra={"error": str(e)})
        raise HTTPException(status_code=503, detail=str(e)) from e
    acc.status = "active"
    acc.last_sync_error = None
    db.commit()
    db.refresh(acc)
    return AdsAccountResponse(
        id=acc.id,
        created_at=acc.created_at,
        updated_at=acc.updated_at,
        status=acc.status,
        has_refresh_token=acc.has_refresh_token,
        last_sync_at=acc.last_sync_at,
        last_sync_status=acc.last_sync_status,
        last_sync_error=acc.last_sync_error,
    )


@router.get("/account", response_model=AdsAccountResponse | None)
def get_ads_account(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    amazon_account_id: int | None = Depends(resolve_amazon_account_id),
) -> AdsAccountResponse | None:
    """Return the ads account or null (no token returned). Respects X-Amazon-Account-Id."""
    q = select(AdsAccount).order_by(AdsAccount.id).limit(1)
    if amazon_account_id is not None:
        q = q.where(AdsAccount.amazon_account_id == amazon_account_id)
    acc = db.scalar(q)
    if acc is None:
        return None
    return AdsAccountResponse(
        id=acc.id,
        created_at=acc.created_at,
        updated_at=acc.updated_at,
        status=acc.status,
        has_refresh_token=acc.has_refresh_token,
        last_sync_at=acc.last_sync_at,
        last_sync_status=acc.last_sync_status,
        last_sync_error=acc.last_sync_error,
    )


@router.get("/profiles", response_model=list[AdsProfileResponse])
def list_ads_profiles(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[AdsProfileResponse]:
    """List ads profiles (advertiser profiles per marketplace)."""
    profiles = db.scalars(
        select(AdsProfile).order_by(AdsProfile.id)
    ).all()
    marketplaces = {m.id: m.code for m in db.scalars(select(Marketplace)).all()}
    return [
        AdsProfileResponse(
            id=p.id,
            ads_account_id=p.ads_account_id,
            profile_id=p.profile_id,
            marketplace_id=p.marketplace_id,
            marketplace_code=marketplaces.get(p.marketplace_id) if p.marketplace_id else None,
            name=p.name,
            profile_type=p.profile_type,
            created_at=p.created_at,
            updated_at=p.updated_at,
        )
        for p in profiles
    ]


@router.post("/sync", response_model=AdsSyncTriggerResponse)
def trigger_ads_sync(
    user: User = Depends(require_can_trigger_sync),
    db: Session = Depends(get_db),
    amazon_account_id: int | None = Depends(resolve_amazon_account_id),
) -> AdsSyncTriggerResponse:
    """Trigger ads data sync. Owner and partner may trigger; viewer cannot. Respects X-Amazon-Account-Id."""
    logger.info("ads_sync_trigger", extra={"user_id": user.id})
    acc = _get_or_create_ads_account(db, amazon_account_id)
    db.commit()
    db.refresh(acc)
    result = run_ads_sync(db, acc, use_mock_metrics=True)
    if result.get("error"):
        return AdsSyncTriggerResponse(
            ok=False,
            message="Sync completed with errors.",
            profiles_upserted=result.get("profiles_upserted", 0),
            campaigns_upserted=result.get("campaigns_upserted", 0),
            ad_groups_upserted=result.get("ad_groups_upserted", 0),
            targets_keywords_upserted=result.get("targets_keywords_upserted", 0),
            metrics_upserted=result.get("metrics_upserted", 0),
            attribution_upserted=result.get("attribution_upserted", 0),
            error=result["error"],
        )
    return AdsSyncTriggerResponse(
        ok=True,
        message="Sync completed.",
        profiles_upserted=result.get("profiles_upserted", 0),
        campaigns_upserted=result.get("campaigns_upserted", 0),
        ad_groups_upserted=result.get("ad_groups_upserted", 0),
        targets_keywords_upserted=result.get("targets_keywords_upserted", 0),
        metrics_upserted=result.get("metrics_upserted", 0),
        attribution_upserted=result.get("attribution_upserted", 0),
    )


def _validate_marketplace(db: Session, marketplace: str) -> None:
    if marketplace == "ALL":
        return
    exists = db.scalar(select(Marketplace.id).where(Marketplace.code == marketplace))
    if not exists:
        raise HTTPException(status_code=400, detail=f"Marketplace code not found: {marketplace!r}")


@router.get("/dashboard/summary", response_model=AdsDashboardSummary)
def ads_dashboard_summary(
    days: int = Query(default=30, ge=1, le=365),
    marketplace: str = Query(default="ALL"),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AdsDashboardSummary:
    """Ads dashboard summary: spend, sales, ACOS, ROAS for the selected period and marketplace."""
    _validate_marketplace(db, marketplace)
    end_date = date.today()
    start_date = end_date - timedelta(days=days - 1)

    q = (
        select(
            func.coalesce(func.sum(AdsDailyMetrics.spend), 0).label("spend"),
            func.coalesce(func.sum(AdsDailyMetrics.sales), 0).label("sales"),
        )
        .select_from(AdsDailyMetrics)
        .join(AdsProfile, AdsDailyMetrics.ads_profile_id == AdsProfile.id)
        .where(AdsDailyMetrics.date >= start_date, AdsDailyMetrics.date <= end_date)
    )
    if marketplace != "ALL":
        q = q.join(Marketplace, AdsProfile.marketplace_id == Marketplace.id).where(
            Marketplace.code == marketplace
        )
    row = db.execute(q).one_or_none()
    if row is None:
        spend = Decimal("0")
        sales = Decimal("0")
    else:
        spend = Decimal(str(row.spend))
        sales = Decimal(str(row.sales))
    acos = (spend / sales * 100) if sales and sales > 0 else None
    roas = (sales / spend) if spend and spend > 0 else None

    return AdsDashboardSummary(
        spend=spend,
        sales=sales,
        acos=acos,
        roas=roas,
        marketplace=marketplace,
        days=days,
    )


@router.get("/dashboard/timeseries", response_model=AdsTimeseriesResponse)
def ads_dashboard_timeseries(
    days: int = Query(default=90, ge=1, le=365),
    marketplace: str = Query(default="ALL"),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AdsTimeseriesResponse:
    """Ads timeseries: spend, sales, ACOS, ROAS by date."""
    _validate_marketplace(db, marketplace)
    end_date = date.today()
    start_date = end_date - timedelta(days=days - 1)
    date_list = [start_date + timedelta(days=i) for i in range(days)]

    q = (
        select(
            AdsDailyMetrics.date,
            func.coalesce(func.sum(AdsDailyMetrics.spend), 0).label("spend"),
            func.coalesce(func.sum(AdsDailyMetrics.sales), 0).label("sales"),
        )
        .select_from(AdsDailyMetrics)
        .join(AdsProfile, AdsDailyMetrics.ads_profile_id == AdsProfile.id)
        .where(AdsDailyMetrics.date >= start_date, AdsDailyMetrics.date <= end_date)
        .group_by(AdsDailyMetrics.date)
    )
    if marketplace != "ALL":
        q = q.join(Marketplace, AdsProfile.marketplace_id == Marketplace.id).where(
            Marketplace.code == marketplace
        )
    rows = {r.date: r for r in db.execute(q).all()}

    points: list[AdsTimeseriesPoint] = []
    for d in date_list:
        r = rows.get(d)
        spend = float(r.spend) if r else 0.0
        sales = float(r.sales) if r else 0.0
        acos = (spend / sales * 100) if sales > 0 else None
        roas = (sales / spend) if spend > 0 else None
        points.append(AdsTimeseriesPoint(date=d, spend=spend, sales=sales, acos=acos, roas=roas))

    return AdsTimeseriesResponse(days=days, marketplace=marketplace, points=points)


# --- Sprint 14: Attribution & SKU profitability (any authenticated user can view) ---


@router.get("/attribution/sku-profitability", response_model=SkuProfitabilityResponse)
def get_attribution_sku_profitability(
    days: int = Query(default=30, ge=1, le=365),
    marketplace: str = Query(default="ALL"),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> SkuProfitabilityResponse:
    """SKU profitability: revenue, ad spend, attributed sales, COGS, net profit, ACOS/ROAS, warning_flags."""
    logger.info(
        "ads_attribution_sku_profitability_request",
        extra={"user_id": user.id, "days": days, "marketplace": marketplace},
    )
    _validate_marketplace(db, marketplace)
    rows = get_sku_profitability(db, days=days, marketplace=marketplace)
    schema_rows = [
        SkuProfitabilityRow(
            sku=r.sku,
            marketplace_code=r.marketplace_code,
            revenue=r.revenue,
            ad_spend=r.ad_spend,
            attributed_sales=r.attributed_sales,
            organic_sales=r.organic_sales,
            units_sold=r.units_sold,
            unit_cogs=r.unit_cogs,
            total_cogs=r.total_cogs,
            gross_profit=r.gross_profit,
            net_profit=r.net_profit,
            acos=r.acos,
            roas=r.roas,
            warning_flags=r.warning_flags,
        )
        for r in rows
    ]
    return SkuProfitabilityResponse(days=days, marketplace=marketplace, rows=schema_rows)


@router.get("/attribution/sku-timeseries", response_model=SkuTimeseriesResponse)
def get_attribution_sku_timeseries(
    sku: str = Query(..., min_length=1),
    days: int = Query(default=30, ge=1, le=365),
    marketplace: str = Query(default="ALL"),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> SkuTimeseriesResponse:
    """Timeseries for one SKU: date, revenue, ad_spend, attributed_sales, net_profit, units."""
    logger.info(
        "ads_attribution_sku_timeseries_request",
        extra={"user_id": user.id, "sku": sku, "days": days, "marketplace": marketplace},
    )
    _validate_marketplace(db, marketplace)
    points = get_sku_profitability_timeseries(db, sku=sku, days=days, marketplace=marketplace)
    schema_points = [
        SkuTimeseriesPoint(
            date=p.date,
            revenue=p.revenue,
            ad_spend=p.ad_spend,
            attributed_sales=p.attributed_sales,
            net_profit=p.net_profit,
            units=p.units,
        )
        for p in points
    ]
    return SkuTimeseriesResponse(sku=sku, days=days, marketplace=marketplace, points=schema_points)


# --- SKU cost (COGS) CRUD: owner-only for write, any auth for read ---


@router.get("/sku-cost", response_model=list[SkuCostResponse])
def list_sku_costs(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[SkuCostResponse]:
    """List all SKU costs (COGS)."""
    logger.info("ads_sku_cost_list", extra={"user_id": user.id})
    rows = db.scalars(select(SkuCost).order_by(SkuCost.sku, SkuCost.marketplace_code)).all()
    return [SkuCostResponse.model_validate(r) for r in rows]


@router.put("/sku-cost", response_model=SkuCostResponse)
def upsert_sku_cost(
    body: SkuCostCreate,
    user: User = Depends(require_not_viewer),
    db: Session = Depends(get_db),
) -> SkuCostResponse:
    """Create or update per-SKU cost (COGS). Owner only."""
    logger.info(
        "ads_sku_cost_upsert",
        extra={"user_id": user.id, "sku": body.sku, "marketplace_code": body.marketplace_code},
    )
    if body.marketplace_code is None:
        existing = db.scalar(
            select(SkuCost).where(SkuCost.sku == body.sku, SkuCost.marketplace_code.is_(None))
        )
    else:
        existing = db.scalar(
            select(SkuCost).where(
                SkuCost.sku == body.sku,
                SkuCost.marketplace_code == body.marketplace_code,
            )
        )
    if existing:
        existing.unit_cost = body.unit_cost
        existing.currency = body.currency
        db.commit()
        db.refresh(existing)
        return SkuCostResponse.model_validate(existing)
    new_row = SkuCost(
        sku=body.sku,
        marketplace_code=body.marketplace_code,
        unit_cost=body.unit_cost,
        currency=body.currency,
    )
    db.add(new_row)
    db.commit()
    db.refresh(new_row)
    return SkuCostResponse.model_validate(new_row)


@router.delete("/sku-cost/{sku}", status_code=204)
def delete_sku_cost(
    sku: str,
    marketplace_code: str | None = Query(default=None),
    user: User = Depends(require_not_viewer),
    db: Session = Depends(get_db),
) -> None:
    """Delete SKU cost for (sku, marketplace_code). marketplace_code=null means global. Owner only."""
    logger.info("ads_sku_cost_delete", extra={"user_id": user.id, "sku": sku, "marketplace_code": marketplace_code})
    q = select(SkuCost).where(SkuCost.sku == sku)
    if marketplace_code is None:
        q = q.where(SkuCost.marketplace_code.is_(None))
    else:
        q = q.where(SkuCost.marketplace_code == marketplace_code)
    row = db.scalar(q)
    if row:
        db.delete(row)
        db.commit()
