# Changelog / Sprints

This codebase includes work completed through **Sprint 11** and **Phase 12**. Summary of completed sprints and phases:

## Completed sprints

| Sprint | Scope |
|--------|--------|
| **1** | Local FastAPI + React auth foundation |
| **2** | Mock data models, seed script, dashboard summary |
| **3** | Dashboard timeseries charts and top products |
| **4** | Restock recommendations and inventory health |
| **5** | Baseline forecasting endpoints and UI |
| **6** | Forecast alignment, backtest metrics, forecast-based restock plan |
| **7–8** | Owner/partner roles, audit log, alert settings, inventory, alerts, restock actions (feature set) — implemented in code (not labeled as separate sprint commits) |
| **9** | Amazon SP-API connection (migrations, API, token encryption) — see `PHASE9_*.md` |
| **10** | Phase 10: SP-API orders sync (migrations, service, worker, admin orders sync). Also: alerts worker, deployment/ops — see BACKUPS, DEPLOYMENT, OPERATIONS. **Implemented in code;** see `PHASE10_ORDERS_SYNC.md`. |
| **11** | Insights & UX: forecast quality badge, Action Summary restock, “What changed?” cards, Settings preferences; Phase 11.4/11.5 inventory freshness and restock verification — see `PHASE11_4_VERIFICATION.md`, `PHASE11_5_VERIFICATION.md`. |
| **12** | Phase 12: Catalog mapping, data health, mapped demand, CSV export/import, unmapped suggestions. **Implemented in code;** see `PHASE12_CATALOG_MAPPING.md`. |

## Phase 10 (orders sync) — implemented in code

- **Migrations:** `0007` (amazon_connection last_check_at, last_check_ok, last_check_error), `0008` (orders sync fields on connection), `0009` (amazon_order), `0010` (amazon_order_item), `0011` (order_items source/source_order_item_id; marketplaces.currency nullable), `0012` (orders sync counts on connection).
- **Key modules:** `app/services/amazon_orders_sync.py`, `app/worker/amazon_orders_sync_worker.py`, `app/api/routes/admin_amazon_orders.py`, `app/api/routes/admin_amazon_spapi.py`; models `amazon_order`, `amazon_order_item`.
- **Docs:** `docs/PHASE10_ORDERS_SYNC.md` (added to align docs with code).

## Phase 12 (catalog mapping + data health + mapped demand) — implemented in code

- **Migrations:** `0015` (sku_mappings table).
- **Key modules:** `app/services/catalog_mapping.py`, `app/services/demand_source.py`, `app/services/mapping_resolution.py`, `app/services/timeseries.py`; `app/api/routes/admin_catalog.py`, `app/api/routes/admin_data_health.py`, `app/api/routes/forecast.py`, `app/api/routes/forecast_restock.py`, `app/api/routes/restock_actions.py`; schemas `sku_mapping`, `data_health`, `data_quality`; frontend `pages/admin/CatalogMappingPage.tsx`, `pages/admin/DataHealthPage.tsx`.
- **Docs:** `docs/PHASE12_CATALOG_MAPPING.md` (added to align docs with code).

## Docs gap fixed

Phase 10 and Phase 12 were implemented in code and migrations but had no phase docs. The following were added so written documentation matches the codebase:

- **PHASE10_ORDERS_SYNC.md** — SP-API orders sync (purpose, DB changes, key modules, how to run/verify).
- **PHASE12_CATALOG_MAPPING.md** — Catalog mapping, data health, mapped demand, CSV tooling (purpose, DB changes, key modules, how to run/verify).

Current tree = **Sprints 1–11** and **Phases 9, 10, 11.4, 11.5, 12** (all completed so far). For verification steps see `PHASE9_2_AMAZON_API.md`, `PHASE10_ORDERS_SYNC.md`, `PHASE11_4_VERIFICATION.md`, `PHASE11_5_VERIFICATION.md`, `PHASE12_CATALOG_MAPPING.md`.
