export type TokenResponse = {
  access_token: string;
  token_type: "bearer";
};

/** User role from backend (owner | partner). */
export type UserRole = "owner" | "partner";

export type UserPublic = {
  id: number;
  email: string;
  role: UserRole;
  created_at: string;
};

export type DashboardSummary = {
  revenue: number;
  units: number;
  orders: number;
  ad_spend: number;
  net_profit_placeholder: number;
};

export type DashboardTimeseriesPoint = {
  date: string;
  revenue: number;
  units: number;
  orders: number;
  ad_spend: number;
  net_profit_placeholder: number;
};

export type DashboardTimeseriesResponse = {
  days: number;
  marketplace: string;
  points: DashboardTimeseriesPoint[];
};

export type TopProductRow = {
  sku: string;
  title: string | null;
  asin: string | null;
  revenue: number;
  units: number;
  orders: number;
};

export type TopProductsResponse = {
  days: number;
  marketplace: string;
  limit: number;
  products: TopProductRow[];
};

export type RestockRow = {
  sku: string;
  title: string | null;
  asin: string | null;
  on_hand: number;
  avg_daily_units: number;
  days_of_cover: number;
  reorder_qty: number;
  risk_level: "CRITICAL" | "LOW" | "OK";
};

export type RestockResponse = {
  days: number;
  target_days: number;
  marketplace: string;
  limit: number;
  items: RestockRow[];
};

export type ForecastPoint = {
  date: string;
  units: number;
};

export type BacktestPoint = {
  date: string;
  actual_units: number;
  predicted_units: number;
};

export type ForecastRange = {
  low: number;
  expected: number;
  high: number;
};

export type ForecastIntelligence = {
  trend: "increasing" | "stable" | "decreasing" | "insufficient_data";
  confidence: "high" | "medium" | "low";
  daily_demand_estimate: number;
  volatility_cv: number;
  forecast_range: ForecastRange;
};

export type ForecastResponse = {
  kind: "total" | "sku";
  sku: string | null;
  marketplace: string;
  history_days: number;
  horizon_days: number;
  model_name: string;
  mae_30d: number;
  data_end_date: string;
  mape_30d: number;
  backtest_points: BacktestPoint[];
  actual_points: ForecastPoint[];
  forecast_points: ForecastPoint[];
  intelligence: ForecastIntelligence;
  recommendation: string;
  reasoning: string[];
};

export type ForecastRestockPlanResponse = {
  sku: string;
  marketplace: string;
  horizon_days: number;
  lead_time_days: number;
  service_level: number;
  avg_daily_forecast_units: number;
  forecast_units_lead_time: number;
  safety_stock_units: number;
  recommended_reorder_qty: number;
};

/** Request body for POST /api/restock/plan */
export type RestockPlanRequest = {
  sku: string;
  marketplace: string;
  lead_time_days: number;
  service_level?: number;
  current_inventory?: number;
};

/** Response from POST /api/restock/plan */
export type RestockPlanResponse = {
  sku: string;
  marketplace: string;
  lead_time_days: number;
  service_level: number;
  data_end_date: string;
  avg_daily_demand: number;
  lead_time_demand: number;
  safety_stock: number;
  reorder_quantity: number;
  mape_30d: number;
  days_of_cover?: number | null;
  expected_stockout_date?: string | null;
  stockout_before_lead_time?: boolean | null;
};

/** Restock Actions (Phase 5C) */

export type DemandRangeDaily = {
  low: number;
  expected: number;
  high: number;
};

export type RestockActionStatus = "healthy" | "watch" | "urgent" | "insufficient_data";

export type RestockActionItem = {
  sku: string | null;
  marketplace: string | null;
  horizon_days: number;
  lead_time_days: number;
  service_level: number;
  current_stock_units: number | null;
  daily_demand_estimate: number;
  demand_range_daily: DemandRangeDaily;
  days_of_cover_expected: number | null;
  days_of_cover_low: number | null;
  days_of_cover_high: number | null;
  stockout_date_expected: string | null;
  order_by_date: string | null;
  suggested_reorder_qty_expected: number;
  suggested_reorder_qty_high: number;
  status: RestockActionStatus;
  recommendation: string;
  reasoning: string[];
};

export type RestockActionsResponse = {
  generated_at: string;
  items: RestockActionItem[];
};

export type RestockActionsParams = {
  marketplace?: string;
  horizon_days?: number;
  lead_time_days?: number;
  service_level?: number;
  current_stock_units?: number | null;
};

/** Inventory levels (Phase 6) */

