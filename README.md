# Amazon Dashboard (Seller + PPC + Forecasting)

Production-ready Amazon Seller dashboard for two shared users on a single DigitalOcean droplet.

## Tech stack (locked)

- **Backend:** Python, FastAPI, SQLAlchemy, Alembic
- **Database:** PostgreSQL
- **Frontend:** React + TypeScript
- **Infra:** Docker, Docker Compose, Caddy
- **Auth:** Email/password + JWT
- **Data/ML:** pandas, numpy, scikit-learn

## Features

- Multi-marketplace support
- Sales, profit, inventory, and PPC views
- Forecasting and restock
- Shared data for two users
- Secure login

## Development approach

Mock data first; Amazon APIs later.

## Planned repo structure

```
backend/
frontend/
caddy/
docker-compose.yml
```

## Sprint 1 scope

- **Docker Compose services:** db, backend, frontend, caddy
- **Backend endpoints:** `/api/health`, `/api/auth/register`, `/api/auth/login`, `/api/me`
- **DB:** user table via Alembic
- **Frontend:** login screen + protected API call

## How to run (Sprint 1 - local, no Docker)

**Prerequisites:** PostgreSQL running locally; repo-root `.env` with `DATABASE_URL` (e.g. `postgresql+psycopg://user:pass@localhost:5432/amazon_dashboard`), `JWT_SECRET`, and optionally `FRONTEND_ORIGIN=http://localhost:5173`.

**Backend (PowerShell):**

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

**Frontend (second terminal):**

```powershell
cd frontend
npm install
npm run dev
```

Frontend runs on port 5173. It proxies `/api` to the backend via `vite.config.ts`, so requests to `http://localhost:5173/api/...` are forwarded to `http://localhost:8000/api/...`.
