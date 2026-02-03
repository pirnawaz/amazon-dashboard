# Amazon Dashboard (Seller + PPC + Forecasting)

Production-ready Amazon Seller dashboard for shared users on a single DigitalOcean droplet.

## Project status

- **Completed:** Sprints 1–6 (foundation, dashboard, restock, forecasting baseline); Sprints 7–8 (owner/partner roles, audit log, alert settings, inventory, alerts, restock actions); Phase 9 (SP-API connection + token encryption); Phase 10 (SP-API orders sync); Sprint 11 (Insights/UX + Phase 11.4/11.5 inventory freshness and restock source-of-truth); Phase 12 (catalog mapping, data health, mapped demand, CSV export/import, unmapped suggestions); **Sprint 13** (Amazon Ads API: auth, token storage, read-only ingestion for campaigns/ad groups/keywords/targets, daily metrics, dashboard/timeseries, Ads page with mock fallback); **Sprint 14** (Ads attribution and SKU profitability: ads_attributed_daily, sku_cost, profitability table and timeseries, Attribution page, warnings for missing COGS/attribution); **Sprint 15** (Advanced forecasting: seasonality model, spike handling, confidence bounds, drift detection, forecast overrides CRUD); **Sprint 16** (Intelligent restock automation: supplier table, SKU supplier settings, lead time variability, safety stock refinement, prioritised recommendations, what-if scenarios, PO CSV export; recommendation + export only; owner-only suppliers/settings CRUD; Restock recommendations page and admin Suppliers / Restock settings pages); **Sprint 17** (Notifications & ops hardening: notification_delivery and job_run tables, notification service with retries and severity rules, ops health checks for stale orders/ads and job failures, notifications_dispatch worker, admin health API and System Health dashboard); **Sprint 18** (Roles & permissions: owner/partner/viewer, read-only role, Amazon account groundwork, account selector, permission checks and 403 messages, UX polish); **Sprint 19** (Production readiness & scale: DB performance indexes, query optimization and date limits, safe in-process cache, unified health + metrics endpoints, backup/restore/upgrade runbooks, Docker/Caddy hardening, frontend error boundary).
- **Remaining:** Sprint 20 (see below).

See [docs/CHANGELOG.md](docs/CHANGELOG.md) and phase docs in `docs/` (PHASE9_*.md, PHASE10_ORDERS_SYNC.md, PHASE11_*.md, PHASE12_CATALOG_MAPPING.md).

### Sprint ↔ Phase mapping

