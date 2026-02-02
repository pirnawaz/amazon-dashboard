#!/usr/bin/env bash
# Rollback Seller Hub to a previous state.
#
# ASSUMPTIONS:
#   - Mode 1 (default): Git-based rollback — checkout previous commit, rebuild, restart.
#   - Mode 2: If you use a container registry with tagged images, set ROLLBACK_TAG
#     (e.g. ROLLBACK_TAG=v1.0.0) and ensure docker-compose uses that tag.
#
# Run from repo root: ./scripts/rollback.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$ROOT_DIR"

echo "==> Rollback"
echo ""

# Image-tag rollback (if ROLLBACK_TAG is set)
if [ -n "${ROLLBACK_TAG:-}" ]; then
  echo "Using ROLLBACK_TAG=$ROLLBACK_TAG"
  echo "Ensure docker-compose.yml uses image tags; update and run:"
  echo "  docker compose pull && docker compose up -d"
  exit 0
fi

# Git-based rollback
if ! git rev-parse --git-dir >/dev/null 2>&1; then
  echo "Not a git repo. Manual rollback:"
  echo "  1. Restore previous code/images"
  echo "  2. docker compose down && docker compose up -d"
  exit 1
fi

PREV=$(git rev-parse HEAD~1 2>/dev/null || true)
if [ -z "$PREV" ]; then
  echo "No previous commit. Nothing to roll back to."
  exit 1
fi

echo "Will roll back to: $(git log -1 --oneline "$PREV")"
read -r -p "Continue? [y/N] " reply
if [[ ! "$reply" =~ ^[yY]$ ]]; then
  echo "Aborted"
  exit 0
fi

echo "==> Stashing local changes..."
git stash --include-untracked 2>/dev/null || true

echo "==> Checking out previous commit..."
git checkout "$PREV"

echo "==> Rebuilding and restarting..."
docker compose build --no-cache
docker compose down
docker compose up -d

echo "==> Waiting for services..."
sleep 8

echo ""
echo "==> Health check"
OK=0
if curl -sf http://localhost/api/health >/dev/null 2>&1; then
  echo "  /api/health: OK"
  OK=1
else
  echo "  /api/health: FAIL"
fi
if curl -sf http://localhost/api/ready >/dev/null 2>&1; then
  echo "  /api/ready:  OK"
else
  echo "  /api/ready:  FAIL"
fi

echo ""
echo "Rollback complete."
echo "To return to latest: git checkout main && ./scripts/deploy.sh"
if git stash list | grep -q .; then
  echo "To restore stashed changes: git stash pop"
fi
