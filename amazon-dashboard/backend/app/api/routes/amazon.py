"""Amazon SP-API connection tracking API (Phase 9.2). Owner-only endpoints."""
from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps.account_context import resolve_amazon_account_id
from app.api.deps.permissions import require_owner
from app.core.crypto import TokenEncryptionError, encrypt_token
from app.db.session import get_db
from app.models.amazon_connection import AmazonConnection, AmazonCredential, ConnectionStatus
from app.models.user import User
from app.schemas.amazon import (
    AmazonConnectionCheckResponse,
    AmazonConnectionResponse,
    AmazonConnectionUpsertRequest,
    AmazonCredentialSafeResponse,
    AmazonCredentialUpsertRequest,
)
from app.services.audit_log import write_audit_log
from app.services.inventory_service import freshness_from_timestamp

router = APIRouter(prefix="/amazon", tags=["amazon"])


def _get_single_connection(db: Session, amazon_account_id: int | None = None) -> AmazonConnection | None:
    """Return connection for account; when amazon_account_id omitted, first row (backward compatible)."""
    q = select(AmazonConnection).order_by(AmazonConnection.id).limit(1)
    if amazon_account_id is not None:
        q = q.where(AmazonConnection.amazon_account_id == amazon_account_id)
    return db.scalar(q)


def _get_or_create_connection(db: Session, amazon_account_id: int | None = None) -> AmazonConnection:
    """Return existing connection for account or create one (with account link when provided)."""
    conn = _get_single_connection(db, amazon_account_id)
    if conn is not None:
        return conn
    conn = AmazonConnection(status=ConnectionStatus.PENDING, amazon_account_id=amazon_account_id)
    db.add(conn)
    db.flush()
    return conn


def _get_credential_for_connection(db: Session, connection_id: int) -> AmazonCredential | None:
    """Return the first credential for the connection (single-tenant: one per connection)."""
    return db.scalar(
        select(AmazonCredential).where(AmazonCredential.connection_id == connection_id).limit(1)
    )


def _connection_to_response(conn: AmazonConnection) -> AmazonConnectionResponse:
    # Phase 11.4: compute inventory sync freshness from last_inventory_sync_at
    sync_freshness, sync_age_hours = freshness_from_timestamp(conn.last_inventory_sync_at)
    return AmazonConnectionResponse(
        id=conn.id,
        created_at=conn.created_at,
        updated_at=conn.updated_at,
        status=conn.status,
        last_success_at=conn.last_success_at,
        last_error_at=conn.last_error_at,
        last_error_message=conn.last_error_message,
        marketplaces_json=conn.marketplaces_json,
        seller_identifier=conn.seller_identifier,
        last_check_at=conn.last_check_at,
        last_check_ok=conn.last_check_ok,
        last_check_error=conn.last_check_error,
        last_orders_sync_at=conn.last_orders_sync_at,
        last_orders_sync_status=conn.last_orders_sync_status,
        last_orders_sync_error=conn.last_orders_sync_error,
        last_orders_sync_orders_count=conn.last_orders_sync_orders_count,
        last_orders_sync_items_count=conn.last_orders_sync_items_count,
        last_inventory_sync_at=conn.last_inventory_sync_at,
        last_inventory_sync_status=conn.last_inventory_sync_status,
        last_inventory_sync_error=conn.last_inventory_sync_error,
        last_inventory_sync_items_count=conn.last_inventory_sync_items_count,
        last_inventory_sync_age_hours=sync_age_hours,
        last_inventory_sync_freshness=sync_freshness,
    )


def _credential_to_safe_response(cred: AmazonCredential) -> AmazonCredentialSafeResponse:
    return AmazonCredentialSafeResponse(
        id=cred.id,
        created_at=cred.created_at,
        updated_at=cred.updated_at,
        connection_id=cred.connection_id,
        note=cred.note,
        has_refresh_token=cred.has_refresh_token,
    )


@router.get("/connection", response_model=AmazonConnectionResponse | None)
def get_connection(
    user: User = Depends(require_owner),
    db: Session = Depends(get_db),
    amazon_account_id: int | None = Depends(resolve_amazon_account_id),
) -> AmazonConnectionResponse | None:
    """Return the single Amazon connection row or null (owner only). Respects X-Amazon-Account-Id."""
    conn = _get_single_connection(db, amazon_account_id)
    if conn is None:
        return None
    return _connection_to_response(conn)


