"""Sprint 18: Permission dependencies. Delegates to app.core.permissions; uses DB role."""
from __future__ import annotations

from fastapi import Depends, Request

from app.api.routes.me import get_current_user
from app.core.permissions import (
    require_can_trigger_sync as _require_can_trigger_sync,
    require_not_viewer as _require_not_viewer,
    require_owner as _require_owner,
)
from app.models.user import User


def require_owner(
    request: Request,
    current_user: User = Depends(get_current_user),
) -> User:
    """Reusable dependency: raise 403 if not owner. Owner: full access, manages integrations and users."""
    return _require_owner(current_user, request)


def require_not_viewer(
    request: Request,
    current_user: User = Depends(get_current_user),
) -> User:
    """Reusable dependency: raise 403 if viewer. Blocks edits; owner and partner may proceed."""
    return _require_not_viewer(current_user, request)


def require_can_trigger_sync(
    request: Request,
    current_user: User = Depends(get_current_user),
) -> User:
    """Reusable dependency: raise 403 if viewer. Owner and partner may trigger sync."""
    return _require_can_trigger_sync(current_user, request)
