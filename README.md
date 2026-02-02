# Amazon

Amazon Seller dashboard and tooling — production-ready multi-user dashboard with forecasting, restock planning, inventory, and alerts.

## Contents

| Path | Description |
|------|-------------|
| **amazon-dashboard/** | Full-stack dashboard app (FastAPI + React, Docker Compose) |
| **DOCKER-SETUP-WINDOWS.md** | Step-by-step Docker Desktop + WSL2 setup on Windows 11 |

## Quick start

1. **Docker on Windows:** See [DOCKER-SETUP-WINDOWS.md](DOCKER-SETUP-WINDOWS.md) for WSL2 and Docker Desktop setup.
2. **Run the dashboard:**
   ```powershell
   cd amazon-dashboard
   copy .env.example .env   # set JWT_SECRET and optionally POSTGRES_PASSWORD
   docker compose up -d
   ```
   App at **http://localhost** (Caddy on 80; API at `/api`, Swagger at `/docs`).

For repo structure, API, local dev, and deployment, see **[amazon-dashboard/README.md](amazon-dashboard/README.md)**.
