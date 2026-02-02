# Phase 11.5 — Restock logic uses real inventory (inventory_levels) as source of truth: verification

## Files changed/added

### Backend

| File | Change |
|------|--------|
| `app/services/inventory_service.py` | **upsert_inventory**: only acts on `source='manual'` (never overwrites spapi). **delete_inventory**: only deletes manual row by `(SOURCE_MANUAL, manual_source_key)`. **get_on_hand_for_restock(db, sku, marketplace)** → `(on_hand, source, warning)` — single source of truth; returns (0, None, "No inventory data found") when no row. |
| `app/api/routes/forecast_restock.py` | **On-hand**: when `marketplace != "ALL"` use **inventory_levels** via `get_on_hand_for_restock`; fallback to **inventory_snapshots** (legacy). When `marketplace == "ALL"` use legacy **inventory_snapshots**. Populate `inventory_source`, `no_inventory_data`, and existing freshness fields. Renamed `_get_latest_on_hand` → `_get_latest_on_hand_snapshots`. |
| `app/schemas/forecast_restock.py` | Added optional `inventory_source` ("spapi" \| "manual" \| "legacy"), `no_inventory_data` (bool). |
| `app/api/routes/inventory.py` | **GET /inventory/restock**: when `marketplace != "ALL"`, overwrite on_hand per SKU from **inventory_levels** via `get_on_hand_for_restock`; fallback stays **inventory_snapshots**. Added `source_by_sku` and **RestockRow.inventory_source**. |
| `app/schemas/inventory.py` | **RestockRow**: optional `inventory_source` (str \| null). |
| `app/api/restock.py` | **POST /restock/plan**: when `current_inventory` omitted, resolve from **inventory_levels** via `get_on_hand_for_restock`; use 0 and set `no_inventory_data=True` when no row. Response includes `no_inventory_data`, `inventory_source`. |
| `app/schemas/restock.py` | **RestockPlanResponse**: optional `no_inventory_data` (bool), `inventory_source` (str \| null). |
| `app/api/routes/restock_actions.py` | When no inventory row for SKU+marketplace: set `effective_stock = 0` and attach warning "No inventory data found" (do not crash). Propagate warning in reasoning. |

### Frontend

| File | Change |
|------|--------|
| `src/api.ts` | **RestockRow**: optional `inventory_source`. **ForecastRestockPlanResponse**: optional `inventory_source`, `no_inventory_data`. **RestockPlanResponse**: optional `no_inventory_data`, `inventory_source`. |
| `src/Restock.tsx` | On Hand column: tooltip `Source: ${r.inventory_source}` when `inventory_source` is set. |
| `src/Inventory.tsx` | On hand column: tooltip `Source: ${row.source}` when present (inventory_levels source). |

---

## Verification steps

### 1) Restock plan changes when inventory_levels changes

**1a) Set inventory_levels (manual) for a SKU+marketplace; verify restock uses it if no spapi**

- Create or update manual inventory: `PUT /api/inventory` with `{ "sku": "YOUR_SKU", "marketplace": "US", "on_hand_units": 50, "reserved_units": 0 }`.
- Call `GET /api/forecast/restock-plan?sku=YOUR_SKU&marketplace=US` (or `GET /api/restock/actions/sku/YOUR_SKU?marketplace=US` without `current_stock_units`). Response should use on_hand = 50 and show `inventory_source: "manual"` (or equivalent).
- Call `GET /api/inventory/restock?marketplace=US`; row for YOUR_SKU should show `on_hand: 50` and tooltip/source "manual".

**1b) Run inventory sync + bridge to create spapi row; verify restock switches to spapi**

- Run admin inventory sync and bridge so that an **inventory_levels** row exists with `source='spapi'` for the same (sku, marketplace).
- Again call `GET /api/forecast/restock-plan?sku=YOUR_SKU&marketplace=US` and restock actions. Response should now use the **spapi** row’s on_hand and show `inventory_source: "spapi"` (manual row still exists but is not "best" per `get_inventory`).
- `GET /api/inventory/restock?marketplace=US` should show on_hand from spapi and source "spapi".