@router.put("/connection", response_model=AmazonConnectionResponse)
def put_connection(
    body: AmazonConnectionUpsertRequest,
    user: User = Depends(require_owner),
    db: Session = Depends(get_db),
    amazon_account_id: int | None = Depends(resolve_amazon_account_id),
) -> AmazonConnectionResponse:
    """Upsert the single Amazon connection. Accept status, seller_identifier, marketplaces_json (owner only). Respects X-Amazon-Account-Id."""
    conn = _get_or_create_connection(db, amazon_account_id)
    patch = body.model_dump(exclude_unset=True)
    if "status" in patch:
        conn.status = patch["status"]
    if "seller_identifier" in patch:
        conn.seller_identifier = patch["seller_identifier"]
    if "marketplaces_json" in patch:
        conn.marketplaces_json = patch["marketplaces_json"]
    conn.updated_at = datetime.now(timezone.utc)
    db.flush()
    write_audit_log(
        db,
        actor_user_id=user.id,
        action="amazon_connection.upsert",
        resource_type="amazon_connection",
        resource_id="global",
    )
    db.commit()
    return _connection_to_response(conn)


@router.get("/credential", response_model=AmazonCredentialSafeResponse | None)
def get_credential(
    user: User = Depends(require_owner),
    db: Session = Depends(get_db),
    amazon_account_id: int | None = Depends(resolve_amazon_account_id),
) -> AmazonCredentialSafeResponse | None:
    """Return the single Amazon credential (safe). Never returns token (owner only). Respects X-Amazon-Account-Id."""
    conn = _get_single_connection(db, amazon_account_id)
    if conn is None:
        return None
    cred = _get_credential_for_connection(db, conn.id)
    if cred is None:
        return None
    return _credential_to_safe_response(cred)


@router.put("/credential", response_model=AmazonCredentialSafeResponse)
def put_credential(
    body: AmazonCredentialUpsertRequest,
    user: User = Depends(require_owner),
    db: Session = Depends(get_db),
    amazon_account_id: int | None = Depends(resolve_amazon_account_id),
) -> AmazonCredentialSafeResponse:
    """Upsert Amazon credential for the connection. Token is never returned (owner only). Respects X-Amazon-Account-Id."""
    conn = _get_single_connection(db, amazon_account_id)
    if conn is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No Amazon connection. Create one with PUT /api/amazon/connection first.",
        )
    cred = _get_credential_for_connection(db, conn.id)
    if cred is None:
        cred = AmazonCredential(connection_id=conn.id)
        db.add(cred)
        db.flush()
    patch = body.model_dump(exclude_unset=True)
    if "lwa_refresh_token_encrypted" in patch:
        raw = patch["lwa_refresh_token_encrypted"]
        if raw is None or (isinstance(raw, str) and not raw.strip()):
            cred.lwa_refresh_token_encrypted = None
        else:
            plaintext = str(raw).strip()
            try:
                cred.lwa_refresh_token_encrypted = encrypt_token(plaintext)
            except TokenEncryptionError as e:
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail=str(e),
                ) from e
    if "note" in patch:
        cred.note = patch["note"]
    cred.updated_at = datetime.now(timezone.utc)
    db.flush()
    write_audit_log(
        db,
        actor_user_id=user.id,
        action="amazon_credential.upsert",
        resource_type="amazon_credential",
        resource_id="global",
        metadata={"connection_id": conn.id, "credential_id": cred.id},
    )
    db.commit()
    return _credential_to_safe_response(cred)


@router.post("/connection/check", response_model=AmazonConnectionCheckResponse)
def post_connection_check(
    user: User = Depends(require_owner),
    db: Session = Depends(get_db),
    amazon_account_id: int | None = Depends(resolve_amazon_account_id),
) -> AmazonConnectionCheckResponse:
    """Placeholder health check: set connection status from credential token presence (owner only). Respects X-Amazon-Account-Id."""
    conn = _get_or_create_connection(db, amazon_account_id)
    cred = _get_credential_for_connection(db, conn.id)
    has_token = cred is not None and cred.has_refresh_token
    now = datetime.now(timezone.utc)
    if has_token:
        conn.status = ConnectionStatus.ACTIVE
        conn.last_success_at = now
        conn.last_error_at = None
        conn.last_error_message = None
    else:
        conn.status = ConnectionStatus.ERROR
        conn.last_error_at = now
        conn.last_error_message = "Missing refresh token"
    conn.updated_at = now
    db.flush()
    write_audit_log(
        db,
        actor_user_id=user.id,
        action="amazon_connection.check",
        resource_type="amazon_connection",
        resource_id="global",
        metadata={"result_status": conn.status.value},
    )
    db.commit()
    return AmazonConnectionCheckResponse(status=conn.status)
