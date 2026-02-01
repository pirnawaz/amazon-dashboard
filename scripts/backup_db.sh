#!/usr/bin/env bash
# Backup PostgreSQL via Docker Compose. Keeps last 7 backups under ./backups/.
# Run from repo root (amazon-dashboard): ./scripts/backup_db.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKUP_DIR="$ROOT_DIR/backups"
KEEP=7

mkdir -p "$BACKUP_DIR"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
BACKUP_FILE="$BACKUP_DIR/backup_${TIMESTAMP}.sql"

cd "$ROOT_DIR"
docker compose exec -T db pg_dump -U "${POSTGRES_USER:-amazon_user}" "${POSTGRES_DB:-amazon_dashboard}" > "$BACKUP_FILE"
echo "Backup written: $BACKUP_FILE"

# Keep only last KEEP backups (by mtime)
ls -t "$BACKUP_DIR"/backup_*.sql 2>/dev/null | tail -n +$((KEEP + 1)) | while read -r f; do rm -- "$f"; done
echo "Rotation: kept last $KEEP backups"