| Sprints | Phase | What’s implemented |
|--------|-------|---------------------|
| **1–6** | — | Foundation, dashboard, restock, forecasting baseline |
| **7–8** | — | Roles, audit log, alert settings, inventory, alerts, restock actions (already in code) |
| **9** | **Phase 9** | SP-API connection, migrations, token encryption |
| **10** | **Phase 10** | Orders sync (SP-API), worker, admin orders sync; deployment/worker ops (BACKUPS, DEPLOYMENT, OPERATIONS) |
| **11** | **Phase 11.4 / 11.5** | Insights/UX; inventory freshness; restock uses `inventory_levels` as source of truth |
| **11** (overlap) | **Phase 12** | Catalog mapping, data health, mapped demand, CSV tooling (merged into same tree) |
| **13** | **Sprint 13** | Amazon Ads API: connect account, list profiles, trigger sync, dashboard summary/timeseries; Ads page (spend, sales, ACOS, ROAS, chart, marketplace selector, mock fallback) |
| **14** | **Sprint 14** | Ads attribution + SKU profitability: ads_attributed_daily, sku_cost, profitability service, GET sku-profitability / sku-timeseries, Attribution page, demo fallback, warnings for missing COGS/attribution |
| **15** | **Sprint 15** | Seasonality-aware forecast, spike handling, confidence bounds, drift detection, forecast_override table, owner-only overrides CRUD, Forecast overrides page, chart bands and drift banner |
| **16** | **Sprint 16** | Supplier settings + lead time variability; safety stock + reorder point + rounding (MOQ/pack); what-if scenarios; CSV export; new tables (supplier, sku_supplier_setting, restock_recommendation); Restock recommendations page; Admin Suppliers and SKU Supplier Settings (owner-only) |
| **17** | **Sprint 17** | Notification reliability & retries (notification_delivery table, send/enqueue/retry, severity rules); stale data detection (orders/ads); job_run logging for orders_sync, ads_sync, notifications_dispatch; ops health checks; admin health API (summary, jobs, notifications); System Health dashboard (owner-only) |
| **18** | **Sprint 18** | Roles: owner (full access, manage integrations/users), partner (view + trigger sync, edit overrides/SKU cost), viewer (read-only); amazon_account table and link to SP-API/Ads; X-Amazon-Account-Id header; admin Amazon accounts CRUD; account selector in header; permission helpers and 403 messages; UX polish (empty states, demo data) |
| **19** | **Sprint 19** | Production readiness: Alembic migration 0022 (indexes for order_items, ads, inventory, sku_mappings, forecast_override, restock_recommendation, notification_delivery, job_run); dashboard default 90 days, pagination for job runs/notifications; slow-query logging; in-process TTL cache for dashboard summary; GET /api/health (ok + version + db), GET /api/metrics (owner-only); ops runbooks (docs/ops.md); Docker restart + healthchecks + log rotation; Caddy timeouts; ErrorBoundary in frontend |

### Remaining sprints (20)

| Sprint | Scope (placeholder) |
|--------|----------------------|
| **20** | ⏳ TBD |

### How to verify Sprint 19

1. **Docker Compose up and build**
   - From `amazon-dashboard`: `docker compose up -d --build`. App at **http://localhost**; no console errors on load.

2. **Alembic upgrade head reaches new revision and indexes exist**
   - Run `docker compose run --rm backend python -m alembic upgrade head`. Then `docker compose run --rm backend python -m alembic current` shows revision **0022** (or later). Indexes on order_items, ads_daily_metrics, ads_attributed_daily, inventory_levels, sku_mappings, forecast_override, restock_recommendation, notification_delivery, job_run exist (e.g. `\di` in psql or check migration 0022).

3. **Hit /api/health and confirm ok + db connectivity**
   - `curl -s http://localhost/api/health` returns `{"status":"ok","version":"...","db":"ok"}`. If DB is down, response is 503 with `"db":"fail"`.

4. **As owner, hit /api/metrics and confirm response**
   - With owner JWT: `curl -s -H "Authorization: Bearer <token>" http://localhost/api/metrics` returns JSON with `last_orders_sync_at`, `last_ads_sync_at`, `job_run_counts`, `notification_deliveries_pending`, `notification_deliveries_failed` (no secrets).

5. **Run backup/restore on a test database (or document dry-run)**
   - Run `./scripts/backup_db.sh`; verify `backups/backup_*.sql` exists. Optionally restore to a test DB per [docs/ops.md](docs/ops.md) (or document that dry-run was done).

6. **Confirm key pages still load fast**
   - Log in; open Dashboard (default 90 days), Ads, Attribution, Restock recommendations, Forecast. No long freezes; slow requests (if any) appear in backend logs as `slow_request` when duration ≥ `SLOW_QUERY_MS`.

### How to verify Sprint 18

1. **Docker Compose up and build**
   - From `amazon-dashboard`: `docker compose up -d --build`. App at **http://localhost**; no console errors on load.

2. **Alembic upgrade head reaches new revision; amazon_account table exists; integrations backfilled to default account**
   - Run `docker compose run --rm backend python -m alembic upgrade head`. Then `docker compose run --rm backend python -m alembic current` shows revision **0021** (or later). Table `amazon_account` exists. Tables `amazon_connection` and `ads_account` have nullable `amazon_account_id`; existing rows are backfilled to the default account.

