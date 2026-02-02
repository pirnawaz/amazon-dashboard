"""Pydantic schemas for Amazon SP-API connection and credential (Phase 9)."""
from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field

from app.models.amazon_connection import ConnectionStatus


# ----- Connection -----


class AmazonConnectionBase(BaseModel):
    """Base fields for connection (create/update)."""

    status: ConnectionStatus | None = Field(None, description="Connection status")
    last_success_at: datetime | None = Field(None, description="Last successful SP-API call")
    last_error_at: datetime | None = Field(None, description="Last error time")
    last_error_message: str | None = Field(None, description="Last error message")
    marketplaces_json: dict[str, Any] | None = Field(None, description="Marketplace IDs for multi-marketplace")
    seller_identifier: str | None = Field(None, description="Seller ID from SP-API")
    last_check_at: datetime | None = Field(None, description="When SP-API ping was last run")
    last_check_ok: bool | None = Field(None, description="True if last ping succeeded")
    last_check_error: str | None = Field(None, description="Last ping error message if failed")
    last_orders_sync_at: datetime | None = Field(None, description="When orders sync last completed successfully")
    last_orders_sync_status: str | None = Field(None, description="running | ok | error")
    last_orders_sync_error: str | None = Field(None, description="Last orders sync error if failed")
    last_orders_sync_orders_count: int | None = Field(None, description="Orders synced in last run")
    last_orders_sync_items_count: int | None = Field(None, description="Order items synced in last run")
    last_inventory_sync_at: datetime | None = Field(None, description="When inventory sync last completed successfully")
    last_inventory_sync_status: str | None = Field(None, description="never | running | ok | error")
    last_inventory_sync_error: str | None = Field(None, description="Last inventory sync error if failed")
    last_inventory_sync_items_count: int | None = Field(None, description="Inventory items upserted in last run")


class AmazonConnectionCreate(AmazonConnectionBase):
    """Create connection (single-tenant: typically one row)."""

    status: ConnectionStatus = Field(ConnectionStatus.PENDING, description="Initial status")


class AmazonConnectionUpdate(BaseModel):
    """Partial update for connection."""

    status: ConnectionStatus | None = None
    last_success_at: datetime | None = None
    last_error_at: datetime | None = None
    last_error_message: str | None = None
    marketplaces_json: dict[str, Any] | None = None
    seller_identifier: str | None = None
    last_check_at: datetime | None = None
    last_check_ok: bool | None = None
    last_check_error: str | None = None
    last_orders_sync_at: datetime | None = None
    last_orders_sync_status: str | None = None
    last_orders_sync_error: str | None = None
    last_orders_sync_orders_count: int | None = None
    last_orders_sync_items_count: int | None = None
    last_inventory_sync_at: datetime | None = None
    last_inventory_sync_status: str | None = None
    last_inventory_sync_error: str | None = None
    last_inventory_sync_items_count: int | None = None


# Phase 11.4: freshness status for inventory sync
InventorySyncFreshness = str  # "unknown" | "fresh" | "warning" | "critical"


class AmazonConnectionResponse(AmazonConnectionBase):
    """Connection as returned by API."""

    id: int = Field(..., description="Connection ID")
    created_at: datetime = Field(..., description="Created at")
    updated_at: datetime = Field(..., description="Updated at")
    status: ConnectionStatus = Field(..., description="Connection status")
    # Phase 11.4: computed from last_inventory_sync_at
    last_inventory_sync_age_hours: float | None = Field(
        None, description="Age in hours since last inventory sync; null if never synced"
    )
    last_inventory_sync_freshness: InventorySyncFreshness | None = Field(
        None, description="unknown | fresh | warning | critical"
    )

    model_config = {"from_attributes": True}


class AmazonConnectionUpsertRequest(BaseModel):
    """PUT /api/amazon/connection body: optional fields only."""

    status: ConnectionStatus | None = Field(None, description="Connection status")
    seller_identifier: str | None = Field(None, description="Seller ID from SP-API")
    marketplaces_json: dict[str, Any] | None = Field(None, description="Marketplace IDs for multi-marketplace")


# ----- Credential -----


class AmazonCredentialBase(BaseModel):
    """Base fields for credential."""

    lwa_refresh_token_encrypted: str | None = Field(None, description="Encrypted LWA refresh token")
    note: str | None = Field(None, description="Optional note")


class AmazonCredentialCreate(AmazonCredentialBase):
    """Create credential (tied to a connection)."""

    connection_id: int = Field(..., description="FK to amazon_connection.id")


class AmazonCredentialUpdate(BaseModel):
    """Partial update for credential."""

    lwa_refresh_token_encrypted: str | None = None
    note: str | None = None


class AmazonCredentialResponse(AmazonCredentialBase):
    """Credential as returned by API (token value omitted or redacted in practice)."""

    id: int = Field(..., description="Credential ID")
    created_at: datetime = Field(..., description="Created at")
    updated_at: datetime = Field(..., description="Updated at")
    connection_id: int = Field(..., description="FK to amazon_connection.id")

    model_config = {"from_attributes": True}


class AmazonCredentialUpsertRequest(BaseModel):
    """PUT /api/amazon/credential body."""

    lwa_refresh_token_encrypted: str | None = Field(None, description="Encrypted LWA refresh token (never returned)")
    note: str | None = Field(None, description="Optional note")


class AmazonCredentialSafeResponse(BaseModel):
    """Credential response: never includes token; includes has_refresh_token boolean."""

    id: int = Field(..., description="Credential ID")
    created_at: datetime = Field(..., description="Created at")
    updated_at: datetime = Field(..., description="Updated at")
    connection_id: int = Field(..., description="FK to amazon_connection.id")
    note: str | None = Field(None, description="Optional note")
    has_refresh_token: bool = Field(..., description="Whether a refresh token is stored (value never returned)")


class AmazonConnectionCheckResponse(BaseModel):
    """POST /api/amazon/connection/check response: result status."""

    status: ConnectionStatus = Field(..., description="Connection status after check")
