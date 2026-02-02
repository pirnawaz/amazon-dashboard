"""Shared data quality block for restock/forecast responses. Phase 12.3. Phase 12.4: severity."""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

DataQualityMode = Literal["mapped_confirmed", "mapped_include_unmapped", "legacy"]
DataQualitySeverity = Literal["ok", "warning", "critical"]


class DataQuality(BaseModel):
    """Nested block for demand data quality in restock plan/actions responses."""

    mode: DataQualityMode = Field(
        ...,
        description="Demand source: mapped_confirmed (default) | mapped_include_unmapped | legacy",
    )
    excluded_units: int = Field(0, description="Units excluded (unmapped/ignored/discontinued)")
    excluded_skus: int = Field(0, description="SKU count excluded")
    unmapped_units_30d: int = Field(0, description="Unmapped/pending units in window")
    unmapped_share_30d: float = Field(0.0, ge=0, le=1, description="Share of demand that is unmapped (0–1)")
    ignored_units_30d: int = Field(0, description="Ignored mapping status units in window")
    discontinued_units_30d: int = Field(0, description="Discontinued mapping status units in window")
    warnings: list[str] = Field(default_factory=list, description="Data quality warnings")
    severity: DataQualitySeverity = Field(
        "ok",
        description="ok: no issues; warning: share>0 or exclusions>0; critical: share>10% or no demand",
    )
