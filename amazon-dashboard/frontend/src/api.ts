/**
 * API client for Amazon Dashboard backend.
 * Uses relative /api base when running behind proxy.
 */

const API_BASE = "";

type OnUnauthorized = (() => void) | null;
let onUnauthorized: OnUnauthorized = null;

export function setOnUnauthorized(fn: OnUnauthorized): void {
  onUnauthorized = fn;
}

async function request<T>(
  method: string,
  path: string,
  token: string | null,
  body?: unknown
): Promise<T> {
  const url = `${API_BASE}/api${path}`;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    credentials: "include",
  });
  if (res.status === 401 && onUnauthorized) onUnauthorized();
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const msg = err?.error?.message || err?.detail || res.statusText || "Request failed";
    throw new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
  }
  return res.json() as Promise<T>;
}

// --- Auth & User ---
export type UserRole = "owner" | "partner";

export interface UserPublic {
  id: number;
  email: string;
  role: UserRole;
  created_at: string;
}

export interface TokenResponse {
  access_token: string;
}

export async function login(email: string, password: string): Promise<TokenResponse> {
  return request("POST", "/auth/login", null, { email, password });
}

export async function register(email: string, password: string): Promise<TokenResponse> {
  return request("POST", "/auth/register", null, { email, password });
}

export async function fetchCurrentUser(token: string): Promise<UserPublic> {
  return request("GET", "/auth/me", token);
}

// --- Dashboard ---
export interface DashboardSummary {
  revenue: number;
  units: number;
  orders: number;
  ad_spend: number;
  net_profit_placeholder: number;
}

export interface DashboardTimeseriesPoint {
  date: string;
  revenue: number;
  units: number;
  orders: number;
  ad_spend: number;
  net_profit_placeholder: number;
}

export interface DashboardTimeseriesResponse {
  days: number;
  marketplace: string;
  points: DashboardTimeseriesPoint[];
}

export interface TopProductRow {
  sku: string;
  title: string | null;
  asin: string | null;
  revenue: number;
  units: number;
  orders: number;
}

export interface TopProductsResponse {
  days: number;
  marketplace: string;
  limit: number;
  products: TopProductRow[];
}

export function dashboardSummary(
  token: string,
  params: { days: number; marketplace: string }
): Promise<DashboardSummary> {
  return request("GET", `/dashboard/summary?days=${params.days}&marketplace=${params.marketplace}`, token);
}

export function timeseries(
  token: string,
  params: { days: number; marketplace: string }
): Promise<DashboardTimeseriesResponse> {
  return request("GET", `/dashboard/timeseries?days=${params.days}&marketplace=${params.marketplace}`, token);
}

export function topProducts(
  token: string,
  params: { days: number; marketplace: string; limit: number }
): Promise<TopProductsResponse> {
  return request(
    "GET",
    `/dashboard/top-products?days=${params.days}&marketplace=${params.marketplace}&limit=${params.limit}`,
    token
  );
}

// --- Ads (Sprint 13) ---
export interface AdsAccountResponse {
  id: number;
  created_at: string;
  updated_at: string;
  status: string;
  has_refresh_token: boolean;
  last_sync_at: string | null;
  last_sync_status: string | null;
  last_sync_error: string | null;
}

export interface AdsProfileResponse {
  id: number;
  ads_account_id: number;
  profile_id: string;
  marketplace_id: number | null;
  marketplace_code: string | null;
  name: string | null;
  profile_type: string | null;
  created_at: string;
  updated_at: string;
}

export interface AdsDashboardSummary {
  spend: string | number;
  sales: string | number;
  acos: string | number | null;
  roas: string | number | null;
  marketplace: string;
  days: number;
}

export interface AdsTimeseriesPoint {
  date: string;
  spend: number;
  sales: number;
  acos: number | null;
  roas: number | null;
}

export interface AdsTimeseriesResponse {
  days: number;
  marketplace: string;
  points: AdsTimeseriesPoint[];
}

export interface AdsSyncTriggerResponse {
  ok: boolean;
  message: string;
  profiles_upserted: number;
  campaigns_upserted: number;
  ad_groups_upserted: number;
  targets_keywords_upserted: number;
  metrics_upserted: number;
  error: string | null;
}

export function getAdsAccount(token: string): Promise<AdsAccountResponse | null> {
  return request("GET", "/ads/account", token);
}

export function connectAdsAccount(
  token: string,
  body: { refresh_token: string }
): Promise<AdsAccountResponse> {
  return request("PUT", "/ads/account/connect", token, body);
}

