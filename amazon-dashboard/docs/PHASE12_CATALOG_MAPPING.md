# Phase 12: Catalog mapping, data health, mapped demand, CSV tooling

## Purpose / overview

Phase 12 implements **catalog mapping** (SKU + marketplace → product, status), **data health** (mapping health, unmapped trend), **mapped demand** for forecast and restock (default: mapped/confirmed only; optional include_unmapped), and **CSV export/import** plus **unmapped suggestions**. All of this is **implemented in code and migrations**; this doc aligns written documentation with the codebase.

- **12.1:** SKU mapping table and admin catalog API (CRUD, list).
- **12.2:** Data Health API (mapping health, unmapped trend); timeseries/forecast use `sku_mappings` for mapped demand; mapping resolution (order-item SKU + marketplace → classification).
- **12.3:** Demand source: default `mapped_confirmed`; `include_unmapped` opt-in; `data_quality` in restock/forecast responses.
- **12.4:** CSV export/import for catalog; unmapped suggestions; unmapped trend (e.g. last 12 weeks) in Data Health; data quality severity (e.g. critical if share > 10%).

---

## DB changes (migrations)

| Revision | File | What it adds |
|----------|------|---------------|
| **0015** | `0015_create_sku_mappings.py` | Table `sku_mappings`: sku, marketplace_code, asin, fnsku, product_id (FK to products), status (default pending), notes, created_at, updated_at; unique (sku, marketplace_code); indexes on product_id, status, marketplace_code+status. |

---

## Key backend modules / routes

- **Models:** `backend/app/models/sku_mapping.py` (Phase 12.1).
- **Services:**  
  - `backend/app/services/catalog_mapping.py` — SKU mapping and unmapped-SKU (Phase 12.1, 12.4).  
  - `backend/app/services/demand_source.py` — default mapped_confirmed; include_unmapped; data quality severity (Phase 12.3, 12.4).  
  - `backend/app/services/mapping_resolution.py` — resolve order-item SKU + marketplace to mapping classification (Phase 12.2).  
  - `backend/app/services/timeseries.py` — time series with mapped demand via sku_mappings (Phase 12.2).  
  - `backend/app/services/restock.py` — restock plan with mapped demand (Phase 12.3).
- **Routes:**  
  - `backend/app/api/routes/admin_catalog.py` — catalog mapping CRUD, CSV export/import, unmapped suggestions (Phase 12.1, 12.4).  
  - `backend/app/api/routes/admin_data_health.py` — Data Health API, unmapped trend (Phase 12.2, 12.4).  
  - `backend/app/api/routes/forecast.py` — forecast total/SKU with mapped demand + include_unmapped (Phase 12.2).  
  - `backend/app/api/routes/forecast_restock.py` — restock plan with mapped demand + data_quality (Phase 12.3).  
  - `backend/app/api/routes/restock_actions.py` — actions with demand_source and data_quality (Phase 12.3).
- **Schemas:** `backend/app/schemas/sku_mapping.py`, `backend/app/schemas/data_health.py`, `backend/app/schemas/data_quality.py`; forecast/restock schemas with mapping health and data_quality fields.

**Frontend:** `frontend/src/pages/admin/CatalogMappingPage.tsx` (catalog CRUD, CSV export/import); `frontend/src/pages/admin/DataHealthPage.tsx` (data health, unmapped trend).

---

## How to run / verify locally

1. **Apply migrations** (from `amazon-dashboard`):
   ```bash
   docker compose run --rm backend python -m alembic upgrade head
   ```
   Confirm revision 0015 is applied: `docker compose run --rm backend python -m alembic current`.

2. **Catalog mapping (Phase 12.1 / 12.4):**
   - Open **Admin → Catalog Mapping**. Create/edit/delete SKU mappings (SKU + marketplace → product, status).
   - Use CSV export and CSV import if implemented in UI.
   - Call admin catalog API: list mappings, create, update, delete; unmapped suggestions endpoint.

3. **Data health (Phase 12.2 / 12.4):**
   - Open **Admin → Data Health**. Confirm mapping health and unmapped trend (e.g. last 12 weeks) are shown.
   - `GET /api/admin/data-health/...` (or equivalent) — response should include mapping/unmapped metrics.

4. **Forecast / restock with mapped demand (Phase 12.2 / 12.3):**
   - `GET /api/forecast/total?include_unmapped=false` (default: mapped only). Response should include mapping health / data_quality where implemented.
   - `GET /api/forecast/restock-plan` (with marketplace/SKU as needed). Response should include `data_quality` (and optional include_unmapped).
   - Restock actions endpoints: responses should include data_quality / mapped pipeline info for Phase 12.3.

5. **Data quality severity (Phase 12.4):**  
   - In responses that include data_quality, confirm severity (e.g. critical when unmapped share > 10% or no demand; warning when share > 0).
