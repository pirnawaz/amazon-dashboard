"""Pydantic schemas for SKU mapping and unmapped SKU API (Phase 12.1). Phase 12.4: import + suggestions."""
from __future__ import annotations

from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field


# --- Status values for mapping ---
SKU_MAPPING_STATUS_PENDING = "pending"
SKU_MAPPING_STATUS_CONFIRMED = "confirmed"
SKU_MAPPING_STATUS_IGNORED = "ignored"
SKU_MAPPING_STATUS_DISCONTINUED = "discontinued"

SKU_MAPPING_STATUSES = (
    SKU_MAPPING_STATUS_PENDING,
    SKU_MAPPING_STATUS_CONFIRMED,
    SKU_MAPPING_STATUS_IGNORED,
    SKU_MAPPING_STATUS_DISCONTINUED,
)


# --- SkuMapping ---
class SkuMappingBase(BaseModel):
    """Base fields for SKU mapping."""

    sku: str = Field(..., min_length=1, max_length=255)
    marketplace_code: str = Field(..., min_length=1, max_length=20)
    asin: str | None = Field(None, max_length=20)
    fnsku: str | None = Field(None, max_length=255)
    product_id: int | None = None
    status: str = Field(default=SKU_MAPPING_STATUS_PENDING, max_length=50)
    notes: str | None = None


class SkuMappingCreate(BaseModel):
    """Payload to create or upsert a mapping (sku + marketplace_code required)."""

    sku: str = Field(..., min_length=1, max_length=255)
    marketplace_code: str = Field(..., min_length=1, max_length=20)
    asin: str | None = Field(None, max_length=20)
    fnsku: str | None = Field(None, max_length=255)
    product_id: int | None = None
    status: str = Field(default=SKU_MAPPING_STATUS_PENDING, max_length=50)
    notes: str | None = None


class SkuMappingUpdate(BaseModel):
    """Payload to patch a mapping (all optional)."""

    asin: str | None = Field(None, max_length=20)
    fnsku: str | None = Field(None, max_length=255)
    product_id: int | None = None
    status: str | None = Field(None, max_length=50)
    notes: str | None = None


class SkuMappingOut(BaseModel):
    """Full mapping row for API response."""

    id: int
    sku: str
    marketplace_code: str
    asin: str | None
    fnsku: str | None
    product_id: int | None
    status: str
    notes: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# --- Unmapped SKU detection result ---
class UnmappedSkuRow(BaseModel):
    """One unmapped (sku, marketplace_code) with source flags and counts."""

    sku: str
    marketplace_code: str
    seen_in_orders: bool
    seen_in_inventory: bool
    order_item_count: int
    inventory_row_count: int
    last_seen_date: date | datetime | None
    suggested_asin: str | None = None


class UnmappedSkuResponse(BaseModel):
    """Paginated list of unmapped SKUs."""

    total: int
    items: list[UnmappedSkuRow]


# --- Product search (dropdown) ---
class ProductSearchHit(BaseModel):
    """Minimal product for dropdown: id, title, sku."""

    id: int
    title: str
    sku: str | None = None

    model_config = {"from_attributes": True}


class ProductSearchResponse(BaseModel):
    """List of product search hits (limit 20–50)."""

    items: list[ProductSearchHit]


# --- List mappings response ---
class SkuMappingListResponse(BaseModel):
    """Paginated list of SKU mappings."""

    total: int
    items: list[SkuMappingOut]


# --- Phase 12.4: CSV import response ---
class SkuMappingImportErrorRow(BaseModel):
    """One validation/import error for a CSV row."""

    row_number: int
    sku: str | None = None
    marketplace_code: str | None = None
    error: str


class SkuMappingImportResponse(BaseModel):
    """Response for POST /admin/catalog/sku-mappings/import."""

    total_rows: int = 0
    created: int = 0
    updated: int = 0
    errors: list[SkuMappingImportErrorRow] = Field(default_factory=list)
    dry_run: bool = False


# --- Phase 12.4: Unmapped suggestions ---
class SuggestedProduct(BaseModel):
    """Suggested product for an unmapped SKU."""

    id: int
    sku: str | None = None
    title: str = ""


class UnmappedSkuWithSuggestion(BaseModel):
    """Unmapped row plus optional suggestion."""

    sku: str
    marketplace_code: str
    seen_in_orders: bool
    seen_in_inventory: bool
    order_item_count: int
    inventory_row_count: int
    last_seen_date: date | datetime | None
    suggested_asin: str | None = None
    suggested_product: SuggestedProduct | None = None
    suggestion_reason: Literal["sku_exact_match", "asin_match"] | None = None


class UnmappedSuggestionsResponse(BaseModel):
    """Response for GET /admin/catalog/unmapped-skus/suggestions."""

    total: int
    items: list[UnmappedSkuWithSuggestion]
