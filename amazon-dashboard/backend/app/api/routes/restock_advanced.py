"""Sprint 16: Restock advanced API — suppliers, settings, recommendations, what-if, CSV export."""
from __future__ import annotations

import csv
import io
import json
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps.permissions import require_owner
from app.api.routes.me import get_current_user
from app.db.session import get_db
from app.models.supplier import SkuSupplierSetting, Supplier
from app.models.user import User
from app.schemas.restock_advanced import (
    RestockRecommendationDetailOut,
    RestockRecommendationRowOut,
    RestockWhatIfRequest,
    RestockWhatIfResponse,
    SupplierCreate,
    SupplierOut,
    SupplierSettingCreate,
    SupplierSettingOut,
    SupplierUpdate,
    SupplierSettingUpdate,
)
from app.services.restock_advanced import (
    RestockRecommendationRow,
    compute_single_recommendation,
    list_recommendations,
)

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Restock Advanced"])


def _row_to_out(row: RestockRecommendationRow) -> RestockRecommendationRowOut:
    return RestockRecommendationRowOut(
        sku=row.sku,
        marketplace_code=row.marketplace_code,
        supplier_id=row.supplier_id,
        supplier_name=row.supplier_name,
        on_hand_units=row.on_hand_units,
        inbound_units=row.inbound_units,
        reserved_units=row.reserved_units,
        available_units=row.available_units,
        daily_demand_forecast=row.daily_demand_forecast,
        days_of_cover=row.days_of_cover,
        lead_time_days_mean=row.lead_time_days_mean,
        lead_time_days_std=row.lead_time_days_std,
        safety_stock_units=row.safety_stock_units,
        reorder_point_units=row.reorder_point_units,
        target_stock_units=row.target_stock_units,
        recommended_order_units=row.recommended_order_units,
        recommended_order_units_rounded=row.recommended_order_units_rounded,
        priority_score=row.priority_score,
        reason_flags=row.reason_flags,
    )


# --- Suppliers (owner only) ---


@router.get("/suppliers", response_model=list[SupplierOut])
def get_suppliers(
    owner: User = Depends(require_owner),
    db: Session = Depends(get_db),
) -> list[SupplierOut]:
    """List all suppliers. Owner only."""
    logger.info("restock_advanced: list suppliers user_id=%s", owner.id)
    rows = db.execute(select(Supplier).order_by(Supplier.name)).scalars().all()
    return [SupplierOut.model_validate(r) for r in rows]


