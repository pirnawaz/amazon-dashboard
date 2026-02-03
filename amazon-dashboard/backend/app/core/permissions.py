"""Sprint 18: Explicit permission checks (owner / partner / viewer). Uses DB role, not JWT claim."""
from __future__ import annotations

import logging
from typing import TYPE_CHECKING

from fastapi import HTTPException, Request, status

if TYPE_CHECKING:
    from app.models.user import User

from app.models.user import UserRole

logger = logging.getLogger(__name__)


def require_owner(user: "User", request: Request | None = None) -> "User":
    """Raise 403 if user is not owner. Owner: full access, manages integrations, manages users/roles."""
    if user.role != UserRole.OWNER:
        _log_permission_denied(user, request, "owner", "require_owner")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Owner access required. You don't have permission to perform this action.",
        )
    return user


def require_not_viewer(user: "User", request: Request | None = None) -> "User":
    """Raise 403 if user is viewer. Blocks edits; owner and partner may proceed."""
    if user.role == UserRole.VIEWER:
        _log_permission_denied(user, request, "not_viewer", "viewer is read-only")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Viewer is read-only. You don't have permission to edit or trigger actions.",
        )
    return user


def can_trigger_sync(user: "User") -> bool:
    """True if user may trigger sync (Orders, Ads). Owner and partner yes; viewer no."""
    return user.role in (UserRole.OWNER, UserRole.PARTNER)


def require_can_trigger_sync(user: "User", request: Request | None = None) -> "User":
    """Raise 403 if user cannot trigger sync (e.g. viewer)."""
    if not can_trigger_sync(user):
        _log_permission_denied(user, request, "can_trigger_sync", "viewer cannot trigger sync")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to trigger sync. Viewer is read-only.",
        )
    return user


def _log_permission_denied(
    user: "User",
    request: Request | None,
    check: str,
    reason: str,
) -> None:
    """Structured log for permission failures."""
    extra = {
        "user_id": user.id,
        "user_email": getattr(user, "email", None),
        "role": getattr(user.role, "value", str(user.role)),
        "permission_check": check,
        "reason": reason,
    }
    if request is not None:
        extra["endpoint"] = getattr(request, "url", None) and getattr(request.url, "path", None)
    logger.warning("Permission denied: %s", reason, extra=extra)
