"""
Sprint 14: Ads attribution and SKU profitability service.

Read-only: joins Orders (order_items), ads_attributed_daily, sku_cost.
Returns revenue, ad_spend, attributed_sales, COGS, net profit, ACOS/ROAS, warning_flags.
Resilient: missing mappings/COGS/attribution yield warnings, not crashes.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import date, timedelta
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.ads import AdsAttributedDaily, AdsDailyMetrics, AdsProfile
from app.models.marketplace import Marketplace
from app.models.order_item import OrderItem
from app.models.sku_cost import SkuCost
from app.models.sku_mapping import SkuMapping

logger = logging.getLogger(__name__)


@dataclass
class SkuProfitabilityRow:
    """Single SKU profitability row for get_sku_profitability."""

    sku: str
    marketplace_code: str
    revenue: Decimal
    ad_spend: Decimal | None
    attributed_sales: Decimal | None
    organic_sales: Decimal | None
    units_sold: int
    unit_cogs: Decimal | None
    total_cogs: Decimal | None
    gross_profit: Decimal | None
    net_profit: Decimal | None
    acos: Decimal | None
    roas: Decimal | None
    warning_flags: list[str]


@dataclass
class SkuTimeseriesPoint:
    """Single day in SKU profitability timeseries."""

    date: date
    revenue: Decimal
    ad_spend: Decimal
    attributed_sales: Decimal | None
    net_profit: Decimal | None
    units: int


def _resolve_marketplace_filter(
    db: Session, marketplace: str | None
) -> tuple[int | None, str]:
    """Return (marketplace_id, marketplace_code) for filter. None means ALL."""
    if not marketplace or marketplace == "ALL":
        return None, "ALL"
    row = db.execute(
        select(Marketplace.id, Marketplace.code).where(Marketplace.code == marketplace)
    ).one_or_none()
    if not row:
        return None, marketplace  # caller may validate
    return row.id, row.code


def _asin_to_sku_map(db: Session, marketplace_code: str) -> dict[str, str]:
    """Map ASIN -> SKU from SkuMapping for a marketplace."""
    if marketplace_code == "ALL":
        rows = db.execute(
            select(SkuMapping.asin, SkuMapping.sku).where(
                SkuMapping.asin.isnot(None), SkuMapping.asin != ""
            )
        ).all()
    else:
        rows = db.execute(
            select(SkuMapping.asin, SkuMapping.sku).where(
                SkuMapping.marketplace_code == marketplace_code,
                SkuMapping.asin.isnot(None),
                SkuMapping.asin != "",
            )
        ).all()
    return {r.asin: r.sku for r in rows if r.asin}


def get_sku_profitability(
    db: Session,
    days: int = 30,
    marketplace: str | None = None,
) -> list[SkuProfitabilityRow]:
    """
    Return SKU-level profitability: revenue (orders), ad_spend, attributed_sales,
    organic_sales, COGS, net profit, ACOS, ROAS, warning_flags.
    Prefer ads_attributed_daily.sku; if only ASIN, map via SkuMapping. Unmapped -> UNMAPPED:<ASIN> or warning.
    """
    end_date = date.today()
    start_date = end_date - timedelta(days=days - 1)
    _, mkt_code = _resolve_marketplace_filter(db, marketplace)
    if marketplace and marketplace != "ALL" and not db.scalar(select(Marketplace.id).where(Marketplace.code == marketplace)):
        logger.warning("ads_attribution_unknown_marketplace", extra={"marketplace": marketplace})
        return []

    # 1) Revenue and units by SKU from order_items (join Marketplace for code when filtering)
    order_q = (
        select(
            OrderItem.sku,
            Marketplace.code.label("marketplace_code"),
            func.coalesce(func.sum(OrderItem.revenue), 0).label("revenue"),
            func.coalesce(func.sum(OrderItem.units), 0).label("units"),
        )
        .select_from(OrderItem)
        .join(Marketplace, OrderItem.marketplace_id == Marketplace.id)
        .where(OrderItem.order_date >= start_date, OrderItem.order_date <= end_date)
        .group_by(OrderItem.sku, Marketplace.code)
    )
    if marketplace and marketplace != "ALL":
        order_q = order_q.where(Marketplace.code == marketplace)
    order_rows = db.execute(order_q).all()

    # 2) Attribution: rows with sku set, then rows with only asin (map via SkuMapping)
    attr_q = (
        select(
            AdsAttributedDaily.sku,
            AdsAttributedDaily.marketplace_code,
            func.coalesce(func.sum(AdsAttributedDaily.ad_spend), 0).label("ad_spend"),
            func.coalesce(func.sum(AdsAttributedDaily.attributed_sales), 0).label("attributed_sales"),
        )
        .select_from(AdsAttributedDaily)
        .where(
            AdsAttributedDaily.date >= start_date,
            AdsAttributedDaily.date <= end_date,
            AdsAttributedDaily.sku.isnot(None),
            AdsAttributedDaily.sku != "",
        )
        .group_by(AdsAttributedDaily.sku, AdsAttributedDaily.marketplace_code)
    )
    attr_by_asin_q = (
        select(
            AdsAttributedDaily.asin,
            AdsAttributedDaily.marketplace_code,
            func.coalesce(func.sum(AdsAttributedDaily.ad_spend), 0).label("ad_spend"),
            func.coalesce(func.sum(AdsAttributedDaily.attributed_sales), 0).label("attributed_sales"),
        )
        .select_from(AdsAttributedDaily)
        .where(
            AdsAttributedDaily.date >= start_date,
            AdsAttributedDaily.date <= end_date,
            AdsAttributedDaily.asin.isnot(None),
            AdsAttributedDaily.asin != "",
            (AdsAttributedDaily.sku.is_(None)) | (AdsAttributedDaily.sku == ""),
        )
        .group_by(AdsAttributedDaily.asin, AdsAttributedDaily.marketplace_code)
    )
    attr_rows_with_sku = db.execute(attr_q).all()
    attr_rows_asin_only = db.execute(attr_by_asin_q).all()

    asin_to_sku = _asin_to_sku_map(db, mkt_code) if mkt_code != "ALL" else _asin_to_sku_map(db, "US")
    attr_map: dict[tuple[str, str], tuple[Decimal, Decimal]] = {}
    for r in attr_rows_with_sku:
        key = (r.sku or "", r.marketplace_code or "ALL")
        attr_map[key] = (Decimal(str(r.ad_spend)), Decimal(str(r.attributed_sales)))
    for r in attr_rows_asin_only:
        sku = asin_to_sku.get(r.asin) if r.asin else None
        sku_key = sku if sku else (f"UNMAPPED:{r.asin}" if r.asin else None)
        if sku_key is None:
            continue
        mkt = r.marketplace_code or "ALL"
        key = (sku_key, mkt)
        existing = attr_map.get(key, (Decimal("0"), Decimal("0")))
        attr_map[key] = (
            existing[0] + Decimal(str(r.ad_spend)),
            existing[1] + Decimal(str(r.attributed_sales)),
        )

    # 3) COGS from sku_cost (prefer sku+marketplace_code, else sku+NULL global)
    cost_q = select(SkuCost.sku, SkuCost.marketplace_code, SkuCost.unit_cost).select_from(SkuCost)
    cost_rows = db.execute(cost_q).all()
    cogs_map: dict[tuple[str, str], Decimal] = {}
    for r in cost_rows:
        mkt = r.marketplace_code if r.marketplace_code else "GLOBAL"
        cogs_map[(r.sku, mkt)] = Decimal(str(r.unit_cost))
    # Resolve: (sku, marketplace_code) -> unit_cost; fallback (sku, GLOBAL)
    def get_unit_cogs(sku: str, mkt_code: str) -> Decimal | None:
        if (sku, mkt_code) in cogs_map:
            return cogs_map[(sku, mkt_code)]
        if (sku, "GLOBAL") in cogs_map:
            return cogs_map[(sku, "GLOBAL")]
        return None

    # 4) Profile-level total spend for proportional allocation when no attribution per SKU
    profile_spend_q = (
        select(
            AdsProfile.id,
            func.coalesce(func.sum(AdsDailyMetrics.spend), 0).label("total_spend"),
        )
        .select_from(AdsProfile)
        .join(AdsDailyMetrics, AdsDailyMetrics.ads_profile_id == AdsProfile.id)
        .where(
            AdsDailyMetrics.date >= start_date,
            AdsDailyMetrics.date <= end_date,
        )
        .group_by(AdsProfile.id)
    )
    if marketplace and marketplace != "ALL":
        profile_spend_q = (
            profile_spend_q.join(Marketplace, AdsProfile.marketplace_id == Marketplace.id)
            .where(Marketplace.code == marketplace)
        )
    profile_spend = {r.id: Decimal(str(r.total_spend)) for r in db.execute(profile_spend_q).all()}
    total_profile_spend = sum(profile_spend.values()) or Decimal("0")

    # 5) Build result rows: one per (sku, marketplace_code) from orders
    result: list[SkuProfitabilityRow] = []
    for row in order_rows:
        sku = row.sku
        mkt = row.marketplace_code or "ALL"
        revenue = Decimal(str(row.revenue))
        units_sold = int(row.units)
        ad_spend, attributed_sales = attr_map.get((sku, mkt), (None, None))
        if ad_spend is None:
            ad_spend = None
        if attributed_sales is None:
            attributed_sales = None
        # If no attribution row, we could allocate total spend by revenue share; for simplicity leave ad_spend None
        if ad_spend is None and total_profile_spend and revenue and revenue > 0:
            # Optional: allocate proportionally (simplified: leave None and set warning)
            ad_spend = None
        organic_sales = (revenue - attributed_sales) if attributed_sales is not None else None
        unit_cogs = get_unit_cogs(sku, mkt)
        total_cogs = (unit_cogs * units_sold) if unit_cogs is not None else None
        gross_profit = (revenue - total_cogs) if total_cogs is not None else None
        net_profit = None
        if total_cogs is not None and ad_spend is not None:
            net_profit = revenue - total_cogs - ad_spend
        elif total_cogs is not None:
            net_profit = revenue - total_cogs
        elif ad_spend is not None:
            net_profit = revenue - ad_spend
        acos = (ad_spend / attributed_sales * 100) if (attributed_sales and attributed_sales > 0 and ad_spend is not None) else None
        roas = (attributed_sales / ad_spend) if (ad_spend and ad_spend > 0 and attributed_sales is not None) else None
        warning_flags: list[str] = []
        if unit_cogs is None and (sku or "").startswith("UNMAPPED:"):
            warning_flags.append("missing_mapping")
        elif unit_cogs is None:
            warning_flags.append("missing_cogs")
        if attributed_sales is None or (attributed_sales == 0 and (ad_spend is None or ad_spend == 0)):
            if "missing_cogs" not in warning_flags and "missing_mapping" not in warning_flags:
                pass
            # Only add missing_attribution if we expected attribution but have none
            if ad_spend is None and total_profile_spend and total_profile_spend > 0:
                warning_flags.append("missing_attribution")
        result.append(
            SkuProfitabilityRow(
                sku=sku,
                marketplace_code=mkt,
                revenue=revenue,
                ad_spend=ad_spend,
                attributed_sales=attributed_sales,
                organic_sales=organic_sales,
                units_sold=units_sold,
                unit_cogs=unit_cogs,
                total_cogs=total_cogs,
                gross_profit=gross_profit,
                net_profit=net_profit,
                acos=acos,
                roas=roas,
                warning_flags=warning_flags,
            )
        )

    # Include SKUs that appear only in attribution (no orders in range) as optional rows with revenue=0
    seen = {(r.sku, r.marketplace_code) for r in result}
    for (sku_key, mkt), (ad_spend_val, attributed_sales_val) in attr_map.items():
        if (sku_key, mkt) in seen:
            continue
        if not sku_key:
            continue
        unit_cogs = get_unit_cogs(sku_key, mkt)
        warning_flags = []
        if unit_cogs is None:
            warning_flags.append("missing_cogs")
        warning_flags.append("missing_orders_in_range")
        result.append(
            SkuProfitabilityRow(
                sku=sku_key,
                marketplace_code=mkt,
                revenue=Decimal("0"),
                ad_spend=ad_spend_val,
                attributed_sales=attributed_sales_val,
                organic_sales=Decimal("0") - attributed_sales_val,
                units_sold=0,
                unit_cogs=unit_cogs,
                total_cogs=None,
                gross_profit=None,
                net_profit=-ad_spend_val if ad_spend_val else None,
                acos=(ad_spend_val / attributed_sales_val * 100) if attributed_sales_val and attributed_sales_val > 0 else None,
                roas=(attributed_sales_val / ad_spend_val) if ad_spend_val and ad_spend_val > 0 else None,
                warning_flags=warning_flags,
            )
        )

    logger.info(
        "ads_attribution_sku_profitability",
        extra={"days": days, "marketplace": marketplace or "ALL", "row_count": len(result)},
    )
    return result


def get_sku_profitability_timeseries(
    db: Session,
    sku: str,
    days: int = 30,
    marketplace: str | None = None,
) -> list[SkuTimeseriesPoint]:
    """Return daily timeseries for one SKU: date, revenue, ad_spend, attributed_sales, net_profit, units."""
    end_date = date.today()
    start_date = end_date - timedelta(days=days - 1)
    _, mkt_code = _resolve_marketplace_filter(db, marketplace)
    date_list = [start_date + timedelta(days=i) for i in range(days)]

    # Revenue and units by date from order_items
    order_q = (
        select(
            OrderItem.order_date,
            func.coalesce(func.sum(OrderItem.revenue), 0).label("revenue"),
            func.coalesce(func.sum(OrderItem.units), 0).label("units"),
        )
        .select_from(OrderItem)
        .join(Marketplace, OrderItem.marketplace_id == Marketplace.id)
        .where(
            OrderItem.sku == sku,
            OrderItem.order_date >= start_date,
            OrderItem.order_date <= end_date,
        )
        .group_by(OrderItem.order_date)
    )
    if marketplace and marketplace != "ALL":
        order_q = order_q.where(Marketplace.code == marketplace)
    order_by_date = {r.order_date: (Decimal(str(r.revenue)), int(r.units)) for r in db.execute(order_q).all()}

    # Attribution by date (ads_attributed_daily for this sku or ASIN mapped to sku)
    attr_q = (
        select(
            AdsAttributedDaily.date,
            func.coalesce(func.sum(AdsAttributedDaily.ad_spend), 0).label("ad_spend"),
            func.coalesce(func.sum(AdsAttributedDaily.attributed_sales), 0).label("attributed_sales"),
        )
        .select_from(AdsAttributedDaily)
        .where(
            AdsAttributedDaily.sku == sku,
            AdsAttributedDaily.date >= start_date,
            AdsAttributedDaily.date <= end_date,
        )
        .group_by(AdsAttributedDaily.date)
    )
    if marketplace and marketplace != "ALL":
        attr_q = attr_q.where(AdsAttributedDaily.marketplace_code == marketplace)
    attr_by_date = {r.date: (Decimal(str(r.ad_spend)), Decimal(str(r.attributed_sales))) for r in db.execute(attr_q).all()}

    # COGS for net_profit: prefer (sku, marketplace), else (sku, global)
    unit_cogs = None
    if mkt_code and mkt_code != "ALL":
        cost_row = db.execute(
            select(SkuCost.unit_cost).where(
                SkuCost.sku == sku,
                SkuCost.marketplace_code == mkt_code,
            ).limit(1)
        ).first()
        if cost_row:
            unit_cogs = Decimal(str(cost_row[0]))
    if unit_cogs is None:
        cost_row = db.execute(
            select(SkuCost.unit_cost).where(
                SkuCost.sku == sku,
                SkuCost.marketplace_code.is_(None),
            ).limit(1)
        ).first()
        if cost_row:
            unit_cogs = Decimal(str(cost_row[0]))

    points: list[SkuTimeseriesPoint] = []
    for d in date_list:
        rev, units = order_by_date.get(d, (Decimal("0"), 0))
        ad_s, attr_s = attr_by_date.get(d, (Decimal("0"), Decimal("0")))
        total_cogs = (unit_cogs * units) if unit_cogs is not None else None
        net_profit = rev - ad_s
        if total_cogs is not None:
            net_profit = rev - total_cogs - ad_s
        points.append(
            SkuTimeseriesPoint(
                date=d,
                revenue=rev,
                ad_spend=ad_s,
                attributed_sales=attr_s if attr_s else None,
                net_profit=net_profit,
                units=units,
            )
        )
    logger.info(
        "ads_attribution_sku_timeseries",
        extra={"sku": sku, "days": days, "marketplace": marketplace or "ALL"},
    )
    return points
