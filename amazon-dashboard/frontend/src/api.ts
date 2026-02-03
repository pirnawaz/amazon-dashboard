/**
 * API client for Amazon Dashboard.
 * Contains types and functions for all backend API endpoints.
 */

const API_BASE = "/api";

// ============= Types =============

export type UserRole = "owner" | "partner";

export type UserPublic = {
  id: number;
  email: string;
  role: UserRole;
  created_at: string;
};

export type ConnectionStatus = "pending" | "active" | "error" | "disconnected";

// Dashboard types
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

// Forecast types
export type ForecastPoint = {
  date: string;
  units: number;
};

export type BacktestPoint = {
  date: string;
  actual_units: number;
  predicted_units: number;
};

export type ForecastIntelligence = {
  trend: "stable" | "up" | "down";
  confidence: "high" | "medium" | "low";
  daily_demand_estimate: number;
  volatility_cv: number;
  forecast_range: {
    low: number;
    expected: number;
    high: number;
  };
};

export type DataQualityInfo = {
  total_rows: number;
  mapped_rows: number;
  unmapped_rows: number;
  mapping_status: string;
};

export type ForecastResponse = {
  kind: "total" | "sku";
  sku: string | null;
  marketplace: string;
  history_days: number;
  horizon_days: number;
  model_name: string;
  mae_30d: number;
  mape_30d: number;
  data_end_date: string;
  backtest_points: BacktestPoint[];
  actual_points: ForecastPoint[];
  forecast_points: ForecastPoint[];
  intelligence: ForecastIntelligence;
  recommendation: string;
  reasoning: string[];
  data_quality?: DataQualityInfo;
};

export type ForecastTopSkuRow = {
  sku: string;
  title: string;
  revenue: number;
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

// Restock types
export type RestockRow = {
  sku: string;
  title: string | null;
  asin: string | null;
  on_hand: number;
  avg_daily_units: number;
  days_of_cover: number;
  reorder_qty: number;
  risk_level: "OK" | "LOW" | "CRITICAL";
};

export type RestockResponse = {
  days: number;
  target_days: number;
  marketplace: string;
  limit: number;
  items: RestockRow[];
};

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
  days_of_cover: number | null;
  expected_stockout_date: string | null;
  stockout_before_lead_time: boolean | null;
};

export type RestockActionStatus = "healthy" | "watch" | "urgent" | "insufficient_data";

