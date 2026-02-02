# Operations (Seller Hub)

Day-to-day operations: logs, debugging, rate limits.

## Logs

- **Backend:** Logs go to stdout/stderr. With Docker: `docker compose logs -f backend`. In production, wire stdout to your log aggregator (e.g. journald, CloudWatch, Datadog).
- **Request logging:** Each request is logged with method, path, status, and request ID. Use the request ID from API error responses to correlate with server logs.
- **Frontend:** Browser console and network tab; no server-side frontend logs.

## Debugging

1. **API errors:** Check the `request_id` in the JSON error body and search backend logs for that ID.
2. **DB issues:** Run `docker compose exec backend python -c "from app.db.session import engine; from sqlalchemy import text; engine.connect().execute(text('SELECT 1'))"` to test DB connectivity.
3. **Health:** `GET /api/health` and `GET /api/ready` (see DEPLOYMENT.md).
4. **Version:** `GET /api/version` — returns app version (matches frontend footer) for instant "what's running?" debugging.
5. **Frontend:** Ensure `FRONTEND_ORIGIN` matches the URL users use; CORS will block mismatched origins.

## When things go wrong (2am checklist)

1. **App down or returning 5xx**
   - `docker compose ps` — all services running?
   - `docker compose logs -f backend` — errors?
   - `curl http://localhost/api/health` — backend reachable?
   - `curl http://localhost/api/ready` — DB reachable?

2. **DB connection failed**
   - `docker compose ps db` — db container up?
   - `docker compose exec db pg_isready -U amazon_user -d amazon_dashboard` — DB ready?
   - Check `.env`: `POSTGRES_*` and `DATABASE_URL` correct for Docker (use `db:5432`, not `localhost`).

3. **Frontend blank or CORS errors**
   - Check `FRONTEND_ORIGIN` in `.env` — must match the URL users type (e.g. `https://sellerhub.example.com`).
   - `docker compose logs frontend` — any startup errors?

4. **Need to rollback**
   - `./scripts/rollback.sh` — rolls back to previous git commit, rebuilds, restarts.
   - Or manually: `git checkout <previous-commit>`, `docker compose build --no-cache`, `docker compose up -d`.

5. **Migrations failed**
   - `docker compose exec backend alembic current` — current revision?
   - `docker compose exec backend alembic history` — migration history?
   - If stuck, check alembic docs for downgrade; avoid manual DB changes.

6. **Disk full**
   - `docker system df` — space usage.
   - `docker system prune -a` — removes unused images (use with care).
   - Rotate backups; see `docs/BACKUPS.md`.

## Rate limits

- The API applies a per-minute rate limit per IP (and per authenticated user when a JWT is present).
- Default: 100 requests per minute (configurable via `RATE_LIMIT_PER_MINUTE`).
- When exceeded, the API returns **429 Too Many Requests** with an error message.
- If you see 429s, either increase the limit or throttle client requests.

## Session expiry

- JWT tokens expire after a configurable period (default 60 minutes).
- On 401 Unauthorized, the frontend clears the session and redirects to login with a "Session expired" message.
- Users must log in again after expiry.

## Backups

See `docs/BACKUPS.md` for database backup and restore.
