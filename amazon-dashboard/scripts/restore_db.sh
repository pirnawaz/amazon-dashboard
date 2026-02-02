#!/usr/bin/env bash
# Restore PostgreSQL from a backup file via Docker Compose.
# Usage: ./scripts/restore_db.sh [backup_file]
# Example: ./scripts/restore_db.sh backups/backup_20250101_120000.sql
# Run from repo root (amazon-dashboard).

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

if [ -z "$1" ]; then
  echo "Usage: $0 <backup_file>"
  echo "Example: $0 backups/backup_20250101_120000.sql"
  exit 1
fi

BACKUP_FILE="$1"
if [ ! -f "$BACKUP_FILE" ]; then
  if [ -f "$ROOT_DIR/$BACKUP_FILE" ]; then
    BACKUP_FILE="$ROOT_DIR/$BACKUP_FILE"
  else
    echo "File not found: $1"
    exit 1
  fi
fi

cd "$ROOT_DIR"
echo "Restoring from $BACKUP_FILE ..."
docker compose exec -T db psql -U "${POSTGRES_USER:-amazon_user}" -d "${POSTGRES_DB:-amazon_dashboard}" < "$BACKUP_FILE"
echo "Restore completed."
