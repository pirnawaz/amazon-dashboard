"""Service to fetch forecast overrides overlapping a date range. Sprint 15."""
from __future__ import annotations

import logging
from datetime import date
from decimal import Decimal

from sqlalchemy import and_, or_, select
from sqlalchemy.orm import Session

from app.models.forecast_override import ForecastOverride

logger = logging.getLogger(__name__)


def get_overrides_overlapping(
    db: Session,
    start_date: date,
    end_date: date,
    sku: str | None = None,
    marketplace_code: str | None = None,
) -> list[dict]:
    """
    Fetch overrides that overlap [start_date, end_date].
    Match: (sku IS NULL OR sku = sku_param) AND (marketplace_code IS NULL OR marketplace_code = mp_param).
    For total forecast: sku=None, marketplace_code=None or "ALL" -> match sku IS NULL and (mp IS NULL or mp = code).
    Returns list of dicts with id, sku, marketplace_code, start_date, end_date, override_type, value, reason.
    """
    overlap = and_(
        ForecastOverride.start_date <= end_date,
        ForecastOverride.end_date >= start_date,
    )
    q = (
        select(ForecastOverride)
        .where(overlap)
        .order_by(ForecastOverride.start_date)
    )
    if sku is not None:
        q = q.where(or_(ForecastOverride.sku.is_(None), ForecastOverride.sku == sku))
    if marketplace_code is not None and marketplace_code != "ALL":
        q = q.where(
            or_(
                ForecastOverride.marketplace_code.is_(None),
                ForecastOverride.marketplace_code == marketplace_code,
            )
        )
    rows = db.execute(q).scalars().all()
    out = []
    for r in rows:
        out.append({
            "id": r.id,
            "sku": r.sku,
            "marketplace_code": r.marketplace_code,
            "start_date": r.start_date.isoformat() if r.start_date else None,
            "end_date": r.end_date.isoformat() if r.end_date else None,
            "override_type": r.override_type,
            "value": float(r.value) if isinstance(r.value, Decimal) else r.value,
            "reason": r.reason,
        })
    logger.debug(
        "get_overrides_overlapping start=%s end=%s sku=%s mp=%s count=%s",
        start_date,
        end_date,
        sku,
        marketplace_code,
        len(out),
    )
    return out
