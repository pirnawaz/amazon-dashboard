"""Sprint 14: Ads attribution and SKU profitability API routes.

Provides endpoints for:
- SKU profitability table (revenue, ad spend, COGS, net profit, ACOS/ROAS)
- SKU timeseries (daily breakdown for a single SKU)
- SKU cost (COGS) CRUD operations
"""
from __future__ import annotations

import logging
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.api.deps.permissions import require_owner
from app.api.routes.me import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.ads_attribution import (
    SkuCostCreate,
    SkuCostListResponse,
    SkuCostResponse,
    SkuProfitabilityResponse,
    SkuProfitabilityRow,
    SkuTimeseriesPoint,
    SkuTimeseriesResponse,
)
from app.services.ads_attribution import (
    delete_sku_cost,
    get_sku_costs,
    get_sku_profitability,
    get_sku_profitability_timeseries,
    upsert_sku_cost,
)

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get(
    "/ads/attribution/sku-profitability",
    response_model=SkuProfitabilityResponse,
    summary="Get SKU profitability table",
    description="Returns profitability metrics per SKU: revenue, ad spend, COGS, net profit, ACOS/ROAS. "
    "Any authenticated user can view.",
)
def get_sku_profitability_endpoint(
    days: int = Query(default=30, ge=1, le=365, description="Lookback days"),
    marketplace: str = Query(default="ALL", description="Marketplace filter (ALL for all)"),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> SkuProfitabilityResponse:
    """Get SKU profitability data.

    Returns a table of SKU-level profitability metrics including:
    - Revenue (from orders)
    - Ad spend (from attribution data or proportionally allocated from totals)
    - Attributed sales (if attribution data available)
    - COGS (if cost data available)
    - Net profit, ACOS, ROAS
    - Warning flags for missing data
    """
    logger.info(
        "SKU profitability request",
        extra={
            "user_id": user.id,
            "days": days,
            "marketplace": marketplace,
        },
    )

    raw_items = get_sku_profitability(db, days=days, marketplace=marketplace)

    items = [SkuProfitabilityRow(**item) for item in raw_items]

    return SkuProfitabilityResponse(
        days=days,
        marketplace=marketplace,
        items=items,
    )


@router.get(
    "/ads/attribution/sku-timeseries",
    response_model=SkuTimeseriesResponse,
    summary="Get SKU timeseries",
    description="Returns daily profitability timeseries for a single SKU. "
    "Any authenticated user can view.",
)
def get_sku_timeseries_endpoint(
    sku: str = Query(..., min_length=1, description="SKU identifier"),
    days: int = Query(default=30, ge=1, le=365, description="Lookback days"),
    marketplace: str = Query(default="ALL", description="Marketplace filter (ALL for all)"),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> SkuTimeseriesResponse:
    """Get daily timeseries for a single SKU.

    Returns daily data points with:
    - Revenue
    - Ad spend (if attribution available)
    - Attributed sales (if attribution available)
    - Net profit (if COGS available)
    - Units sold
    """
    logger.info(
        "SKU timeseries request",
        extra={
            "user_id": user.id,
            "sku": sku,
            "days": days,
            "marketplace": marketplace,
        },
    )

    raw_points = get_sku_profitability_timeseries(
        db, sku=sku, days=days, marketplace=marketplace
    )

    points = [SkuTimeseriesPoint(**point) for point in raw_points]

    return SkuTimeseriesResponse(
        sku=sku,
        days=days,
        marketplace=marketplace,
        points=points,
    )


@router.get(
    "/ads/attribution/sku-costs",
    response_model=SkuCostListResponse,
    summary="List SKU costs (COGS)",
    description="Returns all SKU cost entries. Owner only.",
)
def list_sku_costs_endpoint(
    sku: str | None = Query(default=None, description="Filter by SKU"),
    marketplace: str | None = Query(default=None, description="Filter by marketplace"),
    user: User = Depends(require_owner),
    db: Session = Depends(get_db),
) -> SkuCostListResponse:
    """List SKU cost entries."""
    logger.info(
        "List SKU costs request",
        extra={
            "user_id": user.id,
            "sku": sku,
            "marketplace": marketplace,
        },
    )

    raw_items = get_sku_costs(db, sku=sku, marketplace_code=marketplace)
    items = [SkuCostResponse(**item) for item in raw_items]

    return SkuCostListResponse(items=items)


@router.post(
    "/ads/attribution/sku-costs",
    response_model=SkuCostResponse,
    summary="Create or update SKU cost (COGS)",
    description="Upserts a SKU cost entry. If (sku, marketplace_code) exists, it updates; "
    "otherwise it creates. Owner only.",
)
def upsert_sku_cost_endpoint(
    payload: SkuCostCreate,
    user: User = Depends(require_owner),
    db: Session = Depends(get_db),
) -> SkuCostResponse:
    """Create or update SKU cost entry."""
    logger.info(
        "Upsert SKU cost request",
        extra={
            "user_id": user.id,
            "sku": payload.sku,
            "marketplace_code": payload.marketplace_code,
            "unit_cost": str(payload.unit_cost),
        },
    )

    result = upsert_sku_cost(
        db,
        sku=payload.sku,
        unit_cost=payload.unit_cost,
        marketplace_code=payload.marketplace_code,
        currency=payload.currency,
    )
    db.commit()

    return SkuCostResponse(**result)


@router.delete(
    "/ads/attribution/sku-costs/{sku}",
    summary="Delete SKU cost (COGS)",
    description="Deletes a SKU cost entry. Owner only.",
)
def delete_sku_cost_endpoint(
    sku: str,
    marketplace: str | None = Query(default=None, description="Marketplace (null for global)"),
    user: User = Depends(require_owner),
    db: Session = Depends(get_db),
) -> dict:
    """Delete SKU cost entry."""
    logger.info(
        "Delete SKU cost request",
        extra={
            "user_id": user.id,
            "sku": sku,
            "marketplace": marketplace,
        },
    )

    deleted = delete_sku_cost(db, sku=sku, marketplace_code=marketplace)
    if not deleted:
        raise HTTPException(status_code=404, detail="SKU cost not found")

    db.commit()

    return {"status": "deleted", "sku": sku, "marketplace_code": marketplace}