3. **Create a viewer user and confirm UI is read-only (no admin links, no sync, no edits)**
   - In the DB set a user’s role to `viewer` (e.g. `UPDATE users SET role = 'viewer' WHERE email = '...'`). Log in as that user. Sidebar has no Admin section and no “Forecast overrides” under Settings. Ads page: Sync button disabled with tooltip “Read-only account”. Navigating to `/forecast/overrides` shows “Read-only account” message. Navigating to `/admin/amazon-accounts` shows “Owner access required”.

4. **Owner can create Amazon accounts; switching accounts changes data context (at least for Ads + Orders)**
   - Log in as owner. Open **Admin → Amazon accounts** (or `/admin/amazon-accounts`). Create a new account (e.g. “EU Account”). In the header, use the Amazon Account selector to switch between “Default” and the new account. Trigger Orders sync or Ads sync (or open Ads/connection pages); backend uses the selected account id (X-Amazon-Account-Id) for context.

5. **Permission errors return clear messages**
   - As viewer, attempt an edit (e.g. POST to forecast overrides or PUT sku-cost). API returns 403 with a message such as “Viewer is read-only. You don’t have permission to edit or trigger actions.” As partner, open an owner-only page (e.g. Admin → Audit log); API returns 403 with “Owner access required” style message.

### How to verify Sprint 17

1. **Docker Compose up and build**
   - From `amazon-dashboard`: `docker compose up -d --build`. App at **http://localhost**; no console errors on load.

2. **Alembic reaches new revision and new tables exist**
   - Run `docker compose run --rm backend python -m alembic upgrade head`. Then `docker compose run --rm backend python -m alembic current` shows revision **0020** (or later). Tables `notification_delivery` and `job_run` exist.

3. **System Health page loads and shows demo or real data**
   - Log in as owner, open **Admin → System Health** (or go to `/admin/system-health`). Status banner (green/yellow/red), cards for Orders sync, Ads sync, Notifications, and tables for Recent job runs and Recent notification deliveries render. With demo mode or real backend, data appears.

4. **Simulate stale orders/ads (config) → warning notification logged**
   - Set `ORDERS_STALE_HOURS=0` (or a large value so last sync is “stale”) and restart the notifications_dispatch worker (or trigger health checks). Check `notification_delivery` for a warning (stale_orders or stale_ads) or confirm ops health logs a warning.

5. **Force a job failure → critical notification logged**
   - Cause a critical job to fail (e.g. orders_sync with invalid token). Confirm a `job_run` row with status `failed` and that a critical notification is emitted (notification_delivery or email).

6. **Notifications retry up to configured max**
   - Create a pending/failed notification (e.g. invalid recipient) and run the notifications_dispatch worker repeatedly. Confirm `attempts` increases and status becomes `failed` after `NOTIFICATIONS_RETRY_MAX` (default 3) attempts.

### How to verify Sprint 16

1. **Docker Compose up and build**
   - From `amazon-dashboard`: `docker compose up -d --build`. App at **http://localhost**; no console errors on load.

2. **Alembic reaches new revision and new tables exist**
   - Run `docker compose run --rm backend python -m alembic upgrade head`. Then `docker compose run --rm backend python -m alembic current` shows revision **0019** (or later). Tables `supplier`, `sku_supplier_setting`, and optionally `restock_recommendation` exist.

3. **Restock recommendations page loads**
   - Log in, open **Inventory → Restock recommendations** (or go to `/restock/advanced`). Table and filters (marketplace, days, supplier, urgent only, missing settings only) render. With demo mode or real inventory data, rows appear. Row click opens detail drawer with breakdown and what-if form.

4. **What-if recompute works**
   - On the Restock recommendations page, click a row to open the detail. In the what-if form, change lead time mean/std, service level, or daily demand override and click **Recompute (what-if)**. The detail updates with the recomputed recommendation (or demo shows a simulated update).

