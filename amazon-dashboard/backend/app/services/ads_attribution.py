"""Sprint 14: Ads attribution and SKU profitability service.

Provides functions to calculate and retrieve SKU-level profitability metrics
combining orders revenue, ad spend (from attribution or totals), and COGS.
"""
from __future__ import annotations

import logging
from datetime import date, timedelta
from decimal import Decimal
from typing import Any

from sqlalchemy import func, select, and_, or_
from sqlalchemy.orm import Session

from app.models.ads_attributed_daily import AdsAttributedDaily
from app.models.ad_spend_daily import AdSpendDaily
from app.models.marketplace import Marketplace
from app.models.order_item import OrderItem
from app.models.sku_cost import SkuCost
from app.models.sku_mapping import SkuMapping

logger = logging.getLogger(__name__)


def _get_marketplace_id(db: Session, marketplace_code: str) -> int | None:
    """Get marketplace ID from code, or None if not found."""
    if marketplace_code == "ALL":
        return None
    return db.scalar(select(Marketplace.id).where(Marketplace.code == marketplace_code))


def _safe_decimal(value: Any, default: Decimal = Decimal("0")) -> Decimal:
    """Convert value to Decimal safely, returning default if None or invalid."""
    if value is None:
        return default
    try:
        return Decimal(str(value))
    except (ValueError, TypeError):
        return default


def _calculate_acos(ad_spend: Decimal, attributed_sales: Decimal) -> float | None:
    """Calculate ACOS (Advertising Cost of Sales) = ad_spend / attributed_sales."""
    if attributed_sales is None or attributed_sales <= 0:
        return None
    return float(ad_spend / attributed_sales)


def _calculate_roas(attributed_sales: Decimal, ad_spend: Decimal) -> float | None:
    """Calculate ROAS (Return on Ad Spend) = attributed_sales / ad_spend."""
    if ad_spend is None or ad_spend <= 0:
        return None
    return float(attributed_sales / ad_spend)


