"""Sprint 18: Amazon accounts CRUD (owner-only). Multi-account groundwork."""
from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps.permissions import require_not_viewer, require_owner
from app.db.session import get_db
from app.models.amazon_account import AmazonAccount
from app.models.user import User
from app.schemas.amazon_account import (
    AmazonAccountCreate,
    AmazonAccountResponse,
    AmazonAccountUpdate,
)

logger = logging.getLogger(__name__)

router = APIRouter(tags=["admin", "amazon-accounts"])


@router.get("/admin/amazon-accounts", response_model=list[AmazonAccountResponse])
def list_amazon_accounts(
    user: User = Depends(require_not_viewer),
    db: Session = Depends(get_db),
    include_inactive: bool = False,
) -> list[AmazonAccountResponse]:
    """List Amazon accounts. Owner and partner may list (for selector); viewer cannot. By default only active."""
    q = select(AmazonAccount).order_by(AmazonAccount.id)
    if not include_inactive:
        q = q.where(AmazonAccount.is_active.is_(True))
    rows = db.execute(q).scalars().all()
    return [AmazonAccountResponse.model_validate(r) for r in rows]


@router.post("/admin/amazon-accounts", response_model=AmazonAccountResponse, status_code=status.HTTP_201_CREATED)
def create_amazon_account(
    body: AmazonAccountCreate,
    user: User = Depends(require_owner),
    db: Session = Depends(get_db),
) -> AmazonAccountResponse:
    """Create an Amazon account (friendly label). Owner only."""
    row = AmazonAccount(name=body.name.strip(), is_active=body.is_active)
    db.add(row)
    db.commit()
    db.refresh(row)
    logger.info("amazon_account created id=%s name=%s user_id=%s", row.id, row.name, user.id)
    return AmazonAccountResponse.model_validate(row)


@router.get("/admin/amazon-accounts/{account_id}", response_model=AmazonAccountResponse)
def get_amazon_account(
    account_id: int,
    user: User = Depends(require_owner),
    db: Session = Depends(get_db),
) -> AmazonAccountResponse:
    """Get one Amazon account by id. Owner only."""
    row = db.get(AmazonAccount, account_id)
    if not row:
        raise HTTPException(status_code=404, detail="Amazon account not found")
    return AmazonAccountResponse.model_validate(row)


@router.put("/admin/amazon-accounts/{account_id}", response_model=AmazonAccountResponse)
def update_amazon_account(
    account_id: int,
    body: AmazonAccountUpdate,
    user: User = Depends(require_owner),
    db: Session = Depends(get_db),
) -> AmazonAccountResponse:
    """Update an Amazon account. Owner only."""
    row = db.get(AmazonAccount, account_id)
    if not row:
        raise HTTPException(status_code=404, detail="Amazon account not found")
    if body.name is not None:
        row.name = body.name.strip()
    if body.is_active is not None:
        row.is_active = body.is_active
    db.commit()
    db.refresh(row)
    logger.info("amazon_account updated id=%s user_id=%s", account_id, user.id)
    return AmazonAccountResponse.model_validate(row)


@router.delete("/admin/amazon-accounts/{account_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_amazon_account(
    account_id: int,
    user: User = Depends(require_owner),
    db: Session = Depends(get_db),
) -> None:
    """Soft-delete an Amazon account (set is_active=false). Owner only."""
    row = db.get(AmazonAccount, account_id)
    if not row:
        raise HTTPException(status_code=404, detail="Amazon account not found")
    row.is_active = False
    db.commit()
    logger.info("amazon_account soft-deleted id=%s user_id=%s", account_id, user.id)
