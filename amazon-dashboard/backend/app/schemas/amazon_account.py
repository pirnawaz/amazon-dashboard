"""Sprint 18: Amazon account schemas (multi-account groundwork)."""
from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class AmazonAccountBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255, description="Friendly label e.g. Main US Account")
    is_active: bool = Field(True, description="If false, soft-deleted / hidden")


class AmazonAccountCreate(AmazonAccountBase):
    pass


class AmazonAccountUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=255)
    is_active: bool | None = None


class AmazonAccountResponse(BaseModel):
    id: int
    name: str
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
