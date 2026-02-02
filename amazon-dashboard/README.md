# Amazon Dashboard (Seller + PPC + Forecasting)

Production-ready Amazon Seller dashboard for shared users on a single DigitalOcean droplet.

## Project status

- **Completed:** Sprints 1–6 (foundation, dashboard, restock, forecasting baseline); Sprints 7–8 (owner/partner roles, audit log, alert settings, inventory, alerts, restock actions); Phase 9 (SP-API connection + token encryption); Phase 10 (SP-API orders sync); Sprint 11 (Insights/UX + Phase 11.4/11.5 inventory freshness and restock source-of-truth); Phase 12 (catalog mapping, data health, mapped demand, CSV export/import, unmapped suggestions).
- **Remaining:** Phase 13 (next). Nothing else is listed as remaining unless you have a separate roadmap.

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

## Tech stack

- **Backend:** Python, FastAPI, SQLAlchemy, Alembic
- **Database:** PostgreSQL
- **Frontend:** React + TypeScript, Vite, React Router
- **Infra:** Docker, Docker Compose, Caddy
- **Auth:** Email/password + JWT; optional owner/partner roles
- **Data/ML:** pandas, numpy, scikit-learn

## Features

- **Multi-marketplace** support
- **Dashboard:** Sales, profit, inventory, top products, timeseries
- **Forecasting:** Total and per-SKU demand; backtest, intelligence, restock plan
- **Restock:** Restock table, actions (total + per-SKU), planner
- **Inventory:** Levels by marketplace/SKU; create, update, delete
- **Alerts:** Alert events (stale, urgent restock, reorder soon, order-by passed); acknowledge; **alert settings** (email toggles, recipients, stale threshold) — **owner only**
- **Audit log:** Owner-only actions (alert settings changes, manual alert runs) — **owner only**
- **Roles:** **Owner** (full access, alert settings, audit log, run alerts) and **Partner** (read/dashboard/forecast/restock/inventory/alerts; no settings or audit log)
- **Demo mode:** Optional frontend-only demo data when `seller-hub-demo=true`

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

- **Health:** `GET /api/health`
- **Auth:** `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`, `GET /api/me`
- **User:** `GET /api/me` (current user + role)
- **Dashboard:** `GET /api/dashboard/summary`, `/api/dashboard/timeseries`, `/api/dashboard/top-products`
- **Forecast:** `GET /api/forecast/total`, `GET /api/forecast/sku/:sku`, `GET /api/forecast/top-skus`, `GET /api/forecast/restock-plan`, `POST /api/restock/plan`
- **Restock:** `GET /api/inventory/restock`, `GET /api/restock/actions/total`, `GET /api/restock/actions/sku/:sku`
- **Inventory:** `GET /api/inventory`, `GET /api/inventory/:marketplace/:sku`, `PUT /api/inventory`, `DELETE /api/inventory/:marketplace/:sku`
- **Alerts:** `GET /api/alerts`, `POST /api/alerts/ack`, `GET /api/alerts/settings`, `PUT /api/alerts/settings` (owner only), `POST /api/alerts/run` (owner only)
- **Admin:** `GET /api/admin/audit-log?limit=50&offset=0` (owner only)

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
   - `docker compose run --rm backend python -m alembic upgrade head` (or `.\run_migration_docker.ps1`). Check: `alembic current` shows latest revision (e.g. `0015`).

3. **Login as owner**
   - Register or log in; first user is owner. `GET /api/me` returns `role: "owner"`.

4. **Phase 9 – SP-API connect + token test**
   - See [docs/PHASE9_2_AMAZON_API.md](docs/PHASE9_2_AMAZON_API.md). As owner: `GET /api/amazon/connection`, `PUT /api/amazon/connection`, `GET /api/amazon/credential`, `PUT /api/amazon/credential`. Optional: Admin SP-API ping (Phase 10.1c) if token is set.

5. **Phase 10 – Orders sync trigger**
   - As owner: trigger orders sync (e.g. Admin → Amazon Orders → Sync, or `POST` the admin orders-sync endpoint). Check connection row: `last_orders_sync_at`, `last_orders_sync_orders_count`, `last_orders_sync_items_count` (see [docs/PHASE10_ORDERS_SYNC.md](docs/PHASE10_ORDERS_SYNC.md)).

6. **Phase 12 – Data health page / mapped demand toggles**
   - Open **Admin → Data Health** and **Admin → Catalog Mapping**. Confirm Data Health shows unmapped trend; Catalog Mapping allows CRUD and CSV export/import. Forecast/restock UI: use “include unmapped” (or equivalent) and confirm responses include mapping/data-quality info.

7. **Forecast/restock endpoints return `data_quality` / mapped fields**
   - `GET /api/forecast/total?include_unmapped=false` and `GET /api/forecast/restock-plan` (with marketplace/SKU as needed). Responses should include `data_quality` (or mapping health) where implemented (Phase 12.2/12.3).