@router.post("/suppliers", response_model=SupplierOut)
def create_supplier(
    body: SupplierCreate,
    owner: User = Depends(require_owner),
    db: Session = Depends(get_db),
) -> SupplierOut:
    """Create a supplier. Owner only."""
    logger.info("restock_advanced: create supplier name=%s user_id=%s", body.name, owner.id)
    existing = db.scalar(select(Supplier).where(Supplier.name == body.name))
    if existing:
        raise HTTPException(status_code=400, detail="Supplier with this name already exists")
    row = Supplier(
        name=body.name,
        contact_email=body.contact_email,
        notes=body.notes,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return SupplierOut.model_validate(row)


@router.put("/suppliers/{supplier_id}", response_model=SupplierOut)
def update_supplier(
    supplier_id: int,
    body: SupplierUpdate,
    owner: User = Depends(require_owner),
    db: Session = Depends(get_db),
) -> SupplierOut:
    """Update a supplier. Owner only."""
    logger.info("restock_advanced: update supplier id=%s user_id=%s", supplier_id, owner.id)
    row = db.get(Supplier, supplier_id)
    if not row:
        raise HTTPException(status_code=404, detail="Supplier not found")
    if body.name is not None:
        other = db.scalar(select(Supplier).where(Supplier.name == body.name, Supplier.id != supplier_id))
        if other:
            raise HTTPException(status_code=400, detail="Supplier with this name already exists")
        row.name = body.name
    if body.contact_email is not None:
        row.contact_email = body.contact_email
    if body.notes is not None:
        row.notes = body.notes
    row.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(row)
    return SupplierOut.model_validate(row)


@router.delete("/suppliers/{supplier_id}", status_code=204)
def delete_supplier(
    supplier_id: int,
    owner: User = Depends(require_owner),
    db: Session = Depends(get_db),
) -> None:
    """Delete a supplier. Owner only."""
    logger.info("restock_advanced: delete supplier id=%s user_id=%s", supplier_id, owner.id)
    row = db.get(Supplier, supplier_id)
    if not row:
        raise HTTPException(status_code=404, detail="Supplier not found")
    db.delete(row)
    db.commit()


# --- Settings (owner only) ---


@router.get("/settings", response_model=list[SupplierSettingOut])
def get_settings(
    sku: str | None = Query(None),
    marketplace: str | None = Query(None, alias="marketplace_code"),
    owner: User = Depends(require_owner),
    db: Session = Depends(get_db),
) -> list[SupplierSettingOut]:
    """List SKU supplier settings with optional sku/marketplace filter. Owner only."""
    logger.info("restock_advanced: list settings sku=%s marketplace=%s user_id=%s", sku, marketplace, owner.id)
    q = select(SkuSupplierSetting).order_by(SkuSupplierSetting.sku, SkuSupplierSetting.marketplace_code)
    if sku:
        q = q.where(SkuSupplierSetting.sku == sku)
    if marketplace:
        q = q.where(SkuSupplierSetting.marketplace_code == marketplace)
    rows = db.execute(q).scalars().all()
    return [SupplierSettingOut.model_validate(r) for r in rows]


@router.post("/settings", response_model=SupplierSettingOut)
def create_setting(
    body: SupplierSettingCreate,
    owner: User = Depends(require_owner),
    db: Session = Depends(get_db),
) -> SupplierSettingOut:
    """Create SKU supplier setting. Owner only."""
    logger.info("restock_advanced: create setting sku=%s mp=%s user_id=%s", body.sku, body.marketplace_code, owner.id)
    supplier = db.get(Supplier, body.supplier_id)
    if not supplier:
        raise HTTPException(status_code=400, detail="Supplier not found")
    if body.marketplace_code is None:
        existing = db.scalar(
            select(SkuSupplierSetting).where(
                SkuSupplierSetting.sku == body.sku,
                SkuSupplierSetting.marketplace_code.is_(None),
            )
        )
    else:
        existing = db.scalar(
            select(SkuSupplierSetting).where(
                SkuSupplierSetting.sku == body.sku,
                SkuSupplierSetting.marketplace_code == body.marketplace_code,
            )
        )
    if existing:
        raise HTTPException(status_code=400, detail="Setting for this sku+marketplace already exists")
    row = SkuSupplierSetting(
        sku=body.sku,
        marketplace_code=body.marketplace_code,
        supplier_id=body.supplier_id,
        lead_time_days_mean=body.lead_time_days_mean,
        lead_time_days_std=body.lead_time_days_std,
        moq_units=body.moq_units,
        pack_size_units=body.pack_size_units,
        reorder_policy=body.reorder_policy,
        min_days_of_cover=body.min_days_of_cover,
        max_days_of_cover=body.max_days_of_cover,
        service_level=body.service_level,
        holding_cost_rate=body.holding_cost_rate,
        stockout_cost_per_unit=body.stockout_cost_per_unit,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return SupplierSettingOut.model_validate(row)


@router.put("/settings/{setting_id}", response_model=SupplierSettingOut)
def update_setting(
    setting_id: int,
    body: SupplierSettingUpdate,
    owner: User = Depends(require_owner),
    db: Session = Depends(get_db),
) -> SupplierSettingOut:
    """Update SKU supplier setting. Owner only."""
    logger.info("restock_advanced: update setting id=%s user_id=%s", setting_id, owner.id)
    row = db.get(SkuSupplierSetting, setting_id)
    if not row:
        raise HTTPException(status_code=404, detail="Setting not found")
    if body.supplier_id is not None:
        if not db.get(Supplier, body.supplier_id):
            raise HTTPException(status_code=400, detail="Supplier not found")
        row.supplier_id = body.supplier_id
    if body.lead_time_days_mean is not None:
        row.lead_time_days_mean = body.lead_time_days_mean
    if body.lead_time_days_std is not None:
        row.lead_time_days_std = body.lead_time_days_std
    if body.moq_units is not None:
        row.moq_units = body.moq_units
    if body.pack_size_units is not None:
        row.pack_size_units = body.pack_size_units
    if body.reorder_policy is not None:
        row.reorder_policy = body.reorder_policy
    if body.min_days_of_cover is not None:
        row.min_days_of_cover = body.min_days_of_cover
    if body.max_days_of_cover is not None:
        row.max_days_of_cover = body.max_days_of_cover
    if body.service_level is not None:
        row.service_level = body.service_level
    if body.holding_cost_rate is not None:
        row.holding_cost_rate = body.holding_cost_rate
    if body.stockout_cost_per_unit is not None:
        row.stockout_cost_per_unit = body.stockout_cost_per_unit
    if body.is_active is not None:
        row.is_active = body.is_active
    row.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(row)
    return SupplierSettingOut.model_validate(row)


@router.delete("/settings/{setting_id}", status_code=204)
def delete_setting(
    setting_id: int,
    owner: User = Depends(require_owner),
    db: Session = Depends(get_db),
) -> None:
    """Delete SKU supplier setting. Owner only."""
    logger.info("restock_advanced: delete setting id=%s user_id=%s", setting_id, owner.id)
    row = db.get(SkuSupplierSetting, setting_id)
    if not row:
        raise HTTPException(status_code=404, detail="Setting not found")
    db.delete(row)
    db.commit()


# --- Recommendations (authenticated) ---


@router.get("/recommendations", response_model=list[RestockRecommendationRowOut])
def get_recommendations(
    days: int = Query(30, ge=7, le=90),
    marketplace: str = Query("US"),
    supplier_id: int | None = Query(None),
    urgent_only: bool = Query(False),
    missing_settings_only: bool = Query(False),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[RestockRecommendationRowOut]:
    """List restock recommendations for the marketplace. Authenticated."""
    logger.info(
        "restock_advanced: list recommendations marketplace=%s days=%s user_id=%s",
        marketplace,
        days,
        user.id,
    )
    try:
        rows = list_recommendations(
            db,
            marketplace,
            days=days,
            supplier_id=supplier_id,
            urgent_only=urgent_only,
            missing_settings_only=missing_settings_only,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return [_row_to_out(r) for r in rows]


@router.get("/recommendations/{sku}", response_model=RestockRecommendationDetailOut)
def get_recommendation_detail(
    sku: str,
    days: int = Query(30, ge=7, le=90),
    marketplace: str = Query("US"),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> RestockRecommendationDetailOut:
    """Get restock recommendation detail for one SKU. Authenticated."""
    logger.info("restock_advanced: recommendation detail sku=%s marketplace=%s user_id=%s", sku, marketplace, user.id)
    try:
        row = compute_single_recommendation(db, sku, marketplace)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return RestockRecommendationDetailOut(**_row_to_out(row).model_dump())


# --- What-if (authenticated) ---


@router.post("/what-if", response_model=RestockWhatIfResponse)
def what_if(
    body: RestockWhatIfRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> RestockWhatIfResponse:
    """Recompute recommendation with hypothetical inputs. Authenticated."""
    logger.info(
        "restock_advanced: what-if sku=%s marketplace=%s user_id=%s",
        body.sku,
        body.marketplace_code,
        user.id,
    )
    try:
        row = compute_single_recommendation(
            db,
            body.sku,
            body.marketplace_code,
            daily_demand_override=body.daily_demand_override,
            on_hand_override=body.on_hand_override,
            inbound_override=body.inbound_override,
            reserved_override=body.reserved_override,
            lead_time_mean_override=body.lead_time_mean,
            lead_time_std_override=body.lead_time_std,
            service_level_override=body.service_level,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return RestockWhatIfResponse(result=RestockRecommendationDetailOut(**_row_to_out(row).model_dump()))


# --- Export CSV (authenticated) ---


@router.get("/export/csv")
def export_csv(
    days: int = Query(30, ge=7, le=90),
    marketplace: str = Query("US"),
    supplier_id: int | None = Query(None),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> StreamingResponse:
    """Export PO suggestions as CSV. Authenticated."""
    logger.info(
        "restock_advanced: export csv marketplace=%s days=%s supplier_id=%s user_id=%s",
        marketplace,
        days,
        supplier_id,
        user.id,
    )
    try:
        rows = list_recommendations(db, marketplace, days=days, supplier_id=supplier_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow([
        "supplier",
        "sku",
        "marketplace",
        "recommended_units_rounded",
        "pack_size",
        "moq",
        "notes_flags",
    ])
    for r in rows:
        writer.writerow([
            r.supplier_name or "",
            r.sku,
            r.marketplace_code,
            int(r.recommended_order_units_rounded),
            getattr(r, "pack_size_units", 1),
            getattr(r, "moq_units", 0),
            json.dumps(r.reason_flags) if r.reason_flags else "",
        ])
    buf.seek(0)
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=restock_po_suggestions.csv"},
    )
