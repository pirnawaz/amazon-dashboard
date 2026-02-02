# Phase 9: Amazon SP-API connection tracking – migrations

## Run migrations (Docker)

From the **`amazon-dashboard`** directory (where `docker-compose.yml` lives):

**Apply all pending migrations (including Phase 9):**
```bash
docker compose run --rm backend sh -c "alembic upgrade head"
```

**If the backend container is already running:**
```bash
docker compose exec backend sh -c "alembic upgrade head"
```

**Roll back Phase 9 only (downgrade one revision):**
```bash
docker compose run --rm backend sh -c "alembic downgrade -1"
```

**Roll back to revision 0005 (before Phase 9):**
```bash
docker compose run --rm backend sh -c "alembic downgrade 0005"
```

**Check current revision:**
```bash
docker compose run --rm backend sh -c "alembic current"
```

**Show migration history:**
```bash
docker compose run --rm backend sh -c "alembic history"
```

## Tables added (Phase 9)

- **amazon_connection** – Single app-level SP-API connection (single-tenant; one row per app).
- **amazon_credential** – LWA refresh token (encrypted) and note per connection; FK to `amazon_connection`.

Indexes: `status`, `updated_at` on `amazon_connection`; `updated_at` (and `connection_id`) on `amazon_credential`.