def get_sku_profitability(
    db: Session,
    days: int = 30,
    marketplace: str | None = None,
) -> list[dict]:
    """Get SKU-level profitability data for the specified time period.

    Returns a list of SKU rows with:
    - sku, marketplace_code
    - revenue (from orders)
    - ad_spend (from ads_attributed_daily if available, else from totals or NULL)
    - attributed_sales (from ads_attributed_daily if available, else NULL)
    - organic_sales (revenue - attributed_sales if available)
    - units_sold (from orders)
    - unit_cogs (from sku_cost if available)
    - total_cogs (unit_cogs * units_sold if available)
    - gross_profit (revenue - total_cogs if available)
    - net_profit (revenue - total_cogs - ad_spend if available)
    - acos, roas
    - warning_flags (array of warning strings)

    Args:
        db: Database session
        days: Number of days to look back (default 30)
        marketplace: Marketplace code filter (None or "ALL" for all marketplaces)
    """
    logger.info(
        "Getting SKU profitability",
        extra={"days": days, "marketplace": marketplace},
    )

    end_date = date.today()
    start_date = end_date - timedelta(days=days - 1)
    marketplace_filter = marketplace if marketplace and marketplace != "ALL" else None

    # 1. Get revenue/units from orders, grouped by SKU and marketplace
    order_q = (
        select(
            OrderItem.sku,
            Marketplace.code.label("marketplace_code"),
            func.coalesce(func.sum(OrderItem.revenue), 0).label("revenue"),
            func.coalesce(func.sum(OrderItem.units), 0).label("units_sold"),
            func.count(func.distinct(OrderItem.order_id)).label("orders_count"),
        )
        .select_from(OrderItem)
        .join(Marketplace, OrderItem.marketplace_id == Marketplace.id)
        .where(OrderItem.order_date >= start_date, OrderItem.order_date <= end_date)
        .group_by(OrderItem.sku, Marketplace.code)
    )
    if marketplace_filter:
        order_q = order_q.where(Marketplace.code == marketplace_filter)

    order_rows = db.execute(order_q).all()
    logger.debug("Found %d order SKU rows", len(order_rows))

    # Build a dict of orders by (sku, marketplace)
    orders_by_key: dict[tuple[str, str], dict] = {}
    for row in order_rows:
        key = (row.sku, row.marketplace_code)
        orders_by_key[key] = {
            "revenue": _safe_decimal(row.revenue),
            "units_sold": int(row.units_sold),
            "orders_count": int(row.orders_count),
        }

    # 2. Get attributed data from ads_attributed_daily, grouped by SKU and marketplace
    attr_q = (
        select(
            AdsAttributedDaily.sku,
            AdsAttributedDaily.marketplace_code,
            func.coalesce(func.sum(AdsAttributedDaily.attributed_sales), 0).label("attributed_sales"),
            func.coalesce(func.sum(AdsAttributedDaily.ad_spend), 0).label("ad_spend"),
            func.coalesce(func.sum(AdsAttributedDaily.attributed_units), 0).label("attributed_units"),
        )
        .where(
            AdsAttributedDaily.date >= start_date,
            AdsAttributedDaily.date <= end_date,
            AdsAttributedDaily.sku.isnot(None),
        )
        .group_by(AdsAttributedDaily.sku, AdsAttributedDaily.marketplace_code)
    )
    if marketplace_filter:
        attr_q = attr_q.where(AdsAttributedDaily.marketplace_code == marketplace_filter)

    attr_rows = db.execute(attr_q).all()
    logger.debug("Found %d attribution SKU rows", len(attr_rows))

    # Build a dict of attribution by (sku, marketplace)
    attr_by_key: dict[tuple[str, str], dict] = {}
    for row in attr_rows:
        key = (row.sku, row.marketplace_code)
        attr_by_key[key] = {
            "attributed_sales": _safe_decimal(row.attributed_sales),
            "ad_spend": _safe_decimal(row.ad_spend),
            "attributed_units": int(row.attributed_units),
        }

    # 3. Get COGS data from sku_cost
    # First get marketplace-specific costs, then global costs
    cost_q = select(
        SkuCost.sku,
        SkuCost.marketplace_code,
        SkuCost.unit_cost,
        SkuCost.currency,
    )
    if marketplace_filter:
        cost_q = cost_q.where(
            or_(
                SkuCost.marketplace_code == marketplace_filter,
                SkuCost.marketplace_code.is_(None),
            )
        )

    cost_rows = db.execute(cost_q).all()
    logger.debug("Found %d SKU cost rows", len(cost_rows))

    # Build dict: (sku, marketplace) -> cost, with fallback to global
    costs_by_sku_mp: dict[tuple[str, str | None], dict] = {}
    costs_global: dict[str, dict] = {}
    for row in cost_rows:
        if row.marketplace_code is None:
            costs_global[row.sku] = {
                "unit_cost": _safe_decimal(row.unit_cost),
                "currency": row.currency,
            }
        else:
            costs_by_sku_mp[(row.sku, row.marketplace_code)] = {
                "unit_cost": _safe_decimal(row.unit_cost),
                "currency": row.currency,
            }

    # 4. Get fallback ad spend totals from ad_spend_daily if no attribution data
    total_ad_spend_q = (
        select(
            Marketplace.code.label("marketplace_code"),
            func.coalesce(func.sum(AdSpendDaily.spend), 0).label("total_spend"),
        )
        .select_from(AdSpendDaily)
        .join(Marketplace, AdSpendDaily.marketplace_id == Marketplace.id)
        .where(AdSpendDaily.date >= start_date, AdSpendDaily.date <= end_date)
        .group_by(Marketplace.code)
    )
    if marketplace_filter:
        total_ad_spend_q = total_ad_spend_q.where(Marketplace.code == marketplace_filter)

    total_ad_rows = db.execute(total_ad_spend_q).all()
    total_ad_by_mp: dict[str, Decimal] = {
        row.marketplace_code: _safe_decimal(row.total_spend)
        for row in total_ad_rows
    }

    # Also get total revenue per marketplace for proportional allocation
    total_revenue_q = (
        select(
            Marketplace.code.label("marketplace_code"),
            func.coalesce(func.sum(OrderItem.revenue), 0).label("total_revenue"),
        )
        .select_from(OrderItem)
        .join(Marketplace, OrderItem.marketplace_id == Marketplace.id)
        .where(OrderItem.order_date >= start_date, OrderItem.order_date <= end_date)
        .group_by(Marketplace.code)
    )
    if marketplace_filter:
        total_revenue_q = total_revenue_q.where(Marketplace.code == marketplace_filter)

    total_rev_rows = db.execute(total_revenue_q).all()
    total_rev_by_mp: dict[str, Decimal] = {
        row.marketplace_code: _safe_decimal(row.total_revenue)
        for row in total_rev_rows
    }

    # 5. Combine all data sources into profitability rows
    all_keys = set(orders_by_key.keys()) | set(attr_by_key.keys())
    results: list[dict] = []

    for sku, mp_code in all_keys:
        order_data = orders_by_key.get((sku, mp_code), {})
        attr_data = attr_by_key.get((sku, mp_code), {})

        revenue = order_data.get("revenue", Decimal("0"))
        units_sold = order_data.get("units_sold", 0)

        # Get ad spend and attributed sales
        warning_flags: list[str] = []
        has_attribution = bool(attr_data)

        if has_attribution:
            ad_spend = attr_data.get("ad_spend", Decimal("0"))
            attributed_sales = attr_data.get("attributed_sales", Decimal("0"))
        else:
            # Fallback: proportionally allocate total ad spend based on revenue share
            attributed_sales = None
            total_mp_ad = total_ad_by_mp.get(mp_code, Decimal("0"))
            total_mp_rev = total_rev_by_mp.get(mp_code, Decimal("0"))

            if total_mp_ad > 0 and total_mp_rev > 0 and revenue > 0:
                # Proportional allocation
                ad_spend = (revenue / total_mp_rev) * total_mp_ad
                warning_flags.append("missing_attribution")
            elif total_mp_ad > 0:
                ad_spend = None
                warning_flags.append("missing_attribution")
            else:
                ad_spend = Decimal("0")

        # Calculate organic sales
        organic_sales = None
        if attributed_sales is not None:
            organic_sales = revenue - attributed_sales

        # Get COGS
        cost_data = costs_by_sku_mp.get((sku, mp_code)) or costs_global.get(sku)
        if cost_data:
            unit_cogs = cost_data["unit_cost"]
            total_cogs = unit_cogs * units_sold if units_sold > 0 else Decimal("0")
        else:
            unit_cogs = None
            total_cogs = None
            warning_flags.append("missing_cogs")

        # Calculate profits
        gross_profit = None
        net_profit = None

        if total_cogs is not None:
            gross_profit = revenue - total_cogs

        if total_cogs is not None and ad_spend is not None:
            net_profit = revenue - total_cogs - ad_spend
        elif total_cogs is not None and ad_spend is None:
            # Can't calculate net profit without ad spend
            pass

        # Calculate ACOS/ROAS
        acos = None
        roas = None

        if attributed_sales is not None:
            acos = _calculate_acos(_safe_decimal(ad_spend), attributed_sales)
        if ad_spend is not None:
            roas = _calculate_roas(_safe_decimal(attributed_sales) if attributed_sales else revenue, _safe_decimal(ad_spend))

        results.append({
            "sku": sku,
            "marketplace_code": mp_code,
            "revenue": float(revenue),
            "ad_spend": float(ad_spend) if ad_spend is not None else None,
            "attributed_sales": float(attributed_sales) if attributed_sales is not None else None,
            "organic_sales": float(organic_sales) if organic_sales is not None else None,
            "units_sold": units_sold,
            "unit_cogs": float(unit_cogs) if unit_cogs is not None else None,
            "total_cogs": float(total_cogs) if total_cogs is not None else None,
            "gross_profit": float(gross_profit) if gross_profit is not None else None,
            "net_profit": float(net_profit) if net_profit is not None else None,
            "acos": acos,
            "roas": roas,
            "warning_flags": warning_flags,
        })

    # Sort by revenue descending
    results.sort(key=lambda x: x["revenue"], reverse=True)

    logger.info("Returning %d SKU profitability rows", len(results))
    return results