5. **Export CSV downloads**
   - Click **Export PO CSV** on the Restock recommendations page. A CSV file downloads with columns: supplier, sku, marketplace, recommended_units_rounded, pack_size, moq, notes_flags.

6. **Owner can edit suppliers/settings; partner cannot**
   - As **owner**, open **Admin → Suppliers** and **Admin → Restock settings**. Create and edit suppliers; create and edit SKU supplier settings (SKU, marketplace, supplier, lead time, MOQ, pack size, service level). As **partner**, these admin links are not shown (or return 403 if accessed directly).

### How to verify Sprint 15

1. **Docker Compose up and build**
   - From `amazon-dashboard`: `docker compose up -d --build`. App at **http://localhost**; no console errors on load.

2. **Alembic reaches new revision and forecast_override table exists**
   - Run `docker compose run --rm backend python -m alembic upgrade head`. Then `docker compose run --rm backend python -m alembic current` shows revision **0018** (or later). Table `forecast_override` (and optionally `forecast_run`) exists.

3. **Forecast pages render bands and do not crash**
   - Log in, open **Forecasts** in the sidebar. Switch between Total and SKU; select horizon and marketplace. The forecast chart shows actual vs predicted; if the API returns `confidence_bounds`, the chart shows a confidence band (lower/upper). No unhandled errors in the console.

4. **Drift flag appears if demo data triggers it**
   - In demo mode (or with data that triggers drift), the forecast response includes `drift: { flag, window_days, mae, mape, threshold }`. When `drift.flag` is true, a warning banner appears: "Forecast drift detected in the last N days" with metrics.

5. **Override CRUD works (owner only)**
   - As owner, open **Admin → Forecast overrides** (or go to `/forecast/overrides`). List overrides (optional filters: sku, marketplace). Create an override: set start_date, end_date, type (absolute or multiplier), value, optional reason. Save. Edit and delete an override. Confirm delete. After creating an override that overlaps the forecast horizon, reload the Forecast page and confirm the forecast output reflects the override (e.g. multiplier or absolute value in the affected date range).

6. **Existing forecast endpoints still respond with required fields**
   - `GET /api/forecast/total?history_days=180&horizon_days=30&marketplace=ALL` and `GET /api/forecast/sku?sku=...&history_days=180&horizon_days=30&marketplace=ALL` return the same core fields as before (`kind`, `forecast_points`, `backtest_points`, `intelligence`, `recommendation`, `reasoning`, etc.) plus optional `confidence_bounds`, `drift`, and `applied_overrides`.

## Tech stack

- **Backend:** Python, FastAPI, SQLAlchemy, Alembic
- **Database:** PostgreSQL
- **Frontend:** React + TypeScript, Vite, React Router
- **Infra:** Docker, Docker Compose, Caddy
- **Auth:** Email/password + JWT; roles: owner, partner, viewer
- **Data/ML:** pandas, numpy, scikit-learn

## Features

- **Multi-marketplace** support
- **Dashboard:** Sales, profit, inventory, top products, timeseries
- **Forecasting:** Total and per-SKU demand; backtest, intelligence, restock plan
- **Restock:** Restock table, actions (total + per-SKU), planner
- **Inventory:** Levels by marketplace/SKU; create, update, delete
- **Alerts:** Alert events (stale, urgent restock, reorder soon, order-by passed); acknowledge; **alert settings** (email toggles, recipients, stale threshold) — **owner only**
- **Audit log:** Owner-only actions (alert settings changes, manual alert runs) — **owner only**
- **Roles:** **Owner** (full access, manage integrations, manage users/roles, admin pages), **Partner** (view dashboards, trigger sync, edit forecast overrides and SKU cost; no admin pages), **Viewer** (read-only: view dashboards only; no sync, no edits, no admin)
- **Demo mode:** Optional frontend-only demo data when `seller-hub-demo=true`
- **Ads (Sprint 13):** Amazon Ads API (separate from SP-API): connect account (encrypted token), list profiles, trigger sync; Ads page: spend, sales, ACOS, ROAS by marketplace and date; mock data fallback when API not configured
- **Ads Attribution (Sprint 14):** SKU profitability: revenue, ad spend, attributed sales, COGS, net profit, ACOS/ROAS; Attribution page with sortable table and per-SKU timeseries chart; warnings for missing COGS/attribution/mapping (no crash); demo fallback
- **Sprint 17:** Notification delivery log with retries (max attempts configurable); job run log for orders_sync, ads_sync, notifications_dispatch; stale orders/ads detection (configurable hours); ops health checks; admin System Health dashboard (status banner, sync cards, job runs and notification tables); feature flags: ENABLE_NOTIFICATIONS, ENABLE_OPS_HEALTH_CHECKS; config: ORDERS_STALE_HOURS, ADS_STALE_HOURS, NOTIFICATIONS_RETRY_MAX