export type RestockActionItem = {
  sku: string | null;
  marketplace: string;
  horizon_days: number;
  lead_time_days: number;
  service_level: number;
  current_stock_units: number | null;
  daily_demand_estimate: number;
  demand_range_daily: { low: number; expected: number; high: number };
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

// Inventory types
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

export type InventoryUpsertRequest = {
  sku: string;
  marketplace: string;
  on_hand_units: number;
  reserved_units?: number;
  source?: string;
  note?: string | null;
};

// Alert types
export type AlertEventResponse = {
  id: number;
  alert_type: string;
  severity: "critical" | "warning" | "info";
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

// Amazon connection types
export type AmazonConnectionResponse = {
  id: number;
  status: ConnectionStatus;
  seller_id: string | null;
  marketplace_ids: string[] | null;
  last_success_at: string | null;
  last_error_at: string | null;
  last_error_message: string | null;
  last_orders_sync_at: string | null;
  last_orders_sync_orders_count: number | null;
  last_orders_sync_items_count: number | null;
  last_inventory_sync_at: string | null;
  last_inventory_sync_count: number | null;
  created_at: string;
  updated_at: string;
};

export type AmazonConnectionUpsertRequest = {
  status?: ConnectionStatus;
  seller_id?: string | null;
  marketplace_ids?: string[] | null;
};

export type AmazonCredentialSafeResponse = {
  id: number;
  refresh_token_set: boolean;
  lwa_client_id_set: boolean;
  lwa_client_secret_set: boolean;
  created_at: string;
  updated_at: string;
};

export type AmazonCredentialUpsertRequest = {
  refresh_token?: string | null;
  lwa_client_id?: string | null;
  lwa_client_secret?: string | null;
};

// Audit log types
export type AuditLogEntry = {
  id: number;
  user_id: number;
  user_email: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
};

export type AuditLogResponse = {
  items: AuditLogEntry[];
  total: number;
  offset: number;
  limit: number;
};

// Catalog mapping types
export type SkuMappingOut = {
  id: number;
  sku: string;
  marketplace_code: string;
  asin: string | null;
  fnsku: string | null;
  product_id: number | null;
  product_sku: string | null;
  product_title: string | null;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type SkuMappingListResponse = {
  total: number;
  items: SkuMappingOut[];
};

export type SkuMappingImportResponse = {
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
};

export type UnmappedSkuRow = {
  sku: string;
  marketplace_code: string;
  total_revenue: number;
  total_units: number;
  first_order_date: string | null;
  last_order_date: string | null;
};

export type UnmappedSkusListResponse = {
  total: number;
  items: UnmappedSkuRow[];
};

export type UnmappedSkuWithSuggestion = UnmappedSkuRow & {
  suggested_product_id: number | null;
  suggested_product_sku: string | null;
  suggested_product_title: string | null;
  suggestion_reason: string | null;
};

export type ProductSearchHit = {
  id: number;
  sku: string;
  title: string | null;
  asin: string | null;
};

export type ProductSearchResponse = {
  items: ProductSearchHit[];
};

// Data health types
export type DataHealthSummary = {
  total_order_rows: number;
  mapped_rows: number;
  unmapped_rows: number;
  mapping_percentage: number;
  total_revenue: number;
  mapped_revenue: number;
  unmapped_revenue: number;
  revenue_mapping_percentage: number;
  distinct_skus: number;
  mapped_skus: number;
  unmapped_skus: number;
};

export type UnmappedTrendPoint = {
  date: string;
  unmapped_count: number;
  unmapped_revenue: number;
};

export type UnmappedTrendResponse = {
  points: UnmappedTrendPoint[];
};

// Ads Attribution types (Sprint 14)
export type SkuProfitabilityRow = {
  sku: string;
  marketplace_code: string;
  revenue: number;
  ad_spend: number | null;
  attributed_sales: number | null;
  organic_sales: number | null;
  units_sold: number;
  unit_cogs: number | null;
  total_cogs: number | null;
  gross_profit: number | null;
  net_profit: number | null;
  acos: number | null;
  roas: number | null;
  warning_flags: string[];
};

export type SkuProfitabilityResponse = {
  days: number;
  marketplace: string;
  items: SkuProfitabilityRow[];
};

export type SkuTimeseriesPoint = {
  date: string;
  revenue: number;
  ad_spend: number | null;
  attributed_sales: number | null;
  net_profit: number | null;
  units: number;
};

export type SkuTimeseriesResponse = {
  sku: string;
  days: number;
  marketplace: string;
  points: SkuTimeseriesPoint[];
};

export type SkuCostResponse = {
  id: number;
  sku: string;
  marketplace_code: string | null;
  unit_cost: number;
  currency: string | null;
  updated_at: string | null;
};

export type SkuCostListResponse = {
  items: SkuCostResponse[];
};

export type SkuCostCreate = {
  sku: string;
  marketplace_code?: string | null;
  unit_cost: number;
  currency?: string | null;
};

// ============= Helper =============

let onUnauthorizedCallback: (() => void) | null = null;

export function setOnUnauthorized(cb: (() => void) | null): void {
  onUnauthorizedCallback = cb;
}

async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
  token?: string
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> | undefined),
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });
  if (res.status === 401) {
    onUnauthorizedCallback?.();
    throw new Error("Unauthorized");
  }
  if (!res.ok) {
    let errMsg = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      errMsg = body?.error?.message ?? body?.detail ?? errMsg;
    } catch {
      /* ignore */
    }
    throw new Error(errMsg);
  }
  if (res.status === 204) {
    return undefined as T;
  }
  return res.json();
}

// ============= Auth =============