export function listAdsProfiles(token: string): Promise<AdsProfileResponse[]> {
  return request("GET", "/ads/profiles", token);
}

export function triggerAdsSync(token: string): Promise<AdsSyncTriggerResponse> {
  return request("POST", "/ads/sync", token);
}

export function adsDashboardSummary(
  token: string,
  params: { days: number; marketplace: string }
): Promise<AdsDashboardSummary> {
  return request(
    "GET",
    `/ads/dashboard/summary?days=${params.days}&marketplace=${params.marketplace}`,
    token
  );
}

export function adsTimeseries(
  token: string,
  params: { days: number; marketplace: string }
): Promise<AdsTimeseriesResponse> {
  return request(
    "GET",
    `/ads/dashboard/timeseries?days=${params.days}&marketplace=${params.marketplace}`,
    token
  );
}

// --- Ads Attribution (Sprint 14) ---
export interface SkuProfitabilityRow {
  sku: string;
  marketplace_code: string;
  revenue: number | string;
  ad_spend: number | string | null;
  attributed_sales: number | string | null;
  organic_sales: number | string | null;
  units_sold: number;
  unit_cogs: number | string | null;
  total_cogs: number | string | null;
  gross_profit: number | string | null;
  net_profit: number | string | null;
  acos: number | string | null;
  roas: number | string | null;
  warning_flags: string[];
}

export interface SkuProfitabilityResponse {
  days: number;
  marketplace: string;
  rows: SkuProfitabilityRow[];
}

export interface SkuTimeseriesPoint {
  date: string;
  revenue: number | string;
  ad_spend: number | string;
  attributed_sales: number | string | null;
  net_profit: number | string | null;
  units: number;
}

export interface SkuTimeseriesResponse {
  sku: string;
  days: number;
  marketplace: string;
  points: SkuTimeseriesPoint[];
}

export function getSkuProfitability(
  token: string,
  params: { days: number; marketplace: string }
): Promise<SkuProfitabilityResponse> {
  return request(
    "GET",
    `/ads/attribution/sku-profitability?days=${params.days}&marketplace=${params.marketplace}`,
    token
  );
}

export function getSkuProfitabilityTimeseries(
  token: string,
  params: { sku: string; days: number; marketplace: string }
): Promise<SkuTimeseriesResponse> {
  const q = new URLSearchParams({
    sku: params.sku,
    days: String(params.days),
    marketplace: params.marketplace,
  });
  return request("GET", `/ads/attribution/sku-timeseries?${q}`, token);
}

// --- Audit log ---
export interface AuditLogEntry {
  id: number;
  created_at: string;
  actor_user_id: number;
  action: string;
  resource_type: string;
  resource_id: string;
  metadata: Record<string, unknown> | null;
}

export function getAuditLog(
  token: string,
  params: { limit: number; offset: number }
): Promise<{ items: AuditLogEntry[]; limit: number; offset: number; total: number }> {
  return request("GET", `/admin/audit-log?limit=${params.limit}&offset=${params.offset}`, token);
}

// --- Alerts ---
export interface AlertEventResponse {
  id: number;
  created_at: string;
  alert_type: string;
  severity: string;
  title: string;
  message: string;
  acknowledged_at: string | null;
  metadata: Record<string, unknown> | null;
}

export interface AlertListResponse {
  items: AlertEventResponse[];
  total: number;
}

export interface AlertSettingsResponse {
  send_inventory_stale: boolean;
  send_urgent_restock: boolean;
  send_reorder_soon: boolean;
  send_order_by_passed: boolean;
  stale_days_threshold: number;
  updated_at: string;
}

export interface AlertSettingsUpdateRequest {
  send_inventory_stale?: boolean;
  send_urgent_restock?: boolean;
  send_reorder_soon?: boolean;
  send_order_by_passed?: boolean;
  stale_days_threshold?: number;
}

export function getAlerts(
  token: string,
  params: { limit?: number; offset?: number; acknowledged?: boolean }
): Promise<AlertListResponse> {
  const q = new URLSearchParams();
  if (params.limit != null) q.set("limit", String(params.limit));
  if (params.offset != null) q.set("offset", String(params.offset));
  if (params.acknowledged != null) q.set("acknowledged", String(params.acknowledged));
  return request("GET", `/alerts?${q}`, token);
}

export function acknowledgeAlerts(token: string, ids: number[]): Promise<{ acknowledged: number }> {
  return request("POST", "/alerts/ack", token, { ids });
}

export function runAlertsNow(token: string): Promise<{ created: number; emailed: number }> {
  return request("POST", "/alerts/run", token);
}

