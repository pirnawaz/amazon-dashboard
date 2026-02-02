"""Phase 12.1: Admin catalog mapping. Phase 12.4: CSV export/import, unmapped suggestions."""
from __future__ import annotations

import csv
import io
import logging
from datetime import date

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from fastapi.responses import Response
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.api.deps.permissions import require_owner
from app.db.session import get_db
from app.models.product import Product
from app.models.sku_mapping import SkuMapping
from app.models.user import User
from app.schemas.sku_mapping import (
    ProductSearchHit,
    ProductSearchResponse,
    SkuMappingCreate,
    SkuMappingImportErrorRow,
    SkuMappingImportResponse,
    SkuMappingListResponse,
    SkuMappingOut,
    SkuMappingUpdate,
    UnmappedSkuResponse,
    UnmappedSuggestionsResponse,
    UnmappedSkuWithSuggestion,
    SKU_MAPPING_STATUSES,
)
from app.services.catalog_mapping import (
    LEAVE_UNCHANGED,
    get_sku_mapping_by_id,
    get_sku_mapping_by_sku_marketplace,
    get_unmapped_skus,
    get_unmapped_skus_with_suggestions,
    list_sku_mappings,
    update_sku_mapping,
    upsert_sku_mapping,
)

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/admin/catalog/unmapped-skus", response_model=UnmappedSkuResponse)
def list_unmapped_skus(
    marketplace_code: str | None = Query(default=None, description="Filter by marketplace code"),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    user: User = Depends(require_owner),
    db: Session = Depends(get_db),
) -> UnmappedSkuResponse:
    """List unmapped (sku, marketplace_code) from order items and inventory levels (deduped)."""
    total, items = get_unmapped_skus(db, marketplace_code=marketplace_code, limit=limit, offset=offset)
    return UnmappedSkuResponse(total=total, items=items)


@router.get("/admin/catalog/sku-mappings", response_model=SkuMappingListResponse)
def list_sku_mappings_route(
    marketplace_code: str | None = Query(default=None),
    status: str | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    user: User = Depends(require_owner),
    db: Session = Depends(get_db),
) -> SkuMappingListResponse:
    """List existing SKU mappings with optional filters and pagination."""
    total, rows = list_sku_mappings(
        db,
        marketplace_code=marketplace_code,
        status=status,
        limit=limit,
        offset=offset,
    )
    items = [
        SkuMappingOut(
            id=r.id,
            sku=r.sku,
            marketplace_code=r.marketplace_code,
            asin=r.asin,
            fnsku=r.fnsku,
            product_id=r.product_id,
            status=r.status,
            notes=r.notes,
            created_at=r.created_at,
            updated_at=r.updated_at,
        )
        for r in rows
    ]
    return SkuMappingListResponse(total=total, items=items)


@router.post("/admin/catalog/sku-mappings", response_model=SkuMappingOut)
def create_or_update_sku_mapping(
    payload: SkuMappingCreate,
    user: User = Depends(require_owner),
    db: Session = Depends(get_db),
) -> SkuMappingOut:
    """Upsert a mapping by (sku, marketplace_code). Creates or updates."""
    mapping = upsert_sku_mapping(
        db,
        sku=payload.sku,
        marketplace_code=payload.marketplace_code,
        asin=payload.asin,
        fnsku=payload.fnsku,
        product_id=payload.product_id,
        status=payload.status,
        notes=payload.notes,
    )
    return SkuMappingOut(
        id=mapping.id,
        sku=mapping.sku,
        marketplace_code=mapping.marketplace_code,
        asin=mapping.asin,
        fnsku=mapping.fnsku,
        product_id=mapping.product_id,
        status=mapping.status,
        notes=mapping.notes,
        created_at=mapping.created_at,
        updated_at=mapping.updated_at,
    )


@router.patch("/admin/catalog/sku-mappings/{mapping_id}", response_model=SkuMappingOut)
def patch_sku_mapping(
    mapping_id: int,
    payload: SkuMappingUpdate,
    user: User = Depends(require_owner),
    db: Session = Depends(get_db),
) -> SkuMappingOut:
    """Update a mapping by id (partial)."""
    mapping = update_sku_mapping(
        db,
        mapping_id,
        asin=payload.asin,
        fnsku=payload.fnsku,
        product_id=payload.product_id,
        status=payload.status,
        notes=payload.notes,
    )
    if mapping is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Mapping not found")
    return SkuMappingOut(
        id=mapping.id,
        sku=mapping.sku,
        marketplace_code=mapping.marketplace_code,
        asin=mapping.asin,
        fnsku=mapping.fnsku,
        product_id=mapping.product_id,
        status=mapping.status,
        notes=mapping.notes,
        created_at=mapping.created_at,
        updated_at=mapping.updated_at,
    )


