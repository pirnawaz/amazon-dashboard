# Amazon

Amazon Seller dashboard and tooling — production-ready multi-user dashboard with forecasting, restock planning, inventory, and alerts.

## Project status (high level)

- **Completed:** Sprints 1–6, 7–8 (roles/audit/alerts), Phase 9 (SP-API connection), Phase 10 (orders sync), Sprint 11 (Insights/UX + Phase 11.4/11.5), Phase 12 (catalog mapping + data health + mapped demand + CSV tooling), **Sprint 13** (Amazon Ads API: auth, token storage, read-only ingestion, Ads page with mock fallback), **Sprint 14** (Ads attribution and SKU profitability: revenue, COGS, ad spend, net profit, ACOS/ROAS, time-aligned charts), **Sprint 15** (Advanced forecasting: seasonality, spike handling, confidence bounds, drift detection, forecast overrides), **Sprint 16** (Intelligent restock automation: supplier settings, lead time variability, safety stock, what-if scenarios, PO CSV export; recommendation + export only, no automatic ordering), **Sprint 17** (Notifications & ops hardening: notification delivery log with retries, job run log, stale orders/ads detection, ops health checks, System Health admin dashboard), **Sprint 18** (Roles & permissions: owner/partner/viewer, read-only role, Amazon account groundwork, account selector, permission checks and 403 messages), **Sprint 19** (Production readiness & scale: DB indexes, query optimization, safe caching, health + metrics endpoints, ops runbooks, Docker/Caddy hardening, frontend error boundary).
- **Remaining:** Sprint 20 (see amazon-dashboard/README.md).

Sprint ↔ Phase mapping and verification steps live in **[amazon-dashboard/README.md](amazon-dashboard/README.md)** and **[amazon-dashboard/docs/CHANGELOG.md](amazon-dashboard/docs/CHANGELOG.md)**.

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

For repo structure, API, local dev, deployment, and verification checklist, see **[amazon-dashboard/README.md](amazon-dashboard/README.md)**.