**1c) Simulate stale inventory; verify warnings appear but calculations still run**

- Set `as_of_at` (or `updated_at`) of the **inventory_levels** row to the past, e.g. 25 hours ago (or use env `INVENTORY_STALE_WARNING_HOURS=24`).
- Call restock/forecast endpoints. Calculations should still run (on_hand from that row). Response should include stale warning (e.g. `inventory_warning_message` or reasoning line) per Phase 11.4.

### 2) SQL to inspect which source is used (manual vs spapi)

```sql
-- List inventory_levels for a SKU+marketplace; "best" row is spapi then latest as_of_at
SELECT id, sku, marketplace, source, source_key, on_hand_units, as_of_at, updated_at
FROM inventory_levels
WHERE sku = 'YOUR_SKU' AND marketplace = 'US'
ORDER BY (source = 'spapi') DESC, as_of_at DESC NULLS LAST;

-- See which row would be chosen by get_inventory (first row from above order)
SELECT * FROM inventory_levels
WHERE sku = 'YOUR_SKU' AND marketplace = 'US'
ORDER BY (source = 'spapi') DESC, as_of_at DESC NULLS LAST
LIMIT 1;
```

### 3) Confirm manual endpoints cannot overwrite spapi inventory

- **Upsert**: Manual upsert only targets the row with `(source='manual', source_key='manual_<sku>_<marketplace>')`. It never updates a row with `source='spapi'`.  
  - Verify: Create spapi row (via sync+bridge). Call `PUT /api/inventory` with same sku+marketplace and new on_hand_units. Query DB: the **spapi** row’s `on_hand_units` must be unchanged; a **manual** row may have been created/updated.
- **Delete**: `DELETE /api/inventory/{marketplace}/{sku}` only deletes the **manual** row (same source_key). Spapi row must remain.  
  - Verify: After delete, `SELECT * FROM inventory_levels WHERE sku = '...' AND marketplace = '...'` — only the manual row should be gone; spapi row still present if it existed.

### 4) Alerts and audit

- Alerts (stockout / low-cover / stale) already read from **inventory_levels** via `list_inventory` / `get_inventory` (Phase 11.4). No change required; confirm alert generation still uses inventory_levels.
- Owner-only admin endpoints and audit patterns unchanged; no secrets in logs.

### 5) Frontend

- **Restock** (e.g. Restock.tsx): On Hand column shows tooltip "Source: spapi" or "Source: manual" when `inventory_source` is set.
- **Inventory** (Inventory.tsx): On hand column shows tooltip "Source: &lt;source&gt;" from inventory_levels row.
- Restock plan and forecast restock plan responses include optional `inventory_source` and `no_inventory_data`; UI can show them where appropriate.

---

## Summary

- **Single source of truth**: Restock and forecast restock read on-hand from **inventory_levels** via `get_inventory` / `get_on_hand_for_restock` (spapi preferred, then manual). No row → 0 + "No inventory data found" (no crash).
- **Forecast restock plan**: Marketplace-aware; when marketplace provided uses inventory_levels; else legacy inventory_snapshots. Optional `inventory_source`, `no_inventory_data` in response.
- **GET /inventory/restock**: When marketplace != "ALL", on_hand from inventory_levels per SKU; else legacy snapshots. Optional `inventory_source` per row.
- **POST /restock/plan**: When `current_inventory` omitted, resolved from inventory_levels; response includes `no_inventory_data`, `inventory_source`.
- **Manual endpoints**: Upsert/delete only act on `source='manual'`; spapi rows are read-only to manual API.
- **Frontend**: Optional source indicator in tooltip on On Hand (Restock, Inventory). No breaking schema changes; partner/owner access unchanged.
