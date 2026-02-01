#!/usr/bin/env bash
# Environment sanity check for production deploy.
# Fail fast with clear messages. Run before deploy: ./scripts/check_env.sh
#
# Run from repo root (amazon-dashboard).

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$ROOT_DIR/.env"

echo "==> Environment sanity check"
echo ""

# Load .env if it exists
if [ -f "$ENV_FILE" ]; then
  set -a
  # shellcheck source=/dev/null
  source "$ENV_FILE" 2>/dev/null || true
  set +a
else
  echo "ERROR: .env not found at $ENV_FILE"
  echo "  Copy .env.example to .env and configure."
  exit 1
fi

FAIL=0

# APP_ENV=production
if [ "${APP_ENV:-}" != "production" ]; then
  echo "FAIL: APP_ENV must be 'production' (got: ${APP_ENV:-<unset>})"
  FAIL=1
else
  echo "OK: APP_ENV=production"
fi

# DATABASE_URL is not localhost (production should use db host)
if [ -z "${DATABASE_URL:-}" ]; then
  echo "FAIL: DATABASE_URL is not set"
  FAIL=1
elif echo "$DATABASE_URL" | grep -q "localhost\|127\.0\.0\.1"; then
  echo "FAIL: DATABASE_URL should not use localhost in production"
  echo "     Use the db service hostname (e.g. db:5432) in Docker."
  FAIL=1
else
  echo "OK: DATABASE_URL is set (not localhost)"
fi

# JWT_SECRET length sanity check (at least 32 chars recommended)
JWT_LEN=${#JWT_SECRET}
if [ -z "${JWT_SECRET:-}" ]; then
  echo "FAIL: JWT_SECRET is not set"
  FAIL=1
elif [ "$JWT_LEN" -lt 32 ]; then
  echo "FAIL: JWT_SECRET is too short ($JWT_LEN chars). Use at least 32 random characters."
  FAIL=1
elif [ "$JWT_SECRET" = "change_me_to_a_long_random_string" ]; then
  echo "FAIL: JWT_SECRET is still the default placeholder. Set a strong secret."
  FAIL=1
else
  echo "OK: JWT_SECRET is set ($JWT_LEN chars)"
fi

# POSTGRES_PASSWORD
if [ -z "${POSTGRES_PASSWORD:-}" ]; then
  echo "FAIL: POSTGRES_PASSWORD is not set"
  FAIL=1
elif [ "$POSTGRES_PASSWORD" = "change_me" ]; then
  echo "FAIL: POSTGRES_PASSWORD is still the default. Set a strong password."
  FAIL=1
else
  echo "OK: POSTGRES_PASSWORD is set"
fi

echo ""
if [ "$FAIL" -eq 1 ]; then
  echo "Check failed. Fix the issues above before deploying."
  exit 1
fi

echo "All checks passed. Safe to deploy."