export function getAlertSettings(token: string): Promise<AlertSettingsResponse> {
  return request("GET", "/alerts/settings", token);
}

export function updateAlertSettings(
  token: string,
  patch: AlertSettingsUpdateRequest
): Promise<AlertSettingsResponse> {
  return request("PUT", "/alerts/settings", token, patch);
}

// --- Amazon connection (SP-API) ---
export type ConnectionStatus = "pending" | "active" | "error" | "disconnected";

export interface AmazonConnectionResponse {
  id: number;
  created_at: string;
  updated_at: string;
  status: ConnectionStatus;
  last_success_at: string | null;
  last_error_at: string | null;
  last_error_message: string | null;
  marketplaces_json: Record<string, unknown> | null;
  seller_identifier: string | null;
  last_check_at: string | null;
  last_check_ok: boolean | null;
  last_check_error: string | null;
  last_orders_sync_at: string | null;
  last_orders_sync_status: string | null;
  last_orders_sync_error: string | null;
  last_orders_sync_orders_count: number | null;
  last_orders_sync_items_count: number | null;
  last_inventory_sync_at: string | null;
  last_inventory_sync_status: string | null;
  last_inventory_sync_error: string | null;
  last_inventory_sync_items_count: number | null;
  last_inventory_sync_age_hours?: number | null;
  last_inventory_sync_freshness?: string | null;
}

export interface AmazonConnectionUpsertRequest {
  status?: ConnectionStatus;
  seller_identifier?: string | null;
  marketplaces_json?: Record<string, unknown> | null;
}

export interface AmazonCredentialSafeResponse {
  id: number;
  created_at: string;
  updated_at: string;
  connection_id: number;
  note: string | null;
  has_refresh_token: boolean;
}

export interface AmazonCredentialUpsertRequest {
  lwa_refresh_token_encrypted?: string | null;
  note?: string | null;
}

export function getAmazonConnection(token: string): Promise<AmazonConnectionResponse | null> {
  return request("GET", "/amazon/connection", token);
}

export function getAmazonCredential(token: string): Promise<AmazonCredentialSafeResponse | null> {
  return request("GET", "/amazon/credential", token);
}

export function upsertAmazonConnection(
  token: string,
  body: AmazonConnectionUpsertRequest
): Promise<AmazonConnectionResponse> {
  return request("PUT", "/amazon/connection", token, body);
}

export function upsertAmazonCredential(
  token: string,
  body: AmazonCredentialUpsertRequest
): Promise<AmazonCredentialSafeResponse> {
  return request("PUT", "/amazon/credential", token, body);
}

export function adminSpapiPing(token: string): Promise<{ status: ConnectionStatus }> {
  return request("POST", "/amazon/connection/check", token);
}

export function adminOrdersSync(token: string): Promise<{ ok: boolean; message: string }> {
  return request("POST", "/admin/amazon/orders/sync", token);
}

export function adminInventorySync(token: string): Promise<{ ok: boolean; message: string }> {
  return request("POST", "/admin/amazon/inventory/sync", token);
}

// --- Catalog / Data health ---
export function getUnmappedSkus(
  token: string,
  params: { limit: number; offset: number }
): Promise<{ items: unknown[]; total: number }> {
  return request("GET", `/admin/catalog/unmapped?limit=${params.limit}&offset=${params.offset}`, token);
}

// --- Restock ---
export interface RestockResponse {
  days: number;
  target_days: number;
  marketplace: string;
  limit: number;
  items: RestockRow[];
}

export interface RestockRow {
  sku: string;
  title: string | null;
  asin: string | null;
  on_hand: number;
  avg_daily_units: number;
  days_of_cover: number;
  reorder_qty: number;
  risk_level: string;
}

export function restock(
  token: string,
  params: { days: number; target_days: number; marketplace: string; limit?: number }
): Promise<RestockResponse> {
  const q = new URLSearchParams({
    days: String(params.days),
    target_days: String(params.target_days),
    marketplace: params.marketplace,
  });
  if (params.limit != null) q.set("limit", String(params.limit));
  return request("GET", `/inventory/restock?${q}`, token);
}

// --- Restock plan ---
export interface RestockPlanResponse {
  sku: string;
  marketplace: string;
  plan: unknown;
  suggested_order_qty: number;
}

export function restockPlan(
  token: string,
  params: { sku: string; marketplace: string }
): Promise<RestockPlanResponse> {
  return request("GET", `/forecast/restock-plan?sku=${encodeURIComponent(params.sku)}&marketplace=${params.marketplace}`, token);
}