def get_sku_profitability_timeseries(
    db: Session,
    sku: str,
    days: int = 30,
    marketplace: str | None = None,
) -> list[dict]:
    """Get daily timeseries profitability data for a single SKU.

    Returns a list of daily data points with:
    - date
    - revenue
    - ad_spend
    - attributed_sales
    - net_profit (if COGS available)
    - units

    Args:
        db: Database session
        sku: SKU identifier
        days: Number of days to look back (default 30)
        marketplace: Marketplace code filter (None or "ALL" for all marketplaces)
    """
    logger.info(
        "Getting SKU timeseries",
        extra={"sku": sku, "days": days, "marketplace": marketplace},
    )

    end_date = date.today()
    start_date = end_date - timedelta(days=days - 1)
    marketplace_filter = marketplace if marketplace and marketplace != "ALL" else None

    # Get COGS for this SKU
    cost_q = select(SkuCost.unit_cost).where(SkuCost.sku == sku)
    if marketplace_filter:
        cost_q = cost_q.where(
            or_(
                SkuCost.marketplace_code == marketplace_filter,
                SkuCost.marketplace_code.is_(None),
            )
        )
    # Prefer marketplace-specific, fallback to global
    cost_q = cost_q.order_by(SkuCost.marketplace_code.desc().nullslast())
    unit_cogs = db.scalar(cost_q)
    unit_cogs_dec = _safe_decimal(unit_cogs) if unit_cogs else None

    # Generate all dates in range
    date_list = [start_date + timedelta(days=i) for i in range(days)]

    # Get orders by date for this SKU
    order_q = (
        select(
            OrderItem.order_date,
            func.coalesce(func.sum(OrderItem.revenue), 0).label("revenue"),
            func.coalesce(func.sum(OrderItem.units), 0).label("units"),
        )
        .select_from(OrderItem)
        .where(
            OrderItem.sku == sku,
            OrderItem.order_date >= start_date,
            OrderItem.order_date <= end_date,
        )
        .group_by(OrderItem.order_date)
    )
    if marketplace_filter:
        order_q = order_q.join(Marketplace, OrderItem.marketplace_id == Marketplace.id).where(
            Marketplace.code == marketplace_filter
        )

    order_rows = db.execute(order_q).all()
    orders_by_date: dict[date, dict] = {
        row.order_date: {
            "revenue": _safe_decimal(row.revenue),
            "units": int(row.units),
        }
        for row in order_rows
    }

    # Get attribution by date for this SKU
    attr_q = (
        select(
            AdsAttributedDaily.date,
            func.coalesce(func.sum(AdsAttributedDaily.attributed_sales), 0).label("attributed_sales"),
            func.coalesce(func.sum(AdsAttributedDaily.ad_spend), 0).label("ad_spend"),
        )
        .where(
            AdsAttributedDaily.sku == sku,
            AdsAttributedDaily.date >= start_date,
            AdsAttributedDaily.date <= end_date,
        )
        .group_by(AdsAttributedDaily.date)
    )
    if marketplace_filter:
        attr_q = attr_q.where(AdsAttributedDaily.marketplace_code == marketplace_filter)

    attr_rows = db.execute(attr_q).all()
    attr_by_date: dict[date, dict] = {
        row.date: {
            "attributed_sales": _safe_decimal(row.attributed_sales),
            "ad_spend": _safe_decimal(row.ad_spend),
        }
        for row in attr_rows
    }

    # Build timeseries
    results: list[dict] = []
    for d in date_list:
        order_data = orders_by_date.get(d, {"revenue": Decimal("0"), "units": 0})
        attr_data = attr_by_date.get(d, {})

        revenue = order_data["revenue"]
        units = order_data["units"]
        ad_spend = attr_data.get("ad_spend")
        attributed_sales = attr_data.get("attributed_sales")

        # Calculate net profit if we have COGS
        net_profit = None
        if unit_cogs_dec is not None:
            total_cogs = unit_cogs_dec * units
            if ad_spend is not None:
                net_profit = revenue - total_cogs - ad_spend
            else:
                # Without ad spend, just show gross profit
                net_profit = revenue - total_cogs

        results.append({
            "date": d.isoformat(),
            "revenue": float(revenue),
            "ad_spend": float(ad_spend) if ad_spend is not None else None,
            "attributed_sales": float(attributed_sales) if attributed_sales is not None else None,
            "net_profit": float(net_profit) if net_profit is not None else None,
            "units": units,
        })

    logger.info("Returning %d timeseries points for SKU %s", len(results), sku)
    return results


