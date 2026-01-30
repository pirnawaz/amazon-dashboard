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

## How to run (coming in Sprint 1)