export function suggestedSkus(token: string, marketplace: string): Promise<string[]> {
  return request("GET", `/forecast/suggested-skus?marketplace=${marketplace}`, token);
}

// --- Restock actions ---
export type RestockActionStatus = string;

export interface RestockActionItem {
  sku: string;
  title: string | null;
  asin: string | null;
  marketplace: string;
  order_by_date: string | null;
  reorder_qty: number;
  status: RestockActionStatus;
  notes: string | null;
}

export interface RestockActionsResponse {
  items: RestockActionItem[];
  total: number;
}

export function getRestockActionsTotal(
  token: string,
  params: { marketplace?: string; limit?: number; offset?: number }
): Promise<RestockActionsResponse> {
  const q = new URLSearchParams();
  if (params.marketplace) q.set("marketplace", params.marketplace);
  if (params.limit != null) q.set("limit", String(params.limit));
  if (params.offset != null) q.set("offset", String(params.offset));
  return request("GET", `/restock/actions/total?${q}`, token);
}

export function getRestockActionsSku(
  token: string,
  sku: string,
  params?: { marketplace?: string }
): Promise<{ items: RestockActionItem[] }> {
  const q = params?.marketplace ? `?marketplace=${params.marketplace}` : "";
  return request("GET", `/restock/actions/sku/${encodeURIComponent(sku)}${q}`, token);
}

// --- Forecast ---
export interface ForecastPoint {
  date: string;
  units: number;
}

export interface BacktestPoint {
  date: string;
  actual_units: number;
  predicted_units: number;
}

export interface ForecastTopSkuRow {
  sku: string;
  title: string | null;
  asin: string | null;
  total_units: number;
  avg_daily: number;
}

export interface ForecastIntelligence {
  trend: string;
  confidence: string;
  daily_demand_estimate: number;
  volatility_cv: number;
  forecast_range: { low: number; expected: number; high: number };
}

export interface ForecastResponse {
  kind: string;
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
}

export interface ForecastRestockPlanResponse {
  sku: string;
  marketplace: string;
  forecast: ForecastResponse;
  reorder_qty: number;
  order_by_date: string | null;
}

export function getForecastTotal(
  token: string,
  params: { history_days: number; horizon_days: number; marketplace: string }
): Promise<ForecastResponse> {
  const q = new URLSearchParams(params as Record<string, string>);
  return request("GET", `/forecast/total?${q}`, token);
}

export function getForecastSku(
  token: string,
  params: { sku: string; history_days: number; horizon_days: number; marketplace: string }
): Promise<ForecastResponse> {
  const q = new URLSearchParams(params as Record<string, string>);
  return request("GET", `/forecast/sku/${encodeURIComponent(params.sku)}?${q}`, token);
}

export function getForecastTopSkus(
  token: string,
  params: { days: number; marketplace: string; limit: number }
): Promise<ForecastTopSkuRow[]> {
  const q = new URLSearchParams(params as Record<string, string>);
  return request("GET", `/forecast/top-skus?${q}`, token);
}

export function getForecastRestockPlan(
  token: string,
  params: { sku: string; marketplace: string }
): Promise<ForecastRestockPlanResponse> {
  const q = new URLSearchParams(params);
  return request("GET", `/forecast/restock-plan?${q}`, token);
}

// --- Inventory ---
export interface InventoryItemResponse {
  marketplace: string;
  sku: string;
  quantity: number;
  as_of_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface InventoryListResponse {
  marketplace: string;
  items: InventoryItemResponse[];
}

export interface InventoryUpsertRequest {
  marketplace: string;
  sku: string;
  quantity: number;
}

export function getInventoryList(
  token: string,
  params: { marketplace: string; q?: string }
): Promise<InventoryListResponse> {
  const q = new URLSearchParams({ marketplace: params.marketplace });
  if (params.q) q.set("q", params.q);
  return request("GET", `/inventory?${q}`, token);
}

export function getInventoryItem(
  token: string,
  marketplace: string,
  sku: string
): Promise<InventoryItemResponse | null> {
  return request("GET", `/inventory/${encodeURIComponent(marketplace)}/${encodeURIComponent(sku)}`, token);
}

export function upsertInventory(
  token: string,
  body: InventoryUpsertRequest
): Promise<InventoryItemResponse> {
  return request("PUT", "/inventory", token, body);
}

export function deleteInventory(
  token: string,
  marketplace: string,
  sku: string
): Promise<void> {
  return request("DELETE", `/inventory/${encodeURIComponent(marketplace)}/${encodeURIComponent(sku)}`, token);
}
