# Phase 11.4 — Inventory freshness + stale warnings: verification

## Files changed/added

### Backend

| File | Change |
|------|--------|
| `.env.example` | Added `INVENTORY_STALE_WARNING_HOURS=24`, `INVENTORY_STALE_CRITICAL_HOURS=72` |
| `app/core/config.py` | Added `inventory_stale_warning_hours`, `inventory_stale_critical_hours` from env |
| `app/services/inventory_service.py` | Added `_age_hours`, `freshness_from_timestamp(ts)`; kept `freshness_days`/`is_stale` for backward compat |
| `app/schemas/amazon.py` | Added `last_inventory_sync_age_hours`, `last_inventory_sync_freshness` to `AmazonConnectionResponse` |
| `app/api/routes/amazon.py` | Compute and include freshness in `_connection_to_response` |
| `app/schemas/inventory.py` | Added `as_of_at`, `inventory_freshness`, `inventory_age_hours` to `InventoryItemResponse` |
| `app/api/routes/inventory.py` | Build inventory response with as_of_at and hour-based freshness |
| `app/services/alerts_service.py` | Stale inventory: hour-based thresholds; `_stale_inventory_alert_for_inv`; dedupe `inventory_stale:{marketplace}:{sku}:{severity}` |
| `app/schemas/restock_actions.py` | Added `inventory_freshness`, `inventory_age_hours`, `inventory_as_of_at`, `inventory_warning_message` to `RestockActionItem` |
| `app/api/routes/restock_actions.py` | Use `freshness_from_timestamp` and as_of_at; populate new fields when inventory used |
| `app/schemas/forecast_restock.py` | Added optional `inventory_freshness`, `inventory_age_hours`, `inventory_as_of_at`, `inventory_warning_message` |

### Frontend

| File | Change |
|------|--------|
| `src/api.ts` | Types: `AmazonConnectionResponse` (+ age_hours, freshness), `RestockActionItem` (+ inventory_*), `InventoryItemResponse` (+ as_of_at, inventory_freshness, inventory_age_hours) |
| `src/pages/AmazonConnection.tsx` | Inventory Sync (FBA) panel: freshness badge (Fresh/Warning/Critical/Unknown), age in hours |
| `src/components/restock/RestockTable.tsx` | New "Inventory" column: freshness badge + "Stale data" when `inventory_warning_message` present |

---

## Verification steps

### 1. API: connection-level freshness

- **Endpoint:** `GET /api/amazon/connection` (owner-only).
- **Check:** Response includes `last_inventory_sync_age_hours` (number or null) and `last_inventory_sync_freshness` ("unknown" | "fresh" | "warning" | "critical").
- **Example:** After a recent sync, `last_inventory_sync_freshness` should be `"fresh"` and `last_inventory_sync_age_hours` a small number. If sync was >24h ago, expect `"warning"`; >72h expect `"critical"`.

### 2. API: SKU-level inventory freshness

- **Endpoint:** `GET /api/inventory` or `GET /api/inventory/{marketplace}/{sku}`.
- **Check:** Each item has `as_of_at`, `inventory_freshness`, `inventory_age_hours` (in addition to existing `freshness_days`, `is_stale`).
- **Example:**  
  `GET /api/inventory/US/SKU123`  
  Response should include e.g. `"as_of_at": "2025-02-01T12:00:00+00:00"`, `"inventory_freshness": "fresh"`, `"inventory_age_hours": 2.5`.

### 3. API: restock actions with inventory freshness

- **Endpoint:** `GET /api/restock/actions/sku/{sku}?marketplace=US` (no `current_stock_units` so backend uses inventory_levels).
- **Check:** Item includes `inventory_freshness`, `inventory_age_hours`, `inventory_as_of_at`, and when stale `inventory_warning_message`.
- **Example:** Stale inventory should yield `inventory_freshness: "warning"` or `"critical"` and a non-empty `inventory_warning_message`.

### 4. Simulate stale data and see alert/UI

**Backend (DB):**

- Set `as_of_at` (or `updated_at`) of an `inventory_levels` row to the past:
  - **Warning:** e.g. 25 hours ago:  
    `UPDATE inventory_levels SET as_of_at = NOW() - INTERVAL '25 hours' WHERE sku = 'YOUR_SKU' AND marketplace = 'US';`
  - **Critical:** e.g. 80 hours ago:  
    `UPDATE inventory_levels SET as_of_at = NOW() - INTERVAL '80 hours' WHERE sku = 'YOUR_SKU' AND marketplace = 'US';`
- For connection-level: set `amazon_connection.last_inventory_sync_at` to the past (e.g. 30 hours ago) and reload Admin Amazon Connection page; badge should show "Warning" and age in hours.

**Alerts:**

- Run the alerts worker (or trigger alert generation). For the stale SKU+marketplace you should get an `inventory_stale` alert with severity `warning` or `critical`, message including sku, marketplace, age in hours, and last timestamp. Dedupe: one alert per `(sku, marketplace, severity)` (e.g. `inventory_stale:US:SKU123:warning`).

**UI:**

- **Admin Amazon Connection:** Inventory Sync (FBA) shows badge (Fresh/Warning/Critical/Unknown) and "Age (hours)" when `last_inventory_sync_at` is set.
- **Restock (Restock Actions, SKU view):** Table shows "Inventory" column with freshness badge; when stale, "Stale data" and tooltip with warning message.

### 5. Partner cannot access admin info/actions

- **Admin endpoints** (e.g. `GET /api/amazon/connection`, `POST /api/admin/amazon/inventory/sync`) use `require_owner`. A partner (non-owner) user must receive 403 Forbidden.
- **Check:** Log in as partner; call `GET /api/amazon/connection` — expect 403. Amazon Connection page should show "Owner access required" (existing behavior). No schema or response changes for non-owners.

### 6. Environment and thresholds

- In `.env` (or env): set `INVENTORY_STALE_WARNING_HOURS=24` and `INVENTORY_STALE_CRITICAL_HOURS=72` (defaults if omitted).
- After changing thresholds, restart backend. Stale logic uses these values from config (no DB migration).

---

## Summary

- **Connection-level:** `last_inventory_sync_at` → `last_inventory_sync_age_hours` + `last_inventory_sync_freshness` on Amazon Connection response and Admin UI.
- **SKU-level:** `inventory_levels.as_of_at` (or `updated_at`) → `as_of_at`, `inventory_freshness`, `inventory_age_hours` on inventory and restock APIs.
- **Alerts:** Stale inventory alerts use hour thresholds, dedupe by `sku+marketplace+severity`, message includes sku, marketplace, age (hours), and last timestamp.
- **Restock/UI:** RestockActionItem (and optional ForecastRestockPlanResponse) include inventory freshness fields; Restock UI shows badge and warning when stale.
- **Safety:** No breaking schema changes; existing fields kept; partner cannot access owner-only Amazon Connection/admin actions.