## Repo structure

```
amazon-dashboard/
  backend/          # FastAPI app, Alembic, models, services, worker
  frontend/         # React + TypeScript (Vite)
  caddy/            # Caddyfile (reverse proxy)
  docker-compose.yml
  docs/             # BACKUPS, DEPLOYMENT, FAQ, OPERATIONS
  scripts/          # backup_db, deploy, restore_db, rollback
```

## API overview

- **Health (Sprint 19):** `GET /api/health` returns `{ status, version, db }` (503 if DB unreachable). `GET /api/ready` for DB-only check. `GET /api/metrics` (owner-only): lightweight counts and last sync times; no secrets.
- **Auth:** `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`, `GET /api/me`
- **User:** `GET /api/me` (current user + role)
- **Dashboard:** `GET /api/dashboard/summary`, `/api/dashboard/timeseries`, `/api/dashboard/top-products`
- **Forecast:** `GET /api/forecast/total`, `GET /api/forecast/sku`, `GET /api/forecast/top-skus`, `GET /api/forecast/restock-plan`, `POST /api/restock/plan`. **Sprint 15:** `GET /api/forecast/overrides`, `POST /api/forecast/overrides`, `PUT /api/forecast/overrides/{id}`, `DELETE /api/forecast/overrides/{id}` (owner only). Forecast responses include optional `confidence_bounds`, `drift`, `applied_overrides`.
- **Restock:** `GET /api/inventory/restock`, `GET /api/restock/actions/total`, `GET /api/restock/actions/sku/:sku`. **Sprint 16:** `GET /api/restock/suppliers`, `POST /api/restock/suppliers`, `PUT /api/restock/suppliers/{id}`, `DELETE /api/restock/suppliers/{id}` (owner only); `GET /api/restock/settings`, `POST /api/restock/settings`, `PUT /api/restock/settings/{id}`, `DELETE /api/restock/settings/{id}` (owner only); `GET /api/restock/recommendations`, `GET /api/restock/recommendations/{sku}`, `POST /api/restock/what-if`, `GET /api/restock/export/csv` (authenticated).
- **Inventory:** `GET /api/inventory`, `GET /api/inventory/:marketplace/:sku`, `PUT /api/inventory`, `DELETE /api/inventory/:marketplace/:sku`
- **Alerts:** `GET /api/alerts`, `POST /api/alerts/ack`, `GET /api/alerts/settings`, `PUT /api/alerts/settings` (owner only), `POST /api/alerts/run` (owner only)
- **Admin:** `GET /api/admin/audit-log?limit=50&offset=0` (owner only). **Sprint 17:** `GET /api/admin/health/summary`, `GET /api/admin/health/jobs?limit=50&offset=0`, `GET /api/admin/health/notifications?status=&severity=&limit=50&offset=0` (owner only). **Sprint 18:** `GET /api/admin/amazon-accounts`, `POST /api/admin/amazon-accounts`, `GET /api/admin/amazon-accounts/:id`, `PUT /api/admin/amazon-accounts/:id`, `DELETE /api/admin/amazon-accounts/:id` (list: owner+partner; create/update/delete: owner only). Request header `X-Amazon-Account-Id` (optional) sets account context for integration endpoints.
- **Ads (Sprint 13):** `PUT /api/ads/account/connect` (owner only), `GET /api/ads/account`, `GET /api/ads/profiles`, `POST /api/ads/sync` (owner+partner; viewer 403), `GET /api/ads/dashboard/summary`, `GET /api/ads/dashboard/timeseries`
- **Ads Attribution (Sprint 14):** `GET /api/ads/attribution/sku-profitability?days=30&marketplace=US`, `GET /api/ads/attribution/sku-timeseries?sku=...&days=30&marketplace=US`, `GET /api/ads/sku-cost`, `PUT /api/ads/sku-cost` (owner+partner; viewer 403), `DELETE /api/ads/sku-cost/:sku` (owner+partner; viewer 403)

