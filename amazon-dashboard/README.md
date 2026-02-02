# Amazon Dashboard (Seller + PPC + Forecasting)

Production-ready Amazon Seller dashboard for shared users on a single DigitalOcean droplet.

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
