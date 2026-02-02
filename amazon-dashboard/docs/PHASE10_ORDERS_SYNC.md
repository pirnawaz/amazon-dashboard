# Phase 10: SP-API orders sync

## Purpose / overview

Phase 10 implements **Amazon SP-API orders sync**: pull orders (and optionally order items) from SP-API, store them in the app database, and track sync status on the single-tenant `amazon_connection` row. It also adds **SP-API ping** (last check) so owners can verify the stored refresh token works. All of this is **implemented in code and migrations**; this doc aligns written documentation with the codebase.

- **10.1c:** Store last SP-API ping result on `amazon_connection` (last_check_at, last_check_ok, last_check_error).
- **10.2:** Orders sync tracking on connection (last_orders_sync_at, status, error).
- **10.3:** `amazon_order` table for synced orders.
- **10.4:** `amazon_order_item` table for synced order line items.
- **10.4.1:** `order_items` source/source_order_item_id; `marketplaces.currency` nullable.
- **10.5:** Sync counts on connection (last_orders_sync_orders_count, last_orders_sync_items_count).

Owner-only: SP-API ping and orders sync trigger. Background worker can run periodic orders sync (Phase 10.2 + 10.3).

---

## DB changes (migrations)

| Revision | File | What it adds |
|----------|------|---------------|
| **0007** | `0007_amazon_connection_last_check.py` | `amazon_connection`: last_check_at, last_check_ok, last_check_error |
| **0008** | `0008_amazon_connection_orders_sync.py` | `amazon_connection`: last_orders_sync_at, last_orders_sync_status, last_orders_sync_error |
| **0009** | `0009_amazon_order.py` | Table `amazon_order` (amazon_order_id, marketplace_id, purchase_date, order_status, order_total_*, raw_payload, unique on amazon_order_id+marketplace_id) |
| **0010** | `0010_amazon_order_item.py` | Table `amazon_order_item` (order_item_id, amazon_order_id, marketplace_id, seller_sku, asin, quantity_ordered, item_price_*, raw_payload) |
| **0011** | `0011_order_items_source_marketplace_currency_nullable.py` | `order_items`: source, source_order_item_id (unique index where not null); `marketplaces.currency` nullable |
| **0012** | `0012_amazon_connection_orders_sync_counts.py` | `amazon_connection`: last_orders_sync_orders_count, last_orders_sync_items_count |

---

## Key backend modules / routes

- **Services:** `backend/app/services/amazon_orders_sync.py` — run_orders_sync (Phase 10.2 + 10.3 + 10.4).
- **Worker:** `backend/app/worker/amazon_orders_sync_worker.py` — periodic orders sync (Phase 10.2 + 10.3).
- **Routes:**  
  - `backend/app/api/routes/admin_amazon_spapi.py` — owner-only SP-API ping (Phase 10.1c); uses DB-stored encrypted refresh token.  
  - `backend/app/api/routes/admin_amazon_orders.py` — owner-only `POST /api/admin/amazon/orders/sync` (dry_run, include_items).
- **Models:** `backend/app/models/amazon_order.py`, `backend/app/models/amazon_order_item.py`.

---

## How to run / verify locally

1. **Apply migrations** (from `amazon-dashboard`):
   ```bash
   docker compose run --rm backend python -m alembic upgrade head
   ```
   Confirm revisions 0007–0012 are applied: `docker compose run --rm backend python -m alembic current`.

2. **Login as owner** (first registered user). Get JWT and call:
   - `GET /api/amazon/connection` — single connection or null.
   - `PUT /api/amazon/connection` — create/update connection (Phase 9).
   - `PUT /api/amazon/credential` — store LWA refresh token (Phase 9). See `PHASE9_2_AMAZON_API.md`.

3. **SP-API ping (Phase 10.1c):**
   - `POST /api/admin/amazon/sp-api/ping` (or equivalent admin ping endpoint) with owner JWT.  
   - Check `GET /api/amazon/connection` — last_check_at, last_check_ok, last_check_error should be set.

4. **Orders sync trigger (Phase 10.2 / 10.3 / 10.4):**
   - `POST /api/admin/amazon/orders/sync` (owner only). Optional: `?dry_run=true` to stub; `?include_items=true` to sync order items.
   - Check connection again: last_orders_sync_at, last_orders_sync_status, last_orders_sync_orders_count, last_orders_sync_items_count.
   - Query DB: `amazon_order` and `amazon_order_item` should have rows if sync ran and SP-API returned data.

5. **Frontend:** Admin → Amazon Orders (or equivalent) — trigger sync and see status/counts.