export type InventoryUpsertRequest = {
  sku: string;
  marketplace: string;
  on_hand_units: number;
  reserved_units?: number;
  source?: string;
  note?: string | null;
};

export type InventoryItemResponse = {
  sku: string;
  marketplace: string;
  on_hand_units: number;
  reserved_units: number;
  available_units: number;
  source: string;
  note: string | null;
  updated_at: string;
  created_at: string;
  freshness_days: number;
  is_stale: boolean;
};

export type InventoryListResponse = {
  items: InventoryItemResponse[];
};

export type InventoryListParams = {
  marketplace?: string;
  q?: string;
  limit?: number;
};

/** Alerts (Phase 7B) */

export type AlertEventResponse = {
  id: number;
  alert_type: string;
  severity: string;
  sku: string | null;
  marketplace: string | null;
  title: string;
  message: string;
  is_acknowledged: boolean;
  acknowledged_at: string | null;
  created_at: string;
};

export type AlertListResponse = {
  items: AlertEventResponse[];
};

export type AlertListParams = {
  severity?: string;
  unacknowledged?: boolean;
  limit?: number;
};

export type AlertSettingsResponse = {
  email_enabled: boolean;
  email_recipients: string | null;
  send_inventory_stale: boolean;
  send_urgent_restock: boolean;
  send_reorder_soon: boolean;
  send_order_by_passed: boolean;
  stale_days_threshold: number;
  updated_at: string;
};

export type AlertSettingsUpdateRequest = {
  email_enabled?: boolean;
  email_recipients?: string | null;
  send_inventory_stale?: boolean;
  send_urgent_restock?: boolean;
  send_reorder_soon?: boolean;
  send_order_by_passed?: boolean;
  stale_days_threshold?: number;
};

/** Audit log (admin, owner-only) */
export type AuditLogEntry = {
  id: string;
  created_at: string;
  actor_user_id: number;
  actor_email?: string | null;
  action: string;
  resource_type: string;
  resource_id?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type AuditLogListResponse = {
  items: AuditLogEntry[];
  limit: number;
  offset: number;
  total: number;
};

/** Called when the API returns 401 (session expired). Set by AuthProvider to clear auth and redirect. */
let onUnauthorized: (() => void) | null = null;
export function setOnUnauthorized(callback: (() => void) | null): void {
  onUnauthorized = callback;
}

export type ForecastTopSkuRow = {
  sku: string;
  title: string;
  revenue: number;
};

async function http<T>(url: string, options: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });

  if (!res.ok) {
    if (res.status === 401 && onUnauthorized) {
      onUnauthorized();
    }
    const text = await res.text();
    try {
      const j = JSON.parse(text) as {
        error?: { message?: string };
        detail?: string;
        message?: string;
      };
      const msg =
        (j.error?.message ?? j.detail ?? j.message ?? text) || `Request failed: ${res.status}`;
      throw new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
    } catch (e) {
      if (e instanceof SyntaxError) throw new Error(text || `Request failed: ${res.status}`);
      throw e;
    }
  }
  return (await res.json()) as T;
}