Swagger docs at **http://localhost/docs** when running.

## How to run with Docker

**Prerequisites:** Copy `.env.example` to `.env` and set `JWT_SECRET` (and optionally change `POSTGRES_PASSWORD`).

```powershell
cd D:\Cursor\Amazon\amazon-dashboard
copy .env.example .env
docker compose up -d
```

App at **http://localhost** (Caddy on port 80; `/api` → backend, `/` → frontend). To stop: `docker compose down`.

**Database runs in Docker** (Postgres in the `db` container), not Laragon. To run migrations, run them **inside** the backend container so it connects to `db`:

```powershell
cd D:\Cursor\Amazon\amazon-dashboard
docker compose run --rm backend python -m alembic upgrade head
```

Or from the same directory: `.\run_migration_docker.ps1`. Migrations may also run on backend startup depending on your setup.

## How to run (local, no Docker)

**Prerequisites:** PostgreSQL running somewhere; repo-root `.env` with `DATABASE_URL`, `JWT_SECRET`, and optionally `FRONTEND_ORIGIN=http://localhost:5173`. If you use Docker only for the database, run `docker compose up -d db` (port 5432 is exposed) and set `DATABASE_URL=...@localhost:5432/amazon_dashboard`; then run migrations from the host with `cd backend && python -m alembic upgrade head`, or run migrations via Docker as above.

