"""Admin Amazon inventory: sync (Phase 11.1 + 11.2) and bridge (Phase 11.3)."""
from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Body, Depends, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.api.deps.permissions import require_owner
from app.api.routes.amazon import _get_single_connection
from app.core.crypto import TokenEncryptionError
from app.db.session import get_db
from app.models.user import User
from app.services.amazon_inventory_sync import run_inventory_sync
from app.services.inventory_bridge import run_inventory_bridge

router = APIRouter()


class InventorySyncRequest(BaseModel):
    """Optional body for POST /api/admin/amazon/inventory/sync."""

    dry_run: bool = Field(False, description="If true, stub only (no DB writes for items)")

class InventorySyncResponse(BaseModel):
    """POST /api/admin/amazon/inventory/sync response."""

    status: str = Field(..., description="running | ok | error (after run)")
    items_upserted: int = Field(..., description="Number of items upserted")
    last_inventory_sync_at: datetime | None = Field(None, description="Last successful sync time")
    last_inventory_sync_error: str | None = Field(None, description="Last error if failed")
    error: str | None = Field(None, description="Error message when request failed")


@router.post("/admin/amazon/inventory/sync", response_model=InventorySyncResponse)
def post_admin_amazon_inventory_sync(
    user: User = Depends(require_owner),
    db: Session = Depends(get_db),
    body: InventorySyncRequest | None = Body(None, embed=False),
) -> InventorySyncResponse | JSONResponse:
    """
    Trigger inventory sync for the single-tenant connection (Phase 11.2: real SP-API FBA).
    dry_run=true: call SP-API and count rows, do not upsert. Returns 503 if TOKEN_ENCRYPTION_KEY missing.
    """
    conn = _get_single_connection(db)
    if conn is None:
        return JSONResponse(
            status_code=status.HTTP_409_CONFLICT,
            content={
                "status": "error",
                "items_upserted": 0,
                "last_inventory_sync_at": None,
                "last_inventory_sync_error": None,
                "error": "No Amazon connection. Create a connection first.",
            },
        )
    dry_run = body.dry_run if body is not None else False
    try:
        run_inventory_sync(db, conn, actor_user_id=user.id, dry_run=dry_run)
    except TokenEncryptionError as e:
        db.rollback()
        err_msg = str(e)[:500]
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={
                "status": "error",
                "items_upserted": 0,
                "last_inventory_sync_at": None,
                "last_inventory_sync_error": err_msg,
                "error": "Token decryption failed. Ensure TOKEN_ENCRYPTION_KEY is set.",
            },
        )
    except Exception as e:
        db.commit()
        db.refresh(conn)
        err_msg = str(e)[:500]
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content={
                "status": conn.last_inventory_sync_status or "error",
                "items_upserted": conn.last_inventory_sync_items_count or 0,
                "last_inventory_sync_at": conn.last_inventory_sync_at.isoformat() if conn.last_inventory_sync_at else None,
                "last_inventory_sync_error": conn.last_inventory_sync_error,
                "error": err_msg,
            },
        )
    db.commit()
    db.refresh(conn)
    return InventorySyncResponse(
        status=conn.last_inventory_sync_status or "ok",
        items_upserted=conn.last_inventory_sync_items_count or 0,
        last_inventory_sync_at=conn.last_inventory_sync_at,
        last_inventory_sync_error=conn.last_inventory_sync_error,
        error=None,
    )


class InventoryBridgeResponse(BaseModel):
    """POST /api/admin/amazon/inventory/bridge response (Phase 11.3)."""

    upserted: int = Field(..., description="Rows upserted into inventory_levels")
    skipped: int = Field(..., description="Rows skipped (e.g. missing sku)")
    errors: int = Field(..., description="Rows that failed")
    error_summary: str | None = Field(None, description="First few error messages if any")


@router.post("/admin/amazon/inventory/bridge", response_model=InventoryBridgeResponse)
def post_admin_amazon_inventory_bridge(
    user: User = Depends(require_owner),
    db: Session = Depends(get_db),
) -> InventoryBridgeResponse | JSONResponse:
    """
    Bridge amazon_inventory_item into inventory_levels (Phase 11.3).
    Manual invocation; run after inventory sync to populate internal inventory for restock/forecast.
    """
    conn = _get_single_connection(db)
    if conn is None:
        return JSONResponse(
            status_code=status.HTTP_409_CONFLICT,
            content={
                "upserted": 0,
                "skipped": 0,
                "errors": 0,
                "error_summary": "No Amazon connection. Create a connection first.",
            },
        )
    result = run_inventory_bridge(db, conn, actor_user_id=user.id)
    db.commit()
    return InventoryBridgeResponse(
        upserted=result["upserted"],
        skipped=result["skipped"],
        errors=result["errors"],
        error_summary=result.get("error_summary"),
    )
