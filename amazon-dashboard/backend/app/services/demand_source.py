"""
Demand source selector for restock: wraps legacy and mapped demand.

Phase 12.3: default to mapped_confirmed (confirmed-only); optional include_unmapped.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import date
from typing import Literal

from sqlalchemy.orm import Session

from app.schemas.data_quality import DataQualitySeverity
from app.services.timeseries import (
    get_daily_units_by_sku,
    get_daily_units_by_sku_mapped,
    get_daily_units_total,
    get_daily_units_total_mapped,
)

logger = logging.getLogger(__name__)

DemandMode = Literal["legacy", "mapped_confirmed", "mapped_include_unmapped"]


def _compute_severity(
    unmapped_share_30d: float,
    excluded_units: int,
    total_units_in_window: int,
) -> DataQualitySeverity:
    """Phase 12.4: critical if share>10% or no demand; warning if share>0 or exclusions>0; else ok."""
    if unmapped_share_30d > 0.10 or total_units_in_window == 0:
        return "critical"
    if unmapped_share_30d > 0 or excluded_units > 0:
        return "warning"
    return "ok"


@dataclass
class RestockDemandMeta:
    """Metadata returned with demand series for restock: mode, exclusions, warnings, severity."""

    mode: DemandMode
    excluded_units: int
    excluded_skus: int
    unmapped_units_30d: int
    unmapped_share_30d: float
    ignored_units_30d: int
    discontinued_units_30d: int
    warnings: list[str]
    severity: DataQualitySeverity


def _mode_from_include_unmapped(include_unmapped: bool) -> DemandMode:
    """Default for restock in Phase 12.3: mapped_confirmed."""
    return "mapped_include_unmapped" if include_unmapped else "mapped_confirmed"


def _build_warnings(
    mode: DemandMode,
    excluded_units: int,
    unmapped_share_30d: float,
    total_units_in_window: int,
) -> list[str]:
    warnings: list[str] = []
    if mode != "legacy" and excluded_units > 0:
        warnings.append(
            "Some demand was excluded because SKUs are unmapped/pending or ignored/discontinued."
        )
    if unmapped_share_30d > 0.10:
        pct = round(unmapped_share_30d * 100, 1)
        warnings.append(
            f"Unmapped or pending demand is {pct}% of total in the selected window."
        )
    if total_units_in_window == 0:
        warnings.append("No demand in selected window.")
    return warnings


def get_demand_series_for_restock_total(
    db: Session,
    marketplace_code: str,
    start_date: date,
    end_date: date | None,
    *,
    mode: DemandMode | None = None,
    include_unmapped: bool = False,
) -> tuple[list[tuple[date, int]], RestockDemandMeta]:
    """
    Return (series, meta) for aggregate demand in the date range.

    - legacy: get_daily_units_total (no mapping).
    - mapped_confirmed: get_daily_units_total_mapped(..., include_unmapped=False).
    - mapped_include_unmapped: get_daily_units_total_mapped(..., include_unmapped=True).

    If mode is None, derive from include_unmapped (default mapped_confirmed).
    """
    if mode is None:
        mode = _mode_from_include_unmapped(include_unmapped)

    if mode == "legacy":
        series = get_daily_units_total(db, start_date, end_date, marketplace_code)
        total_units = sum(u for _, u in series)
        meta = RestockDemandMeta(
            mode="legacy",
            excluded_units=0,
            excluded_skus=0,
            unmapped_units_30d=0,
            unmapped_share_30d=0.0,
            ignored_units_30d=0,
            discontinued_units_30d=0,
            warnings=_build_warnings("legacy", 0, 0.0, total_units),
            severity=_compute_severity(0.0, 0, total_units),
        )
        return (series, meta)

    series, demand_meta = get_daily_units_total_mapped(
        db,
        start_date,
        end_date,
        marketplace_code if marketplace_code != "ALL" else None,
        include_unmapped=(mode == "mapped_include_unmapped"),
    )
    total_units = sum(u for _, u in series)
    total_all = total_units + demand_meta.excluded_units + demand_meta.unmapped_units
    if total_all > 0:
        unmapped_share = demand_meta.unmapped_units / total_all
    else:
        unmapped_share = 0.0

    warnings = _build_warnings(
        mode,
        demand_meta.excluded_units,
        unmapped_share,
        total_units,
    )
    for w in warnings:
        logger.info("restock demand total: %s", w)

    meta = RestockDemandMeta(
        mode=mode,
        excluded_units=demand_meta.excluded_units,
        excluded_skus=demand_meta.excluded_skus,
        unmapped_units_30d=demand_meta.unmapped_units,
        unmapped_share_30d=round(unmapped_share, 4),
        ignored_units_30d=demand_meta.ignored_units,
        discontinued_units_30d=demand_meta.discontinued_units,
        warnings=warnings,
        severity=_compute_severity(unmapped_share, demand_meta.excluded_units, total_units),
    )
    return (series, meta)


def get_demand_series_for_restock_sku(
    db: Session,
    sku: str,
    marketplace_code: str,
    start_date: date,
    end_date: date | None,
    *,
    mode: DemandMode | None = None,
    include_unmapped: bool = False,
) -> tuple[list[tuple[date, int]], RestockDemandMeta]:
    """
    Return (series, meta) for a single SKU in the date range.

    - legacy: get_daily_units_by_sku.
    - mapped_confirmed / mapped_include_unmapped: get_daily_units_by_sku_mapped.
    """
    if mode is None:
        mode = _mode_from_include_unmapped(include_unmapped)

    if mode == "legacy":
        series = get_daily_units_by_sku(
            db, sku, start_date, end_date, marketplace_code
        )
        total_units = sum(u for _, u in series)
        meta = RestockDemandMeta(
            mode="legacy",
            excluded_units=0,
            excluded_skus=0,
            unmapped_units_30d=0,
            unmapped_share_30d=0.0,
            ignored_units_30d=0,
            discontinued_units_30d=0,
            warnings=_build_warnings("legacy", 0, 0.0, total_units),
            severity=_compute_severity(0.0, 0, total_units),
        )
        return (series, meta)

    series, demand_meta = get_daily_units_by_sku_mapped(
        db,
        sku,
        start_date,
        end_date,
        marketplace_code if marketplace_code != "ALL" else None,
        include_unmapped=(mode == "mapped_include_unmapped"),
    )
    total_units = sum(u for _, u in series)
    total_all = total_units + demand_meta.excluded_units + demand_meta.unmapped_units
    if total_all > 0:
        unmapped_share = demand_meta.unmapped_units / total_all
    else:
        unmapped_share = 0.0

    warnings = _build_warnings(
        mode,
        demand_meta.excluded_units,
        unmapped_share,
        total_units,
    )
    for w in warnings:
        logger.info("restock demand sku=%s: %s", sku, w)

    meta = RestockDemandMeta(
        mode=mode,
        excluded_units=demand_meta.excluded_units,
        excluded_skus=demand_meta.excluded_skus,
        unmapped_units_30d=demand_meta.unmapped_units,
        unmapped_share_30d=round(unmapped_share, 4),
        ignored_units_30d=demand_meta.ignored_units,
        discontinued_units_30d=demand_meta.discontinued_units,
        warnings=warnings,
        severity=_compute_severity(unmapped_share, demand_meta.excluded_units, total_units),
    )
    return (series, meta)