**Backend (PowerShell):**

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
alembic upgrade head
python -m app.scripts.seed_mock_data --days 120
uvicorn app.main:app --reload --port 8000
```

**Frontend (second terminal):**

```powershell
cd frontend
npm install
npm run dev
```

Frontend runs on the port in `vite.config.ts` (e.g. 5175). It proxies `/api` to the backend.

## Development

- **Mock data first;** Amazon APIs later.
- Frontend build: `cd frontend && npm run build`.

For deployment, backups, and operations, see `docs/`.

## Verification checklist

Use this to confirm the app and phases work end-to-end (beginner-friendly).

1. **Docker Compose up**
   - From `amazon-dashboard`: `docker compose up -d`. App at **http://localhost**; API at **http://localhost/api**, Swagger at **http://localhost/docs**.

2. **Migrations apply**
   - `docker compose run --rm backend python -m alembic upgrade head` (or `.\run_migration_docker.ps1`). Check: `alembic current` shows latest revision (e.g. `0017`).

3. **Login as owner**
   - Register or log in; first user is owner. `GET /api/me` returns `role: "owner"`.

4. **Phase 9 – SP-API connect + token test**
   - See [docs/PHASE9_2_AMAZON_API.md](docs/PHASE9_2_AMAZON_API.md). As owner: `GET /api/amazon/connection`, `PUT /api/amazon/connection`, `GET /api/amazon/credential`, `PUT /api/amazon/credential`. Optional: Admin SP-API ping (Phase 10.1c) if token is set.

5. **Phase 10 – Orders sync trigger**
   - As owner: trigger orders sync (e.g. Admin → Amazon Orders → Sync, or `POST` the admin orders-sync endpoint). Check connection row: `last_orders_sync_at`, `last_orders_sync_orders_count`, `last_orders_sync_items_count` (see [docs/PHASE10_ORDERS_SYNC.md](docs/PHASE10_ORDERS_SYNC.md)).

6. **Phase 12 – Data health page / mapped demand toggles**
   - Open **Admin → Data Health** and **Admin → Catalog Mapping**. Confirm Data Health shows unmapped trend; Catalog Mapping allows CRUD and CSV export/import. Forecast/restock UI: use "include unmapped" (or equivalent) and confirm responses include mapping/data-quality info.

7. **Forecast/restock endpoints return `data_quality` / mapped fields**
   - `GET /api/forecast/total?include_unmapped=false` and `GET /api/forecast/restock-plan` (with marketplace/SKU as needed). Responses should include `data_quality` (or mapping health) where implemented (Phase 12.2/12.3).

## How to verify Sprint 13

Sprint 13 is marked **completed** only if:

1. **Docker Compose starts**
   - From `amazon-dashboard`: `docker compose up -d`. All services (db, backend, frontend, caddy, alerts_worker, ads_sync_worker) start without error. App at **http://localhost**.

2. **Migrations include Ads tables**
   - Run `docker compose run --rm backend python -m alembic upgrade head`. Then `docker compose run --rm backend python -m alembic current` shows revision `0016` (or later). Tables `ads_account`, `ads_profile`, `ads_campaign`, `ads_ad_group`, `ads_target_keyword`, `ads_daily_metrics` exist.

3. **Basic Ads page loads with mock data fallback**
   - Log in, open **Ads** in the sidebar. The Ads page loads and shows spend, sales, ACOS, ROAS (may be zeros or demo values). Marketplace and days selectors work. Chart by date appears (or "No time series data" if no metrics). No unhandled errors in the console. If Ads API is not connected, the page still works (mock or empty state).

4. **Ads API endpoints respond**
   - `GET /api/ads/account` (with JWT) returns `null` or an account object. `GET /api/ads/dashboard/summary?days=30&marketplace=ALL` returns `{ spend, sales, acos, roas, marketplace, days }`. `GET /api/ads/dashboard/timeseries?days=7&marketplace=ALL` returns `{ days, marketplace, points }`.

If any of the above fails, Sprint 13 is not considered complete for the checklist.

## How to verify Sprint 14

Sprint 14 is marked **completed** only if:

1. **Docker Compose up and build**
   - From `amazon-dashboard`: `docker compose up -d --build`. App at **http://localhost**; no console errors on load.

2. **Alembic reaches new revision and tables exist**
   - Run `docker compose run --rm backend python -m alembic upgrade head`. Then `docker compose run --rm backend python -m alembic current` shows revision **0017** (or later). Tables `ads_attributed_daily` and `sku_cost` exist.

3. **Ads page and Attribution page load without console errors**
   - Log in, open **Ads** in the sidebar; then open **Attribution** (or go to `/ads/attribution`). Both pages load; marketplace and days selectors work. No unhandled errors in the browser console.

4. **GET /api/ads/attribution/sku-profitability returns rows (demo or real)**
   - With JWT: `GET /api/ads/attribution/sku-profitability?days=30&marketplace=US` returns `{ days, marketplace, rows }`. Rows may be empty or demo; response must not 500. In demo mode or with seed data, rows appear.

5. **GET /api/ads/attribution/sku-timeseries returns points**
   - With JWT: `GET /api/ads/attribution/sku-timeseries?sku=DEMO-SKU-001&days=30&marketplace=US` returns `{ sku, days, marketplace, points }`. Points array may be empty; response must not 500. With demo data, points appear.

6. **Warnings appear for missing COGS/attribution rather than failures**
   - Profitability rows may include `warning_flags` (e.g. `["missing_cogs", "missing_attribution", "missing_mapping"]`). UI shows "—" and warning badges; no crash or 500 when data is missing.

If any of the above fails, Sprint 14 is not considered complete for the checklist.