def upsert_sku_cost(
    db: Session,
    sku: str,
    unit_cost: Decimal,
    marketplace_code: str | None = None,
    currency: str | None = None,
) -> dict:
    """Create or update SKU cost (COGS) entry.

    Args:
        db: Database session
        sku: SKU identifier
        unit_cost: Cost per unit
        marketplace_code: Optional marketplace code (None for global)
        currency: Optional currency code

    Returns:
        dict with the created/updated cost entry
    """
    logger.info(
        "Upserting SKU cost",
        extra={"sku": sku, "marketplace_code": marketplace_code, "unit_cost": str(unit_cost)},
    )

    # Try to find existing
    q = select(SkuCost).where(SkuCost.sku == sku)
    if marketplace_code:
        q = q.where(SkuCost.marketplace_code == marketplace_code)
    else:
        q = q.where(SkuCost.marketplace_code.is_(None))

    existing = db.scalar(q)

    if existing:
        existing.unit_cost = unit_cost
        if currency is not None:
            existing.currency = currency
        db.flush()
        entry = existing
    else:
        entry = SkuCost(
            sku=sku,
            marketplace_code=marketplace_code,
            unit_cost=unit_cost,
            currency=currency,
        )
        db.add(entry)
        db.flush()

    return {
        "id": entry.id,
        "sku": entry.sku,
        "marketplace_code": entry.marketplace_code,
        "unit_cost": float(entry.unit_cost),
        "currency": entry.currency,
        "updated_at": entry.updated_at.isoformat() if entry.updated_at else None,
    }


