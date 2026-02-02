# Deployment (Seller Hub)

How to deploy the Seller Hub app on a single droplet or VM.

## Prerequisites

- Docker and Docker Compose
- A host with at least 2 GB RAM (PostgreSQL + backend + frontend + Caddy)

## Environment variables

Create a `.env` file in the repo root (`amazon-dashboard/`). Required:

| Variable | Description | Example |
|----------|-------------|---------|
| `POSTGRES_USER` | PostgreSQL user | `amazon_user` |
| `POSTGRES_PASSWORD` | PostgreSQL password | Use a strong secret |
| `POSTGRES_DB` | Database name | `amazon_dashboard` |
| `DATABASE_URL` | Full DB URL (backend) | `postgresql+psycopg://user:pass@db:5432/amazon_dashboard` |
| `JWT_SECRET` | Secret for JWT signing | Long random string |
| `APP_ENV` | `development` or `production` | `production` |
| `FRONTEND_ORIGIN` | Allowed CORS origin for frontend | `https://your-domain.com` |

Optional:

- `JWT_EXPIRES_MINUTES` — token lifetime (default `60`)
- `RATE_LIMIT_PER_MINUTE` — API rate limit per IP/user (default `100`)

See `.env.example` in the repo for a template.

Before deploying to production, run:

```bash
./scripts/check_env.sh
```

This checks `APP_ENV=production`, `DATABASE_URL` not localhost, `JWT_SECRET` length, etc. Fix any failures before deploying.

## Deploy with Docker Compose

### One-command deploy (recommended)

```bash
cd amazon-dashboard
./scripts/check_env.sh   # optional but recommended
./scripts/deploy.sh
```

`deploy.sh` pulls latest code, builds images, runs migrations, and restarts the stack. It is idempotent — safe to run multiple times.

### Manual deploy

1. Clone the repo and `cd amazon-dashboard`.
2. Copy `.env.example` to `.env` and set the variables above.
3. Run:

   ```bash
   docker compose up -d
   ```

4. Run migrations:

   ```bash
   docker compose exec backend alembic upgrade head
   ```

## Rollback

If a deploy breaks something:

```bash
./scripts/rollback.sh
```

This rolls back to the previous git commit, rebuilds, and restarts. See the script for assumptions (git-based rollback; for image-tag rollback, use `ROLLBACK_TAG`).

## Health checks

- **API health:** `GET /api/health` — returns `{"status":"ok"}`.
- **Readiness (DB):** `GET /api/ready` — returns `{"status":"ok"}` if DB is reachable, or 503 if not.
- **Version:** `GET /api/version` — returns `{"version":"0.1.0"}` for debugging.

Verify after deploy:

```bash
curl -s http://localhost/api/health
curl -s http://localhost/api/ready
curl -s http://localhost/api/version
```

## Services

- **db** — PostgreSQL 16
- **backend** — FastAPI (port 8000 internally)
- **frontend** — React SPA (port 5175 internally)
- **caddy** — Reverse proxy on port 80 (and optionally 443)

## Caddy / HTTPS

The Caddyfile at `caddy/Caddyfile` is production-ready with:

- Gzip compression
- Timeouts (30s read/write, 60s idle)
- Security headers (X-Content-Type-Options, X-Frame-Options, etc.)
- Clear routing: `/api/*` → backend, everything else → frontend

For HTTPS in production, replace `:80` in the Caddyfile with your domain (e.g. `sellerhub.example.com`). Caddy will auto-obtain TLS and redirect HTTP → HTTPS.

## Single-droplet notes

- Expose port 80 (and 443 if using TLS) on the droplet.
- Keep `JWT_SECRET` and `POSTGRES_PASSWORD` strong and secret.
- Back up the database regularly; see `docs/BACKUPS.md`.
