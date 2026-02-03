"""Forecast overrides CRUD API. Owner-only. Sprint 15."""
from __future__ import annotations

import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps.permissions import require_not_viewer
from app.api.routes.me import get_current_user
from app.db.session import get_db
from app.models.forecast_override import ForecastOverride
from app.models.user import User
from app.schemas.forecast_override import (
    ForecastOverrideCreate,
    ForecastOverrideResponse,
    ForecastOverrideUpdate,
)

logger = logging.getLogger(__name__)

router = APIRouter()


def _row_to_response(row: ForecastOverride) -> ForecastOverrideResponse:
    return ForecastOverrideResponse(
        id=row.id,
        sku=row.sku,
        marketplace_code=row.marketplace_code,
        start_date=row.start_date,
        end_date=row.end_date,
        override_type=row.override_type,
        value=row.value,
        reason=row.reason,
        created_by_user_id=row.created_by_user_id,
        created_by_email=row.created_by_email,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


@router.get("/forecast/overrides", response_model=list[ForecastOverrideResponse])
def list_overrides(
    sku: str | None = Query(default=None, description="Filter by SKU"),
    marketplace: str | None = Query(default=None, description="Filter by marketplace code"),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[ForecastOverrideResponse]:
    """List forecast overrides with optional filters."""
    q = select(ForecastOverride).order_by(ForecastOverride.start_date.desc())
    if sku is not None and sku.strip():
        q = q.where(ForecastOverride.sku == sku.strip())
    if marketplace is not None and marketplace.strip():
        q = q.where(ForecastOverride.marketplace_code == marketplace.strip())
    rows = db.execute(q).scalars().all()
    logger.info("forecast_overrides list user_id=%s sku=%s marketplace=%s count=%s", user.id, sku, marketplace, len(rows))
    return [_row_to_response(r) for r in rows]


@router.post("/forecast/overrides", response_model=ForecastOverrideResponse, status_code=status.HTTP_201_CREATED)
def create_override(
    body: ForecastOverrideCreate,
    user: User = Depends(require_not_viewer),
    db: Session = Depends(get_db),
) -> ForecastOverrideResponse:
    """Create a forecast override. Viewer cannot edit."""
    if body.start_date > body.end_date:
        raise HTTPException(status_code=400, detail="start_date must be <= end_date")
    if body.override_type == "multiplier" and body.value <= 0:
        raise HTTPException(status_code=400, detail="multiplier value must be > 0")
    row = ForecastOverride(
        sku=body.sku or None,
        marketplace_code=body.marketplace_code or None,
        start_date=body.start_date,
        end_date=body.end_date,
        override_type=body.override_type,
        value=body.value,
        reason=body.reason or None,
        created_by_user_id=user.id,
        created_by_email=user.email,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    logger.info(
        "forecast_override created id=%s user_id=%s sku=%s start=%s end=%s type=%s",
        row.id,
        user.id,
        row.sku,
        row.start_date,
        row.end_date,
        row.override_type,
    )
    return _row_to_response(row)


@router.get("/forecast/overrides/{override_id}", response_model=ForecastOverrideResponse)
def get_override(
    override_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ForecastOverrideResponse:
    """Get a single forecast override."""
    row = db.get(ForecastOverride, override_id)
    if not row:
        raise HTTPException(status_code=404, detail="Override not found")
    return _row_to_response(row)


@router.put("/forecast/overrides/{override_id}", response_model=ForecastOverrideResponse)
def update_override(
    override_id: int,
    body: ForecastOverrideUpdate,
    user: User = Depends(require_not_viewer),
    db: Session = Depends(get_db),
) -> ForecastOverrideResponse:
    """Update a forecast override. Viewer cannot edit."""
    row = db.get(ForecastOverride, override_id)
    if not row:
        raise HTTPException(status_code=404, detail="Override not found")
    if body.sku is not None:
        row.sku = body.sku or None
    if body.marketplace_code is not None:
        row.marketplace_code = body.marketplace_code or None
    if body.start_date is not None:
        row.start_date = body.start_date
    if body.end_date is not None:
        row.end_date = body.end_date
    if body.override_type is not None:
        row.override_type = body.override_type
    if body.value is not None:
        row.value = body.value
    if body.reason is not None:
        row.reason = body.reason or None
    if row.start_date > row.end_date:
        raise HTTPException(status_code=400, detail="start_date must be <= end_date")
    if row.override_type == "multiplier" and row.value <= 0:
        raise HTTPException(status_code=400, detail="multiplier value must be > 0")
    row.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(row)
    logger.info("forecast_override updated id=%s user_id=%s", override_id, user.id)
    return _row_to_response(row)


@router.delete("/forecast/overrides/{override_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_override(
    override_id: int,
    user: User = Depends(require_not_viewer),
    db: Session = Depends(get_db),
) -> None:
    """Delete a forecast override. Viewer cannot edit."""
    row = db.get(ForecastOverride, override_id)
    if not row:
        raise HTTPException(status_code=404, detail="Override not found")
    db.delete(row)
    db.commit()
    logger.info("forecast_override deleted id=%s user_id=%s", override_id, user.id)