# Token in CSV to explicitly clear a nullable field (set to NULL).
CSV_NULL_TOKEN = "__NULL__"

# Max rows for CSV export; return error if exceeded.
EXPORT_MAX_ROWS = 50_000


@router.get("/admin/catalog/products/search", response_model=ProductSearchResponse)
def search_products(
    q: str = Query(..., min_length=1, description="Search query (title, SKU, or ASIN)"),
    limit: int = Query(default=25, ge=1, le=50),
    user: User = Depends(require_owner),
    db: Session = Depends(get_db),
) -> ProductSearchResponse:
    """Search products for mapping UI dropdown. Searches title, sku, asin. Returns id, title, sku."""
    pattern = f"%{q}%"
    stmt = (
        select(Product)
        .where(
            or_(
                Product.title.ilike(pattern),
                Product.sku.ilike(pattern),
                Product.asin.ilike(pattern),
            )
        )
        .order_by(Product.title)
        .limit(limit)
    )
    rows = list(db.scalars(stmt).all())
    items = [
        ProductSearchHit(id=p.id, title=p.title, sku=p.sku)
        for p in rows
    ]
    return ProductSearchResponse(items=items)


# --- Phase 12.4: CSV export ---
CSV_COLUMNS = ["sku", "marketplace_code", "status", "product_id", "asin", "fnsku", "notes"]


