"""Phase 12.2: Admin Data Health API. Phase 12.4: unmapped trend."""
from __future__ import annotations

from datetime import date, timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy import case, cast, func, or_, select, Date
from sqlalchemy.orm import Session

from app.api.deps.permissions import require_owner
from app.db.session import get_db
from app.models.marketplace import Marketplace
from app.models.order_item import OrderItem
from app.models.sku_mapping import SkuMapping
from app.models.user import User
from app.schemas.data_health import (
    DataHealthSummary,
    TopUnmappedResponse,
    TopUnmappedSkuRow,
    UnmappedTrendResponse,
    UnmappedTrendRow,
)
from app.schemas.sku_mapping import SKU_MAPPING_STATUS_PENDING
from app.services.catalog_mapping import get_unmapped_skus
from app.services.timeseries import get_units_health_for_range

router = APIRouter()

DATA_HEALTH_DAYS = 30


@router.get("/admin/data-health/summary", response_model=DataHealthSummary)
def data_health_summary(
    marketplace_code: str | None = Query(default=None, description="Filter by marketplace"),
    user: User = Depends(require_owner),
    db: Session = Depends(get_db),
) -> DataHealthSummary:
    """Return unmapped SKU count, unmapped/total units in last 30 days, and shares."""
    end_date = date.today()
    start_date = end_date - timedelta(days=DATA_HEALTH_DAYS - 1)

    total_units, confirmed_units, unmapped_units, ignored_units, discontinued_units = get_units_health_for_range(
        db, start_date, end_date, marketplace_code
    )
    unmapped_share = (unmapped_units / total_units) if total_units else 0.0

    unmapped_skus_total, _ = get_unmapped_skus(db, marketplace_code=marketplace_code, limit=1, offset=0)

    return DataHealthSummary(
        unmapped_skus_total=unmapped_skus_total,
        unmapped_units_30d=unmapped_units,
        total_units_30d=total_units,
        unmapped_share_30d=round(unmapped_share, 4),
        ignored_units_30d=ignored_units,
        discontinued_units_30d=discontinued_units,
        window_start=start_date,
        window_end=end_date,
    )


@router.get("/admin/data-health/top-unmapped", response_model=TopUnmappedResponse)
def top_unmapped_skus(
    marketplace_code: str | None = Query(default=None),
    limit: int = Query(default=20, ge=1, le=100),
    user: User = Depends(require_owner),
    db: Session = Depends(get_db),
) -> TopUnmappedResponse:
    """Return top unmapped/pending (sku, marketplace) by units in last 30 days."""
    end_date = date.today()
    start_date = end_date - timedelta(days=DATA_HEALTH_DAYS - 1)

    unmapped_cond = or_(
        SkuMapping.id.is_(None),
        SkuMapping.status == SKU_MAPPING_STATUS_PENDING,
    )
    q = (
        select(
            Marketplace.code.label("marketplace_code"),
            OrderItem.sku,
            func.sum(OrderItem.units).label("units_30d"),
            func.max(OrderItem.order_date).label("last_seen_date"),
        )
        .select_from(OrderItem)
        .join(Marketplace, OrderItem.marketplace_id == Marketplace.id)
        .outerjoin(
            SkuMapping,
            (OrderItem.sku == SkuMapping.sku) & (Marketplace.code == SkuMapping.marketplace_code),
        )
        .where(
            unmapped_cond,
            OrderItem.order_date >= start_date,
            OrderItem.order_date <= end_date,
        )
        .group_by(Marketplace.code, OrderItem.sku)
        .order_by(func.sum(OrderItem.units).desc())
        .limit(limit)
    )
    if marketplace_code:
        q = q.where(Marketplace.code == marketplace_code)
    rows = db.execute(q).all()

    items = [
        TopUnmappedSkuRow(
            marketplace_code=r.marketplace_code,
            sku=r.sku,
            units_30d=int(r.units_30d),
            last_seen_date=r.last_seen_date,
            seen_in_orders=True,
            mapping_status=None,
        )
        for r in rows
    ]
    return TopUnmappedResponse(items=items)


# --- Phase 12.4: Unmapped trend (last 12 weeks) ---
WEEKS_TREND = 12


@router.get("/admin/data-health/unmapped-trend", response_model=UnmappedTrendResponse)
def unmapped_trend(
    marketplace_code: str | None = Query(default=None, description="Filter by marketplace"),
    user: User = Depends(require_owner),
    db: Session = Depends(get_db),
) -> UnmappedTrendResponse:
    """Last 12 weeks: week_start, total_units, unmapped_units, unmapped_share. Owner-only."""
    end_date = date.today()
    start_date = end_date - timedelta(days=WEEKS_TREND * 7)
    unmapped_cond = or_(
        SkuMapping.id.is_(None),
        SkuMapping.status == SKU_MAPPING_STATUS_PENDING,
    )
    week_start = cast(func.date_trunc("week", OrderItem.order_date), Date)
    total_col = func.coalesce(func.sum(OrderItem.units), 0)
    unmapped_col = func.sum(
        case((unmapped_cond, OrderItem.units), else_=0)
    )
    q = (
        select(
            week_start.label("week_start"),
            total_col.label("total_units"),
            unmapped_col.label("unmapped_units"),
        )
        .select_from(OrderItem)
        .join(Marketplace, OrderItem.marketplace_id == Marketplace.id)
        .outerjoin(
            SkuMapping,
            (OrderItem.sku == SkuMapping.sku) & (Marketplace.code == SkuMapping.marketplace_code),
        )
        .where(
            OrderItem.order_date >= start_date,
            OrderItem.order_date <= end_date,
        )
        .group_by(week_start)
    )
    if marketplace_code:
        q = q.where(Marketplace.code == marketplace_code)
    q = q.order_by(week_start)
    rows = db.execute(q).all()
    items = []
    for r in rows:
        total_units = int(r.total_units or 0)
        unmapped_units = int(r.unmapped_units or 0)
        unmapped_share = (unmapped_units / total_units) if total_units > 0 else 0.0
        week_start_date = r.week_start
        if hasattr(week_start_date, "date"):
            week_start_date = week_start_date.date()
        items.append(
            UnmappedTrendRow(
                week_start=week_start_date,
                total_units=total_units,
                unmapped_units=unmapped_units,
                unmapped_share=round(unmapped_share, 4),
            )
        )
    return UnmappedTrendResponse(items=items)
