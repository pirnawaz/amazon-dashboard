"""Admin SP-API: owner-only ping using DB-stored encrypted refresh token (Phase 10.1c)."""
from __future__ import annotations

import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.api.deps.permissions import require_owner
from app.api.routes.amazon import _get_credential_for_connection, _get_single_connection
from app.core.crypto import TokenEncryptionError, decrypt_token
from app.db.session import get_db
from app.integrations.amazon_spapi import SpApiClient, SpApiClientError
from app.models.amazon_connection import AmazonConnection
from app.models.user import User
from app.services.audit_log import write_audit_log

logger = logging.getLogger(__name__)

router = APIRouter()

# Lightweight read-only SP-API endpoint to validate auth
SPAPI_PING_PATH = "/sellers/v1/marketplaceParticipations"
MAX_ERROR_LEN = 500


class SpApiPingResponse(BaseModel):
    """POST /api/admin/amazon/spapi/ping response."""

    ok: bool = Field(..., description="True if ping succeeded")
    error: str | None = Field(None, description="Error message when ok is False")


@router.post("/admin/amazon/spapi/ping", response_model=SpApiPingResponse)
def post_admin_amazon_spapi_ping(
    user: User = Depends(require_owner),
    db: Session = Depends(get_db),
) -> SpApiPingResponse:
    """
    Run SP-API ping: load connection + credential from DB, decrypt refresh token,
    call SpApiClient with it, hit a read-only endpoint. Update connection last_check_* and audit log.
    Returns { "ok": true } on success; { "ok": false, "error": "..." } on failure.
    """
    conn = _get_single_connection(db)
    if conn is None:
        logger.info("spapi_ping_skipped", extra={"reason": "no_connection"})
        write_audit_log(
            db,
            actor_user_id=user.id,
            action="amazon.spapi.ping",
            resource_type="amazon_connection",
            resource_id="global",
            metadata={"ok": False, "error_summary": "Connection or credential missing"},
        )
        db.commit()
        return JSONResponse(
            status_code=status.HTTP_409_CONFLICT,
            content={"ok": False, "error": "No Amazon connection. Create a connection and store a refresh token first."},
        )
    cred = _get_credential_for_connection(db, conn.id)
    if cred is None or not cred.has_refresh_token:
        logger.info("spapi_ping_skipped", extra={"reason": "no_credential_or_token", "connection_id": conn.id})
        write_audit_log(
            db,
            actor_user_id=user.id,
            action="amazon.spapi.ping",
            resource_type="amazon_connection",
            resource_id="global",
            metadata={"ok": False, "error_summary": "Connection or credential missing"},
        )
        db.commit()
        return JSONResponse(
            status_code=status.HTTP_409_CONFLICT,
            content={"ok": False, "error": "No credential or refresh token. Save a credential with a refresh token first."},
        )

    try:
        decrypted = decrypt_token(cred.lwa_refresh_token_encrypted or "")
    except TokenEncryptionError as e:
        safe_msg = str(e)[:MAX_ERROR_LEN]
        _update_connection_check(db, conn, ok=False, error_msg=safe_msg)
        write_audit_log(
            db,
            actor_user_id=user.id,
            action="amazon.spapi.ping",
            resource_type="amazon_connection",
            resource_id="global",
            metadata={"ok": False, "error_summary": "Decrypt failed"},
        )
        db.commit()
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={"ok": False, "error": safe_msg},
        )

    try:
        client = SpApiClient(refresh_token=decrypted)
        resp = client.request("GET", SPAPI_PING_PATH)
        if resp.status_code == 200:
            _update_connection_check(db, conn, ok=True, error_msg=None)
            write_audit_log(
                db,
                actor_user_id=user.id,
                action="amazon.spapi.ping",
                resource_type="amazon_connection",
                resource_id="global",
                metadata={"ok": True},
            )
            db.commit()
            return SpApiPingResponse(ok=True)
        # Non-200 from SP-API (client does not retry 4xx)
        err_msg = (resp.text or f"HTTP {resp.status_code}")[:MAX_ERROR_LEN]
        _update_connection_check(db, conn, ok=False, error_msg=err_msg)
        write_audit_log(
            db,
            actor_user_id=user.id,
            action="amazon.spapi.ping",
            resource_type="amazon_connection",
            resource_id="global",
            metadata={"ok": False, "error_summary": err_msg[:200]},
        )
        db.commit()
        return JSONResponse(
            status_code=status.HTTP_502_BAD_GATEWAY,
            content={"ok": False, "error": err_msg},
        )
    except SpApiClientError as e:
        err_msg = (e.response_body or (e.args[0] if e.args else None) or "SP-API request failed")[:MAX_ERROR_LEN]
        _update_connection_check(db, conn, ok=False, error_msg=err_msg)
        write_audit_log(
            db,
            actor_user_id=user.id,
            action="amazon.spapi.ping",
            resource_type="amazon_connection",
            resource_id="global",
            metadata={"ok": False, "error_summary": err_msg[:200]},
        )
        db.commit()
        return JSONResponse(
            status_code=status.HTTP_502_BAD_GATEWAY,
            content={"ok": False, "error": err_msg},
        )
    except Exception as e:
        err_msg = str(e)[:MAX_ERROR_LEN]
        _update_connection_check(db, conn, ok=False, error_msg=err_msg)
        logger.exception("spapi_ping_error")
        write_audit_log(
            db,
            actor_user_id=user.id,
            action="amazon.spapi.ping",
            resource_type="amazon_connection",
            resource_id="global",
            metadata={"ok": False, "error_summary": err_msg[:200]},
        )
        db.commit()
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={"ok": False, "error": err_msg},
        )


def _update_connection_check(
    db: Session,
    conn: AmazonConnection,
    ok: bool,
    error_msg: str | None,
) -> None:
    now = datetime.now(timezone.utc)
    conn.last_check_at = now
    conn.last_check_ok = ok
    conn.last_check_error = error_msg
    conn.updated_at = now
    db.flush()
