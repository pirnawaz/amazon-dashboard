# Ops runbooks (Sprint 19)

Copy-paste friendly procedures for backup, restore, upgrade, and common failures. See also [BACKUPS.md](BACKUPS.md) and [OPERATIONS.md](OPERATIONS.md).

---

## Backup procedure

**Prerequisites:** Docker Compose stack running; run from `amazon-dashboard/` (repo root).

1. Create backup directory if needed:
   ```bash
   mkdir -p backups
   ```

2. Run backup (keeps last 7 files):
   ```bash
   ./scripts/backup_db.sh
   ```
   Output: `backups/backup_YYYYMMDD_HHMMSS.sql`

3. **Optional:** Copy backups off-host (e.g. S3, another server) so a single-droplet failure doesn’t lose them.

4. **Volumes:** Postgres data lives in Docker volume `postgres_data`. To snapshot the volume:
   ```bash
   docker run --rm -v amazon-dashboard_postgres_data:/data -v $(pwd)/backups:/backup alpine tar czf /backup/postgres_volume_$(date +%Y%m%d).tar.gz -C /data .
   ```
   Restore volume from tarball by extracting into a new volume and starting `db` with it.

---

## Restore procedure

**Warning:** Restore overwrites or adds to the current database. Stop app traffic if you need a clean restore.

1. **Verify backup file exists:**
   ```bash
   ls -la backups/backup_YYYYMMDD_HHMMSS.sql
   ```

2. **Restore:**
   ```bash
   ./scripts/restore_db.sh backups/backup_YYYYMMDD_HHMMSS.sql
   ```

3. **Verify:** Log in to the app; run a quick check (e.g. dashboard loads, `GET /api/health` returns `ok` and `db: ok`).

4. **Full replace (optional):** To drop and recreate the database before restore:
   ```bash
   docker compose exec db psql -U amazon_user -d postgres -c "DROP DATABASE IF EXISTS amazon_dashboard;"
   docker compose exec db psql -U amazon_user -d postgres -c "CREATE DATABASE amazon_dashboard;"
   ./scripts/restore_db.sh backups/backup_YYYYMMDD_HHMMSS.sql
   ```

---

## Rotate secrets safely

1. **Update `.env`** with new values (e.g. `JWT_SECRET`, `POSTGRES_PASSWORD`, `SMTP_PASS`). Do not commit `.env`.

2. **Restart services** so they pick up new env:
   ```bash
   docker compose down
   docker compose up -d
   ```

3. **If you changed `POSTGRES_PASSWORD`:** Existing `DATABASE_URL` in `.env` must use the new password. Backend and workers connect via `DATABASE_URL`; after restart they use the new secret.

4. **If you changed `JWT_SECRET`:** All existing JWTs become invalid; users must log in again.

---

## Upgrade (pull → rebuild → migrate → verify)

1. **Pull latest code:**
   ```bash
   cd amazon-dashboard
   git fetch origin
   git pull --rebase
   ```

2. **Rebuild and start:**
   ```bash
   docker compose up -d --build
   ```

3. **Run migrations:**
   ```bash
   docker compose run --rm backend python -m alembic upgrade head
   ```

4. **Verify health:**
   ```bash
   curl -s http://localhost/api/health
   ```
   Expect: `{"status":"ok","version":"...","db":"ok"}`. If `db: fail`, check DB container and `DATABASE_URL`.

5. **Smoke test:** Open app in browser; log in; open Dashboard, Ads, Restock, Forecast. No 5xx or blank pages.

---

## Disaster recovery checklist

- [ ] Backups run on a schedule (e.g. cron daily) and are stored off-host.
- [ ] Restore has been tested at least once (e.g. restore to a staging DB or local).
- [ ] `.env` (and any secret store) is backed up securely; team knows how to rotate secrets.
- [ ] Health endpoint is monitored (`GET /api/health`); alerts fire when `status != ok` or `db == fail`.
- [ ] Runbook location is known (this doc + BACKUPS.md + OPERATIONS.md).

---

## Common failure modes

| Symptom | What to check | Action |
|--------|----------------|--------|
| **503 / db: fail** | DB container down or unreachable | `docker compose ps db`; `docker compose logs db`; check `DATABASE_URL` and `POSTGRES_*` in `.env`. |
| **5xx on API** | Backend crash or misconfiguration | `docker compose logs backend`; check `request_id` in error response and search logs. |
| **Blank frontend / CORS** | Wrong origin | Set `FRONTEND_ORIGIN` in `.env` to the URL users use (e.g. `https://sellerhub.example.com`). |
| **Migrations fail** | Revision conflict or DB state | `docker compose run --rm backend python -m alembic current`; `alembic history`; fix or downgrade per Alembic docs; avoid manual DB edits. |
| **Disk full** | Logs or Docker | `docker system df`; `docker system prune -a` (careful); rotate logs; see “Log rotation” below. |
| **Slow requests** | Heavy queries | Check backend logs for `slow_request` (duration_ms ≥ `SLOW_QUERY_MS`); add indexes or limit date ranges. |

---

## Log rotation (Docker)

Docker stores container logs under its data root. To avoid unbounded growth:

- **Docker daemon:** In `/etc/docker/daemon.json` (Linux) set:
  ```json
  {
    "log-driver": "json-file",
    "log-opts": {
      "max-size": "50m",
      "max-file": "3"
    }
  }
  ```
  Then `systemctl restart docker`. New containers use these limits.

- **Per service (Compose):** In `docker-compose.yml` under the service:
  ```yaml
  logging:
    driver: "json-file"
    options:
      max-size: "50m"
      max-file: "3"
  ```

Existing containers may need to be recreated for new limits to apply.
