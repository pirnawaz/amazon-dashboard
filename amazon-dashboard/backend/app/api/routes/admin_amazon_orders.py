"""Admin Amazon orders: owner-only orders sync (Phase 10.2 + 10.3)."""
from __future__ import annotations

from fastapi import APIRouter, Body, Depends, Query, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.api.deps.permissions import require_owner
from app.api.routes.amazon import _get_single_connection
from app.db.session import get_db
from app.models.user import User
from app.services.amazon_orders_sync import run_orders_sync

router = APIRouter()


class OrdersSyncRequest(BaseModel):
    """Optional body for POST /api/admin/amazon/orders/sync."""

    dry_run: bool = Field(False, description="If true, skip SP-API calls (stub only)")
    include_items: bool = Field(False, description="If true and dry_run=false, run order items sync after orders sync")


class OrdersSyncResponse(BaseModel):
    """POST /api/admin/amazon/orders/sync response."""

    ok: bool = Field(..., description="True if sync job ran successfully")


@router.post("/admin/amazon/orders/sync", response_model=OrdersSyncResponse)
def post_admin_amazon_orders_sync(
    user: User = Depends(require_owner),
    db: Session = Depends(get_db),
    dry_run: bool = Query(False, description="If true, skip SP-API calls"),
    include_items: bool = Query(False, description="If true and dry_run=false, run order items sync"),
    body: OrdersSyncRequest | None = Body(None, embed=False),
) -> OrdersSyncResponse:
    """
    Trigger orders sync for the single-tenant connection.
    dry_run=true: stub only (no SP-API). dry_run=false: real sync (default).
    include_items=true and dry_run=false: run order items sync after orders sync (default false).
    Body overrides query params if provided.
    """
    conn = _get_single_connection(db)
    if conn is None:
        return JSONResponse(
            status_code=status.HTTP_409_CONFLICT,
            content={"ok": False, "error": "No Amazon connection. Create a connection first."},
        )
    use_dry_run = body.dry_run if body is not None else dry_run
    use_include_items = body.include_items if body is not None else include_items
    run_orders_sync(db, conn, dry_run=use_dry_run, include_items=use_include_items)
    db.commit()
    return OrdersSyncResponse(ok=True)
