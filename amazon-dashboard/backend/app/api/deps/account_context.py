"""Sprint 18: Resolve X-Amazon-Account-Id header to account id; default to active account when omitted."""
from __future__ import annotations

import logging
from typing import Annotated

from fastapi import Depends, Header, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.amazon_account import AmazonAccount

logger = logging.getLogger(__name__)

HEADER_AMAZON_ACCOUNT_ID = "x-amazon-account-id"


def get_resolved_amazon_account_id(
    request: Request,
    x_amazon_account_id: Annotated[str | None, Header(alias=HEADER_AMAZON_ACCOUNT_ID)] = None,
    db: Session | None = None,
) -> int | None:
    """
    Resolve account context from X-Amazon-Account-Id header.
    If omitted, returns the first active account id (default). If header present and valid, returns that id.
    Returns None if no accounts exist.
    """
    if db is None:
        return None
    if x_amazon_account_id is not None and x_amazon_account_id.strip():
        try:
            aid = int(x_amazon_account_id.strip())
            row = db.scalar(select(AmazonAccount).where(AmazonAccount.id == aid, AmazonAccount.is_active.is_(True)))
            if row is not None:
                return row.id
            logger.debug("amazon_account_id from header not found or inactive: %s", aid)
        except ValueError:
            logger.debug("invalid X-Amazon-Account-Id: %s", x_amazon_account_id)
    # Default: first active account
    row = db.scalar(select(AmazonAccount).where(AmazonAccount.is_active.is_(True)).order_by(AmazonAccount.id).limit(1))
    if row is not None:
        return row.id
    return None


def resolve_amazon_account_id(
    request: Request,
    x_amazon_account_id: Annotated[str | None, Header(alias=HEADER_AMAZON_ACCOUNT_ID)] = None,
    db: Session = Depends(get_db),
) -> int | None:
    """FastAPI dependency: returns resolved amazon_account_id (from header or default active)."""
    return get_resolved_amazon_account_id(request, x_amazon_account_id, db)