@router.get("/admin/catalog/sku-mappings/export")
def export_sku_mappings_csv(
    marketplace_code: str | None = Query(default=None),
    status: str | None = Query(default=None),
    include_headers: bool = Query(default=True),
    user: User = Depends(require_owner),
    db: Session = Depends(get_db),
):
    """Export SKU mappings to CSV. Owner-only. Max 50k rows; use filters if more."""
    count_stmt = select(func.count()).select_from(SkuMapping)
    if marketplace_code:
        count_stmt = count_stmt.where(SkuMapping.marketplace_code == marketplace_code)
    if status:
        count_stmt = count_stmt.where(SkuMapping.status == status)
    total = db.scalar(count_stmt) or 0
    if total > EXPORT_MAX_ROWS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Too many rows to export. Filter by marketplace/status and try again.",
        )
    _, rows = list_sku_mappings(
        db,
        marketplace_code=marketplace_code,
        status=status,
        limit=EXPORT_MAX_ROWS,
        offset=0,
    )
    buf = io.StringIO()
    writer = csv.writer(buf)
    if include_headers:
        writer.writerow(CSV_COLUMNS)
    for r in rows:
        writer.writerow([
            r.sku or "",
            r.marketplace_code or "",
            r.status or "",
            str(r.product_id) if r.product_id is not None else "",
            r.asin or "",
            r.fnsku or "",
            (r.notes or "").replace("\r", " ").replace("\n", " "),
        ])
    content = buf.getvalue().encode("utf-8")
    filename = f"sku_mappings_{date.today().isoformat()}.csv"
    return Response(
        content=content,
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# --- Phase 12.4: CSV import ---
@router.post("/admin/catalog/sku-mappings/import", response_model=SkuMappingImportResponse)
def import_sku_mappings_csv(
    file: UploadFile = File(..., description="CSV file"),
    dry_run: bool = Query(default=False, description="Validate only; do not write"),
    user: User = Depends(require_owner),
    db: Session = Depends(get_db),
) -> SkuMappingImportResponse:
    """Import SKU mappings from CSV. Owner-only. dry_run: validate and return errors without writing."""
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Upload a CSV file",
        )
    try:
        raw = file.file.read().decode("utf-8-sig")
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Could not read file: {e!s}",
        )
    def _opt_cell(raw: str, existing: bool, default_new: str | None = None):
        """Blank → leave unchanged (existing) or default (new). __NULL__ → None. Else return value."""
        r = (raw or "").strip()
        if r == "":
            return LEAVE_UNCHANGED if existing else default_new
        if r == CSV_NULL_TOKEN:
            return None
        return r

    reader = csv.DictReader(io.StringIO(raw))
    errors: list[SkuMappingImportErrorRow] = []
    created = 0
    updated = 0
    row_number = 0
    for row in reader:
        row_number += 1
        sku = (row.get("sku") or "").strip()
        marketplace_code = (row.get("marketplace_code") or "").strip()
        status_raw = (row.get("status") or "").strip().lower()
        product_id_raw = (row.get("product_id") or "").strip()
        asin_raw = (row.get("asin") or "").strip()
        fnsku_raw = (row.get("fnsku") or "").strip()
        notes_raw = (row.get("notes") or "").strip()

        if not sku:
            errors.append(SkuMappingImportErrorRow(row_number=row_number, sku=sku or None, marketplace_code=marketplace_code or None, error="sku is required"))
            continue
        if not marketplace_code:
            errors.append(SkuMappingImportErrorRow(row_number=row_number, sku=sku, marketplace_code=None, error="marketplace_code is required"))
            continue
        # status: required for validation; blank means leave unchanged (existing) or pending (new)
        if status_raw and status_raw not in SKU_MAPPING_STATUSES:
            errors.append(SkuMappingImportErrorRow(row_number=row_number, sku=sku, marketplace_code=marketplace_code, error=f"status must be one of: {list(SKU_MAPPING_STATUSES)}"))
            continue
        status_val = status_raw if status_raw in SKU_MAPPING_STATUSES else "pending"

        existing = get_sku_mapping_by_sku_marketplace(db, sku, marketplace_code)
        # Optional nullable fields: blank → leave unchanged / null; __NULL__ → clear
        asin_val = _opt_cell(asin_raw, bool(existing), None)
        fnsku_val = _opt_cell(fnsku_raw, bool(existing), None)
        notes_val = _opt_cell(notes_raw, bool(existing), None)
        if asin_val is not LEAVE_UNCHANGED and asin_val is not None and len(asin_val) > 20:
            errors.append(SkuMappingImportErrorRow(row_number=row_number, sku=sku, marketplace_code=marketplace_code, error="asin max length 20"))
            continue
        # product_id: blank / __NULL__ → None or leave unchanged; else integer
        if product_id_raw.strip() == "":
            product_id = LEAVE_UNCHANGED if existing else None
        elif product_id_raw.strip() == CSV_NULL_TOKEN:
            product_id = None
        else:
            try:
                product_id = int(product_id_raw)
            except ValueError:
                errors.append(SkuMappingImportErrorRow(row_number=row_number, sku=sku, marketplace_code=marketplace_code, error="product_id must be an integer"))
                continue
            if db.scalar(select(Product.id).where(Product.id == product_id)) is None:
                errors.append(SkuMappingImportErrorRow(row_number=row_number, sku=sku, marketplace_code=marketplace_code, error="product_id does not exist"))
                continue
        # status for upsert: blank+existing → leave unchanged, blank+new → pending
        status_upsert = LEAVE_UNCHANGED if (existing and not status_raw) else status_val

        if dry_run:
            if existing:
                updated += 1
            else:
                created += 1
            continue

        try:
            upsert_sku_mapping(
                db,
                sku=sku,
                marketplace_code=marketplace_code,
                asin=asin_val,
                fnsku=fnsku_val,
                product_id=product_id,
                status=status_upsert,
                notes=notes_val,
            )
            if existing:
                updated += 1
            else:
                created += 1
        except Exception as e:
            errors.append(SkuMappingImportErrorRow(row_number=row_number, sku=sku, marketplace_code=marketplace_code, error=str(e)))
    total_rows = row_number
    logger.info(
        "sku_mappings import total_rows=%s created=%s updated=%s errors=%s dry_run=%s",
        total_rows, created, updated, len(errors), dry_run,
    )
    return SkuMappingImportResponse(
        total_rows=total_rows,
        created=created,
        updated=updated,
        errors=errors,
        dry_run=dry_run,
    )


# --- Phase 12.4: Unmapped suggestions ---
@router.get("/admin/catalog/unmapped-skus/suggestions", response_model=UnmappedSuggestionsResponse)
def list_unmapped_suggestions(
    marketplace_code: str | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    user: User = Depends(require_owner),
    db: Session = Depends(get_db),
) -> UnmappedSuggestionsResponse:
    """Unmapped SKUs with suggested product (sku_exact_match or asin_match). Owner-only."""
    total, items = get_unmapped_skus_with_suggestions(
        db,
        marketplace_code=marketplace_code,
        limit=limit,
        offset=offset,
    )
    return UnmappedSuggestionsResponse(total=total, items=items)
