#!/usr/bin/env bash
# One-command deploy for Seller Hub.
# Idempotent — safe to run multiple times.
# Run from repo root (amazon-dashboard): ./scripts/deploy.sh
#
# Prereqs: Docker, Docker Compose, .env configured.
# Optional: run ./scripts/check_env.sh first for sanity checks.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$ROOT_DIR"

echo "==> Deploying from $(pwd)"

# 1. Pull latest code (if git repo)
if git rev-parse --git-dir >/dev/null 2>&1; then
  echo "==> Pulling latest code..."
  git pull || echo "WARN: git pull failed (local changes?); continuing with current code"
else
  echo "==> Not a git repo, skipping pull"
fi

# 2. Build images (no cache to ensure fresh build; remove --no-cache if you want faster deploys)
echo "==> Building images..."
docker compose build --no-cache

# 3. Start stack (db first, then backend, frontend, caddy)
echo "==> Starting stack..."
docker compose up -d

# 4. Wait for db to be ready
echo "==> Waiting for database..."
sleep 5
for i in {1..30}; do
  if docker compose exec -T db pg_isready -U "${POSTGRES_USER:-amazon_user}" -d "${POSTGRES_DB:-amazon_dashboard}" 2>/dev/null; then
    break
  fi
  if [ "$i" -eq 30 ]; then
    echo "ERROR: Database did not become ready in time"
    exit 1
  fi
  sleep 2
done

# 5. Run migrations (if Alembic is used)
echo "==> Running migrations..."
if docker compose exec -T backend alembic upgrade head 2>/dev/null; then
  echo "==> Migrations complete"
else
  echo "==> Migrations skipped (alembic not found or failed; check backend logs)"
fi

# 6. Restart backend/frontend to pick up any migration-related changes (optional; usually not needed)
# Skip — up -d already started them; migrations run against running db.

# 7. Health check
echo ""
echo "==> Health status"
echo "---"

HEALTH_OK=0
if curl -sf http://localhost/api/health >/dev/null 2>&1; then
  echo "  /api/health: OK"
  HEALTH_OK=1
else
  echo "  /api/health: FAIL (or Caddy not yet ready)"
fi

if curl -sf http://localhost/api/ready >/dev/null 2>&1; then
  echo "  /api/ready:  OK"
else
  echo "  /api/ready:  FAIL"
fi

echo "---"
if [ "$HEALTH_OK" -eq 1 ]; then
  echo "Deploy complete. App should be available at http://localhost"
else
  echo "Deploy finished, but health check failed. Run: docker compose logs -f backend"
  exit 1
fi
