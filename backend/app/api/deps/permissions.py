"""Owner-only permission dependency. Uses DB role, not JWT claim."""
from __future__ import annotations

import logging

from fastapi import Depends, HTTPException, Request, status

from app.api.routes.me import get_current_user
from app.models.user import User, UserRole

logger = logging.getLogger(__name__)


def require_owner(
    request: Request,
    current_user: User = Depends(get_current_user),
) -> User:
    """Reusable dependency: raise 403 if current_user.role is not owner. Uses DB role, not JWT claim."""
    if current_user.role != UserRole.OWNER:
        logger.warning(
            "Owner access required: user_id=%s role=%s endpoint=%s",
            current_user.id,
            getattr(current_user.role, "value", current_user.role),
            request.url.path,
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Owner access required",
        )
    return current_user