export async function login(
  email: string,
  password: string
): Promise<{ access_token: string }> {
  return apiFetch("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export async function register(
  email: string,
  password: string
): Promise<{ access_token: string }> {
  return apiFetch("/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export async function fetchCurrentUser(token: string): Promise<UserPublic> {
  return apiFetch("/me", {}, token);
}

// ============= Dashboard =============

export async function dashboardSummary(
  token: string,
  params: { days: number; marketplace: string }
): Promise<DashboardSummary> {
  const qs = new URLSearchParams({
    days: String(params.days),
    marketplace: params.marketplace,
  });
  return apiFetch(`/dashboard/summary?${qs}`, {}, token);
}

export async function timeseries(
  token: string,
  params: { days: number; marketplace: string }
): Promise<DashboardTimeseriesResponse> {
  const qs = new URLSearchParams({
    days: String(params.days),
    marketplace: params.marketplace,
  });
  return apiFetch(`/dashboard/timeseries?${qs}`, {}, token);
}

export async function topProducts(
  token: string,
  params: { days: number; marketplace: string; limit: number }
): Promise<TopProductsResponse> {
  const qs = new URLSearchParams({
    days: String(params.days),
    marketplace: params.marketplace,
    limit: String(params.limit),
  });
  return apiFetch(`/dashboard/top-products?${qs}`, {}, token);
}

// ============= Forecast =============

export async function forecastTotal(
  token: string,
  params: {
    history_days: number;
    horizon_days: number;
    marketplace: string;
    include_unmapped?: boolean;
  }
): Promise<ForecastResponse> {
  const qs = new URLSearchParams({
    history_days: String(params.history_days),
    horizon_days: String(params.horizon_days),
    marketplace: params.marketplace,
  });
  if (params.include_unmapped != null) {
    qs.set("include_unmapped", String(params.include_unmapped));
  }
  return apiFetch(`/forecast/total?${qs}`, {}, token);
}

export async function forecastSku(
  token: string,
  params: {
    sku: string;
    history_days: number;
    horizon_days: number;
    marketplace: string;
  }
): Promise<ForecastResponse> {
  const qs = new URLSearchParams({
    history_days: String(params.history_days),
    horizon_days: String(params.horizon_days),
    marketplace: params.marketplace,
  });
  return apiFetch(`/forecast/sku/${encodeURIComponent(params.sku)}?${qs}`, {}, token);
}

export async function forecastTopSkus(
  token: string,
  params: { days: number; marketplace: string; limit: number }
): Promise<ForecastTopSkuRow[]> {
  const qs = new URLSearchParams({
    days: String(params.days),
    marketplace: params.marketplace,
    limit: String(params.limit),
  });
  return apiFetch(`/forecast/top-skus?${qs}`, {}, token);
}

export async function forecastRestockPlan(
  token: string,
  params: {
    sku: string;
    horizon_days: number;
    lead_time_days: number;
    service_level: number;
    marketplace: string;
  }
): Promise<ForecastRestockPlanResponse> {
  const qs = new URLSearchParams({
    horizon_days: String(params.horizon_days),
    lead_time_days: String(params.lead_time_days),
    service_level: String(params.service_level),
    marketplace: params.marketplace,
  });
  return apiFetch(`/forecast/restock-plan/${encodeURIComponent(params.sku)}?${qs}`, {}, token);
}

// ============= Restock =============

export async function restock(
  token: string,
  params: { days: number; target_days: number; marketplace: string; limit: number }
): Promise<RestockResponse> {
  const qs = new URLSearchParams({
    days: String(params.days),
    target_days: String(params.target_days),
    marketplace: params.marketplace,
    limit: String(params.limit),
  });
  return apiFetch(`/inventory/restock?${qs}`, {}, token);
}

export async function restockPlan(
  token: string,
  params: {
    sku: string;
    marketplace: string;
    lead_time_days: number;
    service_level: number;
    current_inventory?: number;
  }
): Promise<RestockPlanResponse> {
  return apiFetch("/restock/plan", {
    method: "POST",
    body: JSON.stringify(params),
  }, token);
}

export async function suggestedSkus(
  token: string,
  marketplace: string
): Promise<string[]> {
  const qs = new URLSearchParams({ marketplace });
  return apiFetch(`/forecast/suggested-skus?${qs}`, {}, token);
}

export async function getRestockActionsTotal(
  token: string,
  params: {
    marketplace?: string;
    horizon_days?: number;
    lead_time_days?: number;
    service_level?: number;
    current_stock_units?: number | null;
    include_unmapped?: boolean;
  }
): Promise<RestockActionsResponse> {
  const qs = new URLSearchParams();
  if (params.marketplace) qs.set("marketplace", params.marketplace);
  if (params.horizon_days != null) qs.set("horizon_days", String(params.horizon_days));
  if (params.lead_time_days != null) qs.set("lead_time_days", String(params.lead_time_days));
  if (params.service_level != null) qs.set("service_level", String(params.service_level));
  if (params.current_stock_units != null) qs.set("current_stock_units", String(params.current_stock_units));
  if (params.include_unmapped != null) qs.set("include_unmapped", String(params.include_unmapped));
  return apiFetch(`/restock/actions/total?${qs}`, {}, token);
}

export async function getRestockActionsSku(
  token: string,
  sku: string,
  params: {
    marketplace?: string;
    horizon_days?: number;
    lead_time_days?: number;
    service_level?: number;
    current_stock_units?: number | null;
  }
): Promise<RestockActionsResponse> {
  const qs = new URLSearchParams();
  if (params.marketplace) qs.set("marketplace", params.marketplace);
  if (params.horizon_days != null) qs.set("horizon_days", String(params.horizon_days));
  if (params.lead_time_days != null) qs.set("lead_time_days", String(params.lead_time_days));
  if (params.service_level != null) qs.set("service_level", String(params.service_level));
  if (params.current_stock_units != null) qs.set("current_stock_units", String(params.current_stock_units));
  return apiFetch(`/restock/actions/sku/${encodeURIComponent(sku)}?${qs}`, {}, token);
}

// ============= Inventory =============

export async function getInventoryList(
  token: string,
  params?: { marketplace?: string; q?: string; limit?: number }
): Promise<InventoryListResponse> {
  const qs = new URLSearchParams();
  if (params?.marketplace) qs.set("marketplace", params.marketplace);
  if (params?.q) qs.set("q", params.q);
  if (params?.limit != null) qs.set("limit", String(params.limit));
  const query = qs.toString() ? `?${qs}` : "";
  return apiFetch(`/inventory${query}`, {}, token);
}

export async function upsertInventory(
  token: string,
  payload: InventoryUpsertRequest
): Promise<InventoryItemResponse> {
  return apiFetch("/inventory", {
    method: "PUT",
    body: JSON.stringify(payload),
  }, token);
}

export async function deleteInventory(
  token: string,
  marketplace: string,
  sku: string
): Promise<void> {
  await apiFetch(`/inventory/${encodeURIComponent(marketplace)}/${encodeURIComponent(sku)}`, {
    method: "DELETE",
  }, token);
}

// ============= Alerts =============

export async function getAlerts(
  token: string,
  params?: { severity?: string; unacknowledged?: boolean; limit?: number }
): Promise<AlertListResponse> {
  const qs = new URLSearchParams();
  if (params?.severity) qs.set("severity", params.severity);
  if (params?.unacknowledged != null) qs.set("unacknowledged", String(params.unacknowledged));
  if (params?.limit != null) qs.set("limit", String(params.limit));
  const query = qs.toString() ? `?${qs}` : "";
  return apiFetch(`/alerts${query}`, {}, token);
}

export async function acknowledgeAlerts(
  token: string,
  ids: number[]
): Promise<{ acknowledged: number }> {
  return apiFetch("/alerts/ack", {
    method: "POST",
    body: JSON.stringify({ ids }),
  }, token);
}

export async function getAlertSettings(token: string): Promise<AlertSettingsResponse> {
  return apiFetch("/alerts/settings", {}, token);
}

export async function updateAlertSettings(
  token: string,
  patch: AlertSettingsUpdateRequest
): Promise<AlertSettingsResponse> {
  return apiFetch("/alerts/settings", {
    method: "PUT",
    body: JSON.stringify(patch),
  }, token);
}

export async function runAlertsNow(
  token: string
): Promise<{ created: number; emailed: number }> {
  return apiFetch("/alerts/run", { method: "POST" }, token);
}

// ============= Amazon Connection =============

export async function getAmazonConnection(
  token: string
): Promise<AmazonConnectionResponse | null> {
  try {
    return await apiFetch("/amazon/connection", {}, token);
  } catch (err) {
    if (err instanceof Error && err.message.includes("404")) {
      return null;
    }
    throw err;
  }
}

export async function upsertAmazonConnection(
  token: string,
  payload: AmazonConnectionUpsertRequest
): Promise<AmazonConnectionResponse> {
  return apiFetch("/amazon/connection", {
    method: "PUT",
    body: JSON.stringify(payload),
  }, token);
}

export async function getAmazonCredential(
  token: string
): Promise<AmazonCredentialSafeResponse | null> {
  try {
    return await apiFetch("/amazon/credential", {}, token);
  } catch (err) {
    if (err instanceof Error && err.message.includes("404")) {
      return null;
    }
    throw err;
  }
}

export async function upsertAmazonCredential(
  token: string,
  payload: AmazonCredentialUpsertRequest
): Promise<AmazonCredentialSafeResponse> {
  return apiFetch("/amazon/credential", {
    method: "PUT",
    body: JSON.stringify(payload),
  }, token);
}

export async function adminSpapiPing(
  token: string
): Promise<{ status: string; message: string }> {
  return apiFetch("/admin/amazon/spapi/ping", { method: "POST" }, token);
}

export async function adminOrdersSync(
  token: string,
  params?: { days?: number }
): Promise<{ status: string; orders_fetched: number; items_fetched: number }> {
  const qs = new URLSearchParams();
  if (params?.days != null) qs.set("days", String(params.days));
  const query = qs.toString() ? `?${qs}` : "";
  return apiFetch(`/admin/amazon/orders/sync${query}`, { method: "POST" }, token);
}

export async function adminInventorySync(
  token: string
): Promise<{ status: string; items_fetched: number }> {
  return apiFetch("/admin/amazon/inventory/sync", { method: "POST" }, token);
}

export async function adminInventoryBridge(
  token: string
): Promise<{ status: string; bridged: number }> {
  return apiFetch("/admin/amazon/inventory/bridge", { method: "POST" }, token);
}

// ============= Audit Log =============

export async function getAuditLog(
  token: string,
  params?: { limit?: number; offset?: number }
): Promise<AuditLogResponse> {
  const qs = new URLSearchParams();
  if (params?.limit != null) qs.set("limit", String(params.limit));
  if (params?.offset != null) qs.set("offset", String(params.offset));
  const query = qs.toString() ? `?${qs}` : "";
  return apiFetch(`/admin/audit-log${query}`, {}, token);
}

// ============= Catalog Mapping =============

export async function getSkuMappings(
  token: string,
  params?: { status?: string; marketplace?: string; q?: string; limit?: number; offset?: number }
): Promise<SkuMappingListResponse> {
  const qs = new URLSearchParams();
  if (params?.status) qs.set("status", params.status);
  if (params?.marketplace) qs.set("marketplace", params.marketplace);
  if (params?.q) qs.set("q", params.q);
  if (params?.limit != null) qs.set("limit", String(params.limit));
  if (params?.offset != null) qs.set("offset", String(params.offset));
  const query = qs.toString() ? `?${qs}` : "";
  return apiFetch(`/admin/catalog/sku-mappings${query}`, {}, token);
}

export async function createOrUpdateSkuMapping(
  token: string,
  payload: {
    sku: string;
    marketplace_code: string;
    asin?: string | null;
    fnsku?: string | null;
    product_id?: number | null;
    status?: string;
    notes?: string | null;
  }
): Promise<SkuMappingOut> {
  return apiFetch("/admin/catalog/sku-mappings", {
    method: "POST",
    body: JSON.stringify(payload),
  }, token);
}

export async function patchSkuMapping(
  token: string,
  id: number,
  patch: {
    asin?: string | null;
    fnsku?: string | null;
    product_id?: number | null;
    status?: string;
    notes?: string | null;
  }
): Promise<SkuMappingOut> {
  return apiFetch(`/admin/catalog/sku-mappings/${id}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  }, token);
}

export async function exportSkuMappingsCsv(
  token: string,
  params?: { status?: string; marketplace?: string }
): Promise<Blob> {
  const qs = new URLSearchParams();
  if (params?.status) qs.set("status", params.status);
  if (params?.marketplace) qs.set("marketplace", params.marketplace);
  const query = qs.toString() ? `?${qs}` : "";
  const res = await fetch(`${API_BASE}/admin/catalog/sku-mappings/export${query}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.blob();
}

export async function importSkuMappingsCsv(
  token: string,
  file: File
): Promise<SkuMappingImportResponse> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(`${API_BASE}/admin/catalog/sku-mappings/import`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  if (!res.ok) {
    let errMsg = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      errMsg = body?.error?.message ?? body?.detail ?? errMsg;
    } catch {
      /* ignore */
    }
    throw new Error(errMsg);
  }
  return res.json();
}

export async function getUnmappedSkus(
  token: string,
  params?: { marketplace?: string; limit?: number; offset?: number }
): Promise<UnmappedSkusListResponse> {
  const qs = new URLSearchParams();
  if (params?.marketplace) qs.set("marketplace", params.marketplace);
  if (params?.limit != null) qs.set("limit", String(params.limit));
  if (params?.offset != null) qs.set("offset", String(params.offset));
  const query = qs.toString() ? `?${qs}` : "";
  return apiFetch(`/admin/catalog/unmapped-skus${query}`, {}, token);
}

export async function getUnmappedSuggestions(
  token: string,
  params?: { marketplace?: string; limit?: number }
): Promise<UnmappedSkuWithSuggestion[]> {
  const qs = new URLSearchParams();
  if (params?.marketplace) qs.set("marketplace", params.marketplace);
  if (params?.limit != null) qs.set("limit", String(params.limit));
  const query = qs.toString() ? `?${qs}` : "";
  return apiFetch(`/admin/catalog/unmapped-suggestions${query}`, {}, token);
}

export async function searchProducts(
  token: string,
  params: { q: string; limit?: number }
): Promise<ProductSearchResponse> {
  const qs = new URLSearchParams({ q: params.q });
  if (params.limit != null) qs.set("limit", String(params.limit));
  return apiFetch(`/admin/catalog/products/search?${qs}`, {}, token);
}

// ============= Data Health =============

export async function getDataHealthSummary(
  token: string,
  params?: { days?: number; marketplace?: string }
): Promise<DataHealthSummary> {
  const qs = new URLSearchParams();
  if (params?.days != null) qs.set("days", String(params.days));
  if (params?.marketplace) qs.set("marketplace", params.marketplace);
  const query = qs.toString() ? `?${qs}` : "";
  return apiFetch(`/admin/data-health/summary${query}`, {}, token);
}

export async function getUnmappedTrend(
  token: string,
  params?: { days?: number; marketplace?: string }
): Promise<UnmappedTrendResponse> {
  const qs = new URLSearchParams();
  if (params?.days != null) qs.set("days", String(params.days));
  if (params?.marketplace) qs.set("marketplace", params.marketplace);
  const query = qs.toString() ? `?${qs}` : "";
  return apiFetch(`/admin/data-health/unmapped-trend${query}`, {}, token);
}

// ============= Ads Attribution (Sprint 14) =============

export async function getSkuProfitability(
  token: string,
  params?: { days?: number; marketplace?: string }
): Promise<SkuProfitabilityResponse> {
  const qs = new URLSearchParams();
  if (params?.days != null) qs.set("days", String(params.days));
  if (params?.marketplace) qs.set("marketplace", params.marketplace);
  const query = qs.toString() ? `?${qs}` : "";
  return apiFetch(`/ads/attribution/sku-profitability${query}`, {}, token);
}

export async function getSkuProfitabilityTimeseries(
  token: string,
  params: { sku: string; days?: number; marketplace?: string }
): Promise<SkuTimeseriesResponse> {
  const qs = new URLSearchParams({ sku: params.sku });
  if (params.days != null) qs.set("days", String(params.days));
  if (params.marketplace) qs.set("marketplace", params.marketplace);
  return apiFetch(`/ads/attribution/sku-timeseries?${qs}`, {}, token);
}

export async function getSkuCosts(
  token: string,
  params?: { sku?: string; marketplace?: string }
): Promise<SkuCostListResponse> {
  const qs = new URLSearchParams();
  if (params?.sku) qs.set("sku", params.sku);
  if (params?.marketplace) qs.set("marketplace", params.marketplace);
  const query = qs.toString() ? `?${qs}` : "";
  return apiFetch(`/ads/attribution/sku-costs${query}`, {}, token);
}

export async function upsertSkuCost(
  token: string,
  payload: SkuCostCreate
): Promise<SkuCostResponse> {
  return apiFetch("/ads/attribution/sku-costs", {
    method: "POST",
    body: JSON.stringify(payload),
  }, token);
}

export async function deleteSkuCost(
  token: string,
  sku: string,
  marketplace?: string | null
): Promise<void> {
  const qs = new URLSearchParams();
  if (marketplace) qs.set("marketplace", marketplace);
  const query = qs.toString() ? `?${qs}` : "";
  await apiFetch(`/ads/attribution/sku-costs/${encodeURIComponent(sku)}${query}`, {
    method: "DELETE",
  }, token);
}
