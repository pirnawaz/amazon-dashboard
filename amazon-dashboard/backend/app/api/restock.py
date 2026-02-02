"""Restock Plan API: POST /api/restock/plan."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.routes.forecast_restock import _validate_marketplace
from app.api.routes.me import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.restock import RestockPlanRequest, RestockPlanResponse
from app.services.inventory_service import get_on_hand_for_restock
from app.services.restock import compute_restock_plan

router = APIRouter(prefix="/restock", tags=["Restock"])


@router.post("/plan", response_model=RestockPlanResponse)
def restock_plan(
    body: RestockPlanRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> RestockPlanResponse:
    """
    Compute a restock plan for a SKU in a marketplace.

    Uses Sprint 6 forecasting (seasonal naive weekly) for average daily demand,
    backtest for MAPE, and a z-score-based safety stock formula:
    safety_stock = z * sqrt(avg_daily_demand * lead_time_days).
    """
    _validate_marketplace(db, body.marketplace)
    current_inventory = body.current_inventory
    no_inventory_data = False
    inventory_source: str | None = None
    if current_inventory is None:
        on_hand, inv_source, _ = get_on_hand_for_restock(db, body.sku, body.marketplace)
        current_inventory = int(on_hand)
        inventory_source = inv_source
        if inv_source is None:
            no_inventory_data = True
    try:
        result = compute_restock_plan(
            db=db,
            sku=body.sku,
            marketplace=body.marketplace,
            lead_time_days=body.lead_time_days,
            service_level=body.service_level,
            current_inventory=current_inventory,
            include_unmapped=body.include_unmapped,
        )
        result["no_inventory_data"] = no_inventory_data
        result["inventory_source"] = inventory_source
        return RestockPlanResponse(**result)
    except ValueError as e:
        msg = str(e)
        if "not found" in msg.lower():
            raise HTTPException(status_code=404, detail=msg)
        raise HTTPException(status_code=400, detail=msg)