def get_sku_costs(
    db: Session,
    sku: str | None = None,
    marketplace_code: str | None = None,
) -> list[dict]:
    """Get SKU cost entries.

    Args:
        db: Database session
        sku: Optional SKU filter
        marketplace_code: Optional marketplace filter

    Returns:
        List of cost entries
    """
    q = select(SkuCost)

    if sku:
        q = q.where(SkuCost.sku == sku)
    if marketplace_code:
        q = q.where(
            or_(
                SkuCost.marketplace_code == marketplace_code,
                SkuCost.marketplace_code.is_(None),
            )
        )

    q = q.order_by(SkuCost.sku, SkuCost.marketplace_code)
    rows = db.execute(q).scalars().all()

    return [
        {
            "id": r.id,
            "sku": r.sku,
            "marketplace_code": r.marketplace_code,
            "unit_cost": float(r.unit_cost),
            "currency": r.currency,
            "updated_at": r.updated_at.isoformat() if r.updated_at else None,
        }
        for r in rows
    ]


def delete_sku_cost(
    db: Session,
    sku: str,
    marketplace_code: str | None = None,
) -> bool:
    """Delete SKU cost entry.

    Args:
        db: Database session
        sku: SKU identifier
        marketplace_code: Marketplace code (None for global)

    Returns:
        True if deleted, False if not found
    """
    logger.info(
        "Deleting SKU cost",
        extra={"sku": sku, "marketplace_code": marketplace_code},
    )

    q = select(SkuCost).where(SkuCost.sku == sku)
    if marketplace_code:
        q = q.where(SkuCost.marketplace_code == marketplace_code)
    else:
        q = q.where(SkuCost.marketplace_code.is_(None))

    entry = db.scalar(q)
    if entry:
        db.delete(entry)
        db.flush()
        return True
    return False
