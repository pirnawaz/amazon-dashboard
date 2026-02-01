# Database backup and restore

Backups are stored under `./backups/` on the host. The backup script runs `pg_dump` inside the PostgreSQL container and rotates to keep the last 7 files.

## Prerequisites

- Docker Compose stack running (so the `db` service exists).
- Run all commands from the **repo root** (`amazon-dashboard/`).

## Backup

```bash
./scripts/backup_db.sh
```

- Writes `backups/backup_YYYYMMDD_HHMMSS.sql`.
- Removes older backups so only the last 7 remain.

Ensure `POSTGRES_USER` and `POSTGRES_DB` match your `.env` (or set them for the command). Defaults: `amazon_user`, `amazon_dashboard`.

## Restore

```bash
./scripts/restore_db.sh backups/backup_20250101_120000.sql
```

- **Warning:** This replays SQL into the current database. It does not drop and recreate the DB; for a full replace you must do that separately (e.g. drop/create DB then restore, or restore into an empty DB).
- For a clean restore: stop app traffic, drop/create database if desired, then run the script.

## Cron (example)

Run a backup every day at 2:00 AM (example; do not set up automatically):

```bash
0 2 * * * cd /path/to/amazon-dashboard && ./scripts/backup_db.sh
```

Adjust `cd` path to your deployment directory.