export async function register(email: string, password: string): Promise<TokenResponse> {
  return http<TokenResponse>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export async function login(email: string, password: string): Promise<TokenResponse> {
  return http<TokenResponse>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

/** GET /api/me — current user (legacy). */
export async function me(token: string): Promise<UserPublic> {
  return http<UserPublic>("/api/me", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

/** Fetch current user: tries GET /api/auth/me first, falls back to GET /api/me. */
export async function fetchCurrentUser(token: string): Promise<UserPublic> {
  try {
    return await http<UserPublic>("/api/auth/me", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
  } catch {
    return await me(token);
  }
}

export async function dashboardSummary(
  token: string,
  params: { days: number; marketplace: string }
): Promise<DashboardSummary> {
  const sp = new URLSearchParams({
    days: String(params.days),
    marketplace: params.marketplace,
  });
  return http<DashboardSummary>(`/api/dashboard/summary?${sp}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export async function timeseries(
  token: string,
  params: { days: number; marketplace: string }
): Promise<DashboardTimeseriesResponse> {
  const sp = new URLSearchParams({
    days: String(params.days),
    marketplace: params.marketplace,
  });
  return http<DashboardTimeseriesResponse>(`/api/dashboard/timeseries?${sp}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export async function topProducts(
  token: string,
  params: { days: number; marketplace: string; limit: number }
): Promise<TopProductsResponse> {
  const sp = new URLSearchParams({
    days: String(params.days),
    marketplace: params.marketplace,
    limit: String(params.limit),
  });
  return http<TopProductsResponse>(`/api/dashboard/top-products?${sp}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

/** Returns SKU strings from top products for the given marketplace (for suggestions). */
export async function suggestedSkus(token: string, marketplace: string): Promise<string[]> {
  const res = await topProducts(token, { days: 30, marketplace, limit: 50 });
  return res.products.map((p) => p.sku);
}

export async function restock(
  token: string,
  params: { days: number; target_days: number; marketplace: string; limit: number }
): Promise<RestockResponse> {
  const sp = new URLSearchParams({
    days: String(params.days),
    target_days: String(params.target_days),
    marketplace: params.marketplace,
    limit: String(params.limit),
  });
  return http<RestockResponse>(`/api/inventory/restock?${sp}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export async function forecastTotal(
  token: string,
  params: { history_days: number; horizon_days: number; marketplace: string }
): Promise<ForecastResponse> {
  const sp = new URLSearchParams({
    history_days: String(params.history_days),
    horizon_days: String(params.horizon_days),
    marketplace: params.marketplace,
  });
  return http<ForecastResponse>(`/api/forecast/total?${sp}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export async function forecastSku(
  token: string,
  params: { sku: string; history_days: number; horizon_days: number; marketplace: string }
): Promise<ForecastResponse> {
  const sp = new URLSearchParams({
    sku: params.sku,
    history_days: String(params.history_days),
    horizon_days: String(params.horizon_days),
    marketplace: params.marketplace,
  });
  return http<ForecastResponse>(`/api/forecast/sku?${sp}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export async function forecastTopSkus(
  token: string,
  params: { days: number; marketplace: string; limit: number }
): Promise<ForecastTopSkuRow[]> {
  const sp = new URLSearchParams({
    days: String(params.days),
    marketplace: params.marketplace,
    limit: String(params.limit),
  });
  return http<ForecastTopSkuRow[]>(`/api/forecast/top-skus?${sp}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export async function forecastRestockPlan(
  token: string,
  params: {
    sku: string;
    horizon_days?: number;
    lead_time_days?: number;
    service_level?: number;
    marketplace?: string;
  }
): Promise<ForecastRestockPlanResponse> {
  const sp = new URLSearchParams({
    sku: params.sku,
    horizon_days: String(params.horizon_days ?? 30),
    lead_time_days: String(params.lead_time_days ?? 14),
    service_level: String(params.service_level ?? 0.1),
    marketplace: params.marketplace ?? "ALL",
  });
  return http<ForecastRestockPlanResponse>(`/api/forecast/restock-plan?${sp}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export async function restockPlan(
  token: string,
  body: RestockPlanRequest
): Promise<RestockPlanResponse> {
  return http<RestockPlanResponse>("/api/restock/plan", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      sku: body.sku,
      marketplace: body.marketplace,
      lead_time_days: body.lead_time_days,
      ...(body.service_level != null && { service_level: body.service_level }),
      ...(body.current_inventory != null && { current_inventory: body.current_inventory }),
    }),
  });
}

/** GET /api/restock/actions/total — restock actions for total forecast */
export async function getRestockActionsTotal(
  token: string,
  params: RestockActionsParams
): Promise<RestockActionsResponse> {
  const sp = new URLSearchParams();
  if (params.marketplace != null) sp.set("marketplace", params.marketplace);
  if (params.horizon_days != null) sp.set("horizon_days", String(params.horizon_days));
  if (params.lead_time_days != null) sp.set("lead_time_days", String(params.lead_time_days));
  if (params.service_level != null) sp.set("service_level", String(params.service_level));
  if (params.current_stock_units != null)
    sp.set("current_stock_units", String(params.current_stock_units));
  const qs = sp.toString();
  return http<RestockActionsResponse>(
    `/api/restock/actions/total${qs ? `?${qs}` : ""}`,
    {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    }
  );
}

/** GET /api/restock/actions/sku/:sku — restock actions for a SKU */
export async function getRestockActionsSku(
  token: string,
  sku: string,
  params: RestockActionsParams
): Promise<RestockActionsResponse> {
  const sp = new URLSearchParams();
  if (params.marketplace != null) sp.set("marketplace", params.marketplace);
  if (params.horizon_days != null) sp.set("horizon_days", String(params.horizon_days));
  if (params.lead_time_days != null) sp.set("lead_time_days", String(params.lead_time_days));
  if (params.service_level != null) sp.set("service_level", String(params.service_level));
  if (params.current_stock_units != null)
    sp.set("current_stock_units", String(params.current_stock_units));
  const qs = sp.toString();
  return http<RestockActionsResponse>(
    `/api/restock/actions/sku/${encodeURIComponent(sku)}${qs ? `?${qs}` : ""}`,
    {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    }
  );
}

/** GET /api/inventory — list inventory levels */
export async function getInventoryList(
  token: string,
  params: InventoryListParams = {}
): Promise<InventoryListResponse> {
  const sp = new URLSearchParams();
  if (params.marketplace != null) sp.set("marketplace", params.marketplace);
  if (params.q != null) sp.set("q", params.q);
  if (params.limit != null) sp.set("limit", String(params.limit));
  const qs = sp.toString();
  return http<InventoryListResponse>(`/api/inventory${qs ? `?${qs}` : ""}`, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });
}

/** GET /api/inventory/:marketplace/:sku — get one inventory level */
export async function getInventoryItem(
  token: string,
  marketplace: string,
  sku: string
): Promise<InventoryItemResponse> {
  return http<InventoryItemResponse>(
    `/api/inventory/${encodeURIComponent(marketplace)}/${encodeURIComponent(sku)}`,
    {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    }
  );
}

/** PUT /api/inventory — create or update inventory level */
export async function upsertInventory(
  token: string,
  payload: InventoryUpsertRequest
): Promise<InventoryItemResponse> {
  return http<InventoryItemResponse>("/api/inventory", {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      sku: payload.sku,
      marketplace: payload.marketplace,
      on_hand_units: payload.on_hand_units,
      reserved_units: payload.reserved_units ?? 0,
      source: payload.source ?? "manual",
      note: payload.note ?? null,
    }),
  });
}

/** GET /api/alerts — list alerts */
export async function getAlerts(
  token: string,
  params: AlertListParams = {}
): Promise<AlertListResponse> {
  const sp = new URLSearchParams();
  if (params.severity != null) sp.set("severity", params.severity);
  if (params.unacknowledged != null) sp.set("unacknowledged", String(params.unacknowledged));
  if (params.limit != null) sp.set("limit", String(params.limit));
  const qs = sp.toString();
  return http<AlertListResponse>(`/api/alerts${qs ? `?${qs}` : ""}`, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });
}

/** POST /api/alerts/ack — acknowledge alerts */
export async function acknowledgeAlerts(
  token: string,
  ids: number[]
): Promise<{ acknowledged: number }> {
  return http<{ acknowledged: number }>("/api/alerts/ack", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ ids }),
  });
}

/** GET /api/alerts/settings */
export async function getAlertSettings(token: string): Promise<AlertSettingsResponse> {
  return http<AlertSettingsResponse>("/api/alerts/settings", {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });
}

/** PUT /api/alerts/settings */
export async function updateAlertSettings(
  token: string,
  patch: AlertSettingsUpdateRequest
): Promise<AlertSettingsResponse> {
  return http<AlertSettingsResponse>("/api/alerts/settings", {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(patch),
  });
}

/** POST /api/alerts/run — trigger alert generation (manual) */
export async function runAlertsNow(token: string): Promise<{ created: number; emailed: number }> {
  return http<{ created: number; emailed: number }>("/api/alerts/run", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
}

/** GET /api/admin/audit-log — list audit log entries (owner only). */
export async function getAuditLog(
  token: string,
  params: { limit?: number; offset?: number }
): Promise<AuditLogListResponse> {
  const limit = params.limit ?? 50;
  const offset = params.offset ?? 0;
  const sp = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  return http<AuditLogListResponse>(`/api/admin/audit-log?${sp}`, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });
}

/** DELETE /api/inventory/:marketplace/:sku — returns 204 No Content */
export async function deleteInventory(
  token: string,
  marketplace: string,
  sku: string
): Promise<void> {
  const res = await fetch(
    `/api/inventory/${encodeURIComponent(marketplace)}/${encodeURIComponent(sku)}`,
    {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    }
  );
  if (!res.ok) {
    if (res.status === 401 && onUnauthorized) onUnauthorized();
    const text = await res.text();
    try {
      const j = JSON.parse(text) as { error?: { message?: string }; detail?: string };
      const msg = (j.error?.message ?? j.detail ?? text) || `Request failed: ${res.status}`;
      throw new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
    } catch (e) {
      if (e instanceof SyntaxError) throw new Error(text || `Request failed: ${res.status}`);
      throw e;
    }
  }
  if (res.status !== 204) await res.json();
}
