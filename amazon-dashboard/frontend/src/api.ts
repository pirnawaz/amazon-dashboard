/**
 * API client for Amazon Dashboard backend.
 * Uses relative /api base when running behind proxy.
 * Sprint 18: X-Amazon-Account-Id header from localStorage when not in demo mode.
 */

import { isDemoMode } from "./utils/preferences";

const API_BASE = "";

/** localStorage key for selected Amazon account id (Sprint 18). */
export const AMAZON_ACCOUNT_ID_KEY = "seller-hub-amazon-account-id";

type OnUnauthorized = (() => void) | null;
let onUnauthorized: OnUnauthorized = null;

export function setOnUnauthorized(fn: OnUnauthorized): void {
  onUnauthorized = fn;
}

export function getSelectedAmazonAccountId(): string | null {
  try {
    const v = localStorage.getItem(AMAZON_ACCOUNT_ID_KEY);
    return v && v.trim() ? v.trim() : null;
  } catch {
    return null;
  }
}

export function setSelectedAmazonAccountId(id: string | null): void {
  try {
    if (id == null || id === "") localStorage.removeItem(AMAZON_ACCOUNT_ID_KEY);
    else localStorage.setItem(AMAZON_ACCOUNT_ID_KEY, id);
  } catch {
    /* ignore */
  }
}

/** Call this when selected account changes so consumers can refetch. */
export const AMAZON_ACCOUNT_CHANGED = "seller-hub-amazon-account-changed";
export function notifyAmazonAccountChanged(): void {
  try {
    window.dispatchEvent(new Event(AMAZON_ACCOUNT_CHANGED));
  } catch {
    /* ignore */
  }
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
  if (!isDemoMode() && token) {
    const accountId = getSelectedAmazonAccountId();
    if (accountId) headers["X-Amazon-Account-Id"] = accountId;
  }
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
export type UserRole = "owner" | "partner" | "viewer";

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

// --- Amazon accounts (Sprint 18) ---
export interface AmazonAccountResponse {
  id: number;
  name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AmazonAccountCreate {
  name: string;
  is_active?: boolean;
}

export interface AmazonAccountUpdate {
  name?: string;
  is_active?: boolean;
}

export function listAmazonAccounts(
  token: string,
  params?: { include_inactive?: boolean }
): Promise<AmazonAccountResponse[]> {
  const q = params?.include_inactive ? "?include_inactive=true" : "";
  return request("GET", `/admin/amazon-accounts${q}`, token);
}

export function getAmazonAccount(token: string, accountId: number): Promise<AmazonAccountResponse> {
  return request("GET", `/admin/amazon-accounts/${accountId}`, token);
}

export function createAmazonAccount(
  token: string,
  body: AmazonAccountCreate
): Promise<AmazonAccountResponse> {
  return request("POST", "/admin/amazon-accounts", token, body);
}

export function updateAmazonAccount(
  token: string,
  accountId: number,
  body: AmazonAccountUpdate
): Promise<AmazonAccountResponse> {
  return request("PUT", `/admin/amazon-accounts/${accountId}`, token, body);
}

export function deleteAmazonAccount(token: string, accountId: number): Promise<void> {
  return request("DELETE", `/admin/amazon-accounts/${accountId}`, token);
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
  id: string;
  created_at: string;
  actor_user_id: number;
  actor_email: string | null;
  action: string;
  resource_type: string;
  resource_id: string | null;
  metadata: Record<string, unknown> | null;
}

export function getAuditLog(
  token: string,
  params: { limit: number; offset: number }
): Promise<{ items: AuditLogEntry[]; limit: number; offset: number; total: number }> {
  return request("GET", `/admin/audit-log?limit=${params.limit}&offset=${params.offset}`, token);
}

// --- Admin System Health (Sprint 17) ---
export interface LastJobRunSummary {
  job_name: string;
  last_started_at: string | null;
  last_status: string | null;
  last_finished_at: string | null;
  last_error: string | null;
}

export interface HealthSummaryResponse {
  status: "ok" | "warning" | "critical";
  last_orders_sync_at: string | null;
  last_ads_sync_at: string | null;
  last_job_runs: LastJobRunSummary[];
  failed_notifications_count: number;
}

export interface JobRunOut {
  id: number;
  job_name: string;
  status: string;
  started_at: string;
  finished_at: string | null;
  error: string | null;
  job_metadata: Record<string, unknown> | null;
}

export interface NotificationDeliveryOut {
  id: number;
  notification_type: string;
  severity: string;
  channel: string;
  recipient: string;
  subject: string | null;
  status: string;
  attempts: number;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

export function getHealthSummary(token: string): Promise<HealthSummaryResponse> {
  return request("GET", "/admin/health/summary", token);
}

export function getHealthJobs(
  token: string,
  params?: { limit?: number }
): Promise<JobRunOut[]> {
  const q = new URLSearchParams();
  if (params?.limit != null) q.set("limit", String(params.limit));
  const suffix = q.toString() ? `?${q}` : "";
  return request("GET", `/admin/health/jobs${suffix}`, token);
}

export function getHealthNotifications(
  token: string,
  params?: { status?: string; severity?: string; limit?: number }
): Promise<NotificationDeliveryOut[]> {
  const q = new URLSearchParams();
  if (params?.status) q.set("status", params.status);
  if (params?.severity) q.set("severity", params.severity);
  if (params?.limit != null) q.set("limit", String(params.limit));
  const suffix = q.toString() ? `?${q}` : "";
  return request("GET", `/admin/health/notifications${suffix}`, token);
}

// --- Alerts ---
export interface AlertEventResponse {
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
}

export interface AlertListResponse {
  items: AlertEventResponse[];
}

export interface AlertSettingsResponse {
  email_enabled: boolean;
  email_recipients: string | null;
  send_inventory_stale: boolean;
  send_urgent_restock: boolean;
  send_reorder_soon: boolean;
  send_order_by_passed: boolean;
  stale_days_threshold: number;
  updated_at: string;
}

export interface AlertSettingsUpdateRequest {
  email_enabled?: boolean;
  email_recipients?: string | null;
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

export type InventorySyncFreshness = "unknown" | "fresh" | "warning" | "critical";

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
  last_inventory_sync_freshness?: InventorySyncFreshness | null;
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

export function adminOrdersSync(
  token: string,
  body?: { dry_run?: boolean; include_items?: boolean }
): Promise<{ ok: boolean; error?: string }> {
  return request("POST", "/admin/amazon/orders/sync", token, body ?? {});
}

export interface InventorySyncResponse {
  status: string;
  items_upserted: number;
  last_inventory_sync_at: string | null;
  last_inventory_sync_error: string | null;
  error: string | null;
}

export function adminInventorySync(
  token: string,
  body?: { dry_run?: boolean }
): Promise<InventorySyncResponse> {
  return request("POST", "/admin/amazon/inventory/sync", token, body ?? {});
}

// --- Catalog mapping (Phase 12.1, 12.4) ---
export interface UnmappedSkuRow {
  sku: string;
  marketplace_code: string;
  seen_in_orders: boolean;
  seen_in_inventory: boolean;
  order_item_count: number;
  inventory_row_count: number;
  last_seen_date: string | null;
  suggested_asin?: string | null;
}

export interface SkuMappingOut {
  id: number;
  sku: string;
  marketplace_code: string;
  asin: string | null;
  fnsku: string | null;
  product_id: number | null;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProductSearchHit {
  id: number;
  title: string;
  sku: string | null;
}

export interface SkuMappingImportErrorRow {
  row_number: number;
  sku: string | null;
  marketplace_code: string | null;
  error: string;
}

export interface SkuMappingImportResponse {
  total_rows: number;
  created: number;
  updated: number;
  errors: SkuMappingImportErrorRow[];
  dry_run: boolean;
}

export interface UnmappedSkuWithSuggestion extends UnmappedSkuRow {
  suggested_product?: { id: number; sku: string | null; title: string } | null;
  suggestion_reason?: "sku_exact_match" | "asin_match" | null;
}

export function getUnmappedSkus(
  token: string,
  params: { marketplace_code?: string; limit: number; offset: number }
): Promise<{ items: UnmappedSkuRow[]; total: number }> {
  const q = new URLSearchParams();
  q.set("limit", String(params.limit));
  q.set("offset", String(params.offset));
  if (params.marketplace_code) q.set("marketplace_code", params.marketplace_code);
  return request("GET", `/admin/catalog/unmapped-skus?${q}`, token);
}

export function getSkuMappings(
  token: string,
  params: { marketplace_code?: string; status?: string; limit: number; offset: number }
): Promise<{ items: SkuMappingOut[]; total: number }> {
  const q = new URLSearchParams();
  q.set("limit", String(params.limit));
  q.set("offset", String(params.offset));
  if (params.marketplace_code) q.set("marketplace_code", params.marketplace_code);
  if (params.status) q.set("status", params.status);
  return request("GET", `/admin/catalog/sku-mappings?${q}`, token);
}

export function createOrUpdateSkuMapping(
  token: string,
  body: {
    sku: string;
    marketplace_code: string;
    asin?: string | null;
    fnsku?: string | null;
    product_id?: number | null;
    status?: string;
    notes?: string | null;
  }
): Promise<SkuMappingOut> {
  return request("POST", "/admin/catalog/sku-mappings", token, body);
}

export function patchSkuMapping(
  token: string,
  mappingId: number,
  body: Partial<Pick<SkuMappingOut, "asin" | "fnsku" | "product_id" | "status" | "notes">>
): Promise<SkuMappingOut> {
  return request("PATCH", `/admin/catalog/sku-mappings/${mappingId}`, token, body);
}

export function searchProducts(
  token: string,
  q: string,
  limit: number = 25
): Promise<{ items: ProductSearchHit[] }> {
  const params = new URLSearchParams({ q, limit: String(limit) });
  return request("GET", `/admin/catalog/products/search?${params}`, token);
}

export function getUnmappedSuggestions(
  token: string,
  params: { marketplace_code?: string; limit: number; offset: number }
): Promise<{ total: number; items: UnmappedSkuWithSuggestion[] }> {
  const q = new URLSearchParams();
  q.set("limit", String(params.limit));
  q.set("offset", String(params.offset));
  if (params.marketplace_code) q.set("marketplace_code", params.marketplace_code);
  return request("GET", `/admin/catalog/unmapped-skus/suggestions?${q}`, token);
}

export async function exportSkuMappingsCsv(
  token: string,
  params: { marketplace_code?: string; status?: string; include_headers?: boolean }
): Promise<Blob> {
  const q = new URLSearchParams();
  if (params.marketplace_code) q.set("marketplace_code", params.marketplace_code);
  if (params.status) q.set("status", params.status);
  if (params.include_headers !== undefined) q.set("include_headers", String(params.include_headers));
  const url = `${API_BASE}/api/admin/catalog/sku-mappings/export?${q}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    credentials: "include",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const msg = err?.detail || res.statusText || "Export failed";
    throw new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
  }
  return res.blob();
}

export async function importSkuMappingsCsv(
  token: string,
  file: File,
  dryRun: boolean
): Promise<SkuMappingImportResponse> {
  const form = new FormData();
  form.append("file", file);
  const url = `${API_BASE}/api/admin/catalog/sku-mappings/import?dry_run=${dryRun}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
    credentials: "include",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const msg = err?.detail || res.statusText || "Import failed";
    throw new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
  }
  return res.json() as Promise<SkuMappingImportResponse>;
}

// --- Data health (Phase 12.2, 12.4) ---
export interface DataHealthSummary {
  unmapped_skus_total: number;
  unmapped_units_30d: number;
  total_units_30d: number;
  unmapped_share_30d: number;
  ignored_units_30d: number;
  discontinued_units_30d: number;
  window_start: string;
  window_end: string;
}

export interface TopUnmappedSkuRow {
  marketplace_code: string;
  sku: string;
  units_30d: number;
  last_seen_date: string | null;
  seen_in_orders?: boolean;
  mapping_status: string | null;
}

export interface UnmappedTrendRow {
  week_start: string;
  total_units: number;
  unmapped_units: number;
  unmapped_share: number;
}

export function getDataHealthSummary(
  token: string,
  params?: { marketplace_code?: string }
): Promise<DataHealthSummary> {
  const q = params?.marketplace_code ? `?marketplace_code=${encodeURIComponent(params.marketplace_code)}` : "";
  return request("GET", `/admin/data-health/summary${q}`, token);
}

export function getTopUnmappedSkus(
  token: string,
  params?: { marketplace_code?: string; limit?: number }
): Promise<{ items: TopUnmappedSkuRow[] }> {
  const q = new URLSearchParams();
  if (params?.marketplace_code) q.set("marketplace_code", params.marketplace_code);
  if (params?.limit != null) q.set("limit", String(params.limit));
  const suffix = q.toString() ? `?${q}` : "";
  return request("GET", `/admin/data-health/top-unmapped${suffix}`, token);
}

export function getUnmappedTrend(
  token: string,
  params?: { marketplace_code?: string }
): Promise<{ items: UnmappedTrendRow[] }> {
  const q = params?.marketplace_code ? `?marketplace_code=${encodeURIComponent(params.marketplace_code)}` : "";
  return request("GET", `/admin/data-health/unmapped-trend${q}`, token);
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
  inventory_source: string | null;
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
  no_inventory_data: boolean;
  inventory_source: string | null;
  data_quality: DataQuality | null;
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
export type RestockActionStatus = "healthy" | "watch" | "urgent" | "insufficient_data";

export interface DemandRangeDaily {
  low: number;
  expected: number;
  high: number;
}

export interface RestockActionItem {
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
  inventory_freshness: "unknown" | "fresh" | "warning" | "critical" | null;
  inventory_age_hours: number | null;
  inventory_as_of_at: string | null;
  inventory_warning_message: string | null;
}

export interface DataQuality {
  mode: "mapped_confirmed" | "mapped_include_unmapped" | "legacy";
  excluded_units: number;
  excluded_skus: number;
  unmapped_units_30d: number;
  unmapped_share_30d: number;
  ignored_units_30d: number;
  discontinued_units_30d: number;
  warnings: string[];
  severity: "ok" | "warning" | "critical";
}

export interface RestockActionsResponse {
  generated_at: string;
  items: RestockActionItem[];
  data_quality: DataQuality | null;
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
): Promise<RestockActionsResponse> {
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

export interface ForecastBoundPoint {
  date: string;
  predicted_units: number;
  lower: number;
  upper: number;
}

export interface ForecastDrift {
  flag: boolean;
  window_days: number;
  mae: number;
  mape: number;
  threshold: number;
}

export interface AppliedOverrideOut {
  id: number;
  override_type: string;
  value: number;
  start_date: string;
  end_date: string;
}

export interface ForecastTopSkuRow {
  sku: string;
  title: string | null;
  asin: string | null;
  total_units: number;
  avg_daily: number;
}

export interface ForecastIntelligence {
  trend: "increasing" | "stable" | "decreasing" | "insufficient_data";
  confidence: "high" | "medium" | "low";
  daily_demand_estimate: number;
  volatility_cv: number;
  forecast_range: { low: number; expected: number; high: number };
}

export interface ForecastResponse {
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
  excluded_units?: number | null;
  excluded_skus?: number | null;
  unmapped_units_30d?: number | null;
  unmapped_share_30d?: number | null;
  warnings?: string[] | null;
  confidence_bounds?: ForecastBoundPoint[] | null;
  drift?: ForecastDrift | null;
  applied_overrides?: AppliedOverrideOut[] | null;
}

export interface ForecastRestockPlanResponse {
  sku: string;
  marketplace: string;
  horizon_days: number;
  lead_time_days: number;
  service_level: number;
  avg_daily_forecast_units: number;
  forecast_units_lead_time: number;
  safety_stock_units: number;
  recommended_reorder_qty: number;
  inventory_freshness: "unknown" | "fresh" | "warning" | "critical" | null;
  inventory_age_hours: number | null;
  inventory_as_of_at: string | null;
  inventory_warning_message: string | null;
  inventory_source: "spapi" | "manual" | "legacy" | null;
  no_inventory_data: boolean;
  data_quality: DataQuality | null;
}

export function getForecastTotal(
  token: string,
  params: {
    history_days: number;
    horizon_days: number;
    marketplace: string;
    include_unmapped?: boolean;
  }
): Promise<ForecastResponse> {
  const q = new URLSearchParams({
    history_days: String(params.history_days),
    horizon_days: String(params.horizon_days),
    marketplace: params.marketplace,
  });
  if (params.include_unmapped === true) q.set("include_unmapped", "true");
  return request("GET", `/forecast/total?${q}`, token);
}

export function getForecastSku(
  token: string,
  params: {
    sku: string;
    history_days: number;
    horizon_days: number;
    marketplace: string;
    include_unmapped?: boolean;
  }
): Promise<ForecastResponse> {
  const q = new URLSearchParams({
    history_days: String(params.history_days),
    horizon_days: String(params.horizon_days),
    marketplace: params.marketplace,
  });
  if (params.include_unmapped === true) q.set("include_unmapped", "true");
  return request("GET", `/forecast/sku?sku=${encodeURIComponent(params.sku)}&${q}`, token);
}

export function getForecastTopSkus(
  token: string,
  params: { days: number; marketplace: string; limit: number }
): Promise<ForecastTopSkuRow[]> {
  const q = new URLSearchParams({
    days: String(params.days),
    marketplace: params.marketplace,
    limit: String(params.limit),
  });
  return request("GET", `/forecast/top-skus?${q}`, token);
}

export function getForecastRestockPlan(
  token: string,
  params: { sku: string; marketplace: string }
): Promise<ForecastRestockPlanResponse> {
  const q = new URLSearchParams(params);
  return request("GET", `/forecast/restock-plan?${q}`, token);
}

// --- Forecast overrides (Sprint 15, owner only) ---
export interface ForecastOverrideResponse {
  id: number;
  sku: string | null;
  marketplace_code: string | null;
  start_date: string;
  end_date: string;
  override_type: string;
  value: number;
  reason: string | null;
  created_by_user_id: number | null;
  created_by_email: string | null;
  created_at: string;
  updated_at: string;
}

export interface ForecastOverrideCreate {
  sku?: string | null;
  marketplace_code?: string | null;
  start_date: string;
  end_date: string;
  override_type: "absolute" | "multiplier";
  value: number;
  reason?: string | null;
}

export interface ForecastOverrideUpdate {
  sku?: string | null;
  marketplace_code?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  override_type?: "absolute" | "multiplier" | null;
  value?: number | null;
  reason?: string | null;
}

export function getForecastOverrides(
  token: string,
  params: { sku?: string; marketplace?: string }
): Promise<ForecastOverrideResponse[]> {
  const q = new URLSearchParams();
  if (params.sku) q.set("sku", params.sku);
  if (params.marketplace) q.set("marketplace", params.marketplace);
  const suffix = q.toString() ? `?${q}` : "";
  return request("GET", `/forecast/overrides${suffix}`, token);
}

export function createForecastOverride(
  token: string,
  body: ForecastOverrideCreate
): Promise<ForecastOverrideResponse> {
  return request("POST", "/forecast/overrides", token, body);
}

export function updateForecastOverride(
  token: string,
  id: number,
  body: ForecastOverrideUpdate
): Promise<ForecastOverrideResponse> {
  return request("PUT", `/forecast/overrides/${id}`, token, body);
}

export function deleteForecastOverride(token: string, id: number): Promise<void> {
  return request("DELETE", `/forecast/overrides/${id}`, token);
}

// --- Inventory ---
export interface InventoryItemResponse {
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
  as_of_at: string | null;
  inventory_freshness: "unknown" | "fresh" | "warning" | "critical";
  inventory_age_hours: number | null;
}

export interface InventoryListResponse {
  items: InventoryItemResponse[];
}

export interface InventoryUpsertRequest {
  sku: string;
  marketplace: string;
  on_hand_units: number;
  reserved_units?: number;
  source?: string;
  note?: string | null;
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

// --- Restock Advanced (Sprint 16) ---
export interface RestockSupplierOut {
  id: number;
  name: string;
  contact_email: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface RestockSupplierCreate {
  name: string;
  contact_email?: string | null;
  notes?: string | null;
}

export interface RestockSupplierUpdate {
  name?: string;
  contact_email?: string | null;
  notes?: string | null;
}

export interface RestockSettingOut {
  id: number;
  sku: string;
  marketplace_code: string | null;
  supplier_id: number;
  lead_time_days_mean: number;
  lead_time_days_std: number;
  moq_units: number;
  pack_size_units: number;
  reorder_policy: string;
  min_days_of_cover: number;
  max_days_of_cover: number;
  service_level: number;
  holding_cost_rate: number | null;
  stockout_cost_per_unit: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface RestockSettingCreate {
  sku: string;
  marketplace_code?: string | null;
  supplier_id: number;
  lead_time_days_mean: number;
  lead_time_days_std?: number;
  moq_units?: number;
  pack_size_units?: number;
  reorder_policy?: string;
  min_days_of_cover?: number;
  max_days_of_cover?: number;
  service_level?: number;
  holding_cost_rate?: number | null;
  stockout_cost_per_unit?: number | null;
}

export interface RestockSettingUpdate {
  supplier_id?: number;
  lead_time_days_mean?: number;
  lead_time_days_std?: number;
  moq_units?: number;
  pack_size_units?: number;
  reorder_policy?: string;
  min_days_of_cover?: number;
  max_days_of_cover?: number;
  service_level?: number;
  holding_cost_rate?: number | null;
  stockout_cost_per_unit?: number | null;
  is_active?: boolean;
}

export interface RestockRecommendationRowOut {
  sku: string;
  marketplace_code: string;
  supplier_id: number | null;
  supplier_name: string | null;
  on_hand_units: number;
  inbound_units: number;
  reserved_units: number;
  available_units: number;
  daily_demand_forecast: number;
  days_of_cover: number | null;
  lead_time_days_mean: number;
  lead_time_days_std: number;
  safety_stock_units: number;
  reorder_point_units: number;
  target_stock_units: number;
  recommended_order_units: number;
  recommended_order_units_rounded: number;
  priority_score: number;
  reason_flags: string[];
}

export interface RestockWhatIfRequest {
  sku: string;
  marketplace_code: string;
  lead_time_mean?: number;
  lead_time_std?: number;
  service_level?: number;
  daily_demand_override?: number;
  on_hand_override?: number;
  inbound_override?: number;
  reserved_override?: number;
}

export interface RestockWhatIfResponse {
  result: RestockRecommendationRowOut;
}

export function getRestockSuppliers(token: string): Promise<RestockSupplierOut[]> {
  return request("GET", "/restock/suppliers", token);
}

export function createRestockSupplier(
  token: string,
  body: RestockSupplierCreate
): Promise<RestockSupplierOut> {
  return request("POST", "/restock/suppliers", token, body);
}

export function updateRestockSupplier(
  token: string,
  id: number,
  body: RestockSupplierUpdate
): Promise<RestockSupplierOut> {
  return request("PUT", `/restock/suppliers/${id}`, token, body);
}

export function deleteRestockSupplier(token: string, id: number): Promise<void> {
  return request("DELETE", `/restock/suppliers/${id}`, token);
}

export function getRestockSettings(
  token: string,
  params?: { sku?: string; marketplace_code?: string }
): Promise<RestockSettingOut[]> {
  const q = new URLSearchParams();
  if (params?.sku) q.set("sku", params.sku);
  if (params?.marketplace_code) q.set("marketplace_code", params.marketplace_code);
  const suffix = q.toString() ? `?${q}` : "";
  return request("GET", `/restock/settings${suffix}`, token);
}

export function createRestockSetting(
  token: string,
  body: RestockSettingCreate
): Promise<RestockSettingOut> {
  return request("POST", "/restock/settings", token, body);
}

export function updateRestockSetting(
  token: string,
  id: number,
  body: RestockSettingUpdate
): Promise<RestockSettingOut> {
  return request("PUT", `/restock/settings/${id}`, token, body);
}

export function deleteRestockSetting(token: string, id: number): Promise<void> {
  return request("DELETE", `/restock/settings/${id}`, token);
}

export function getRestockRecommendations(
  token: string,
  params: {
    days?: number;
    marketplace?: string;
    supplier_id?: number;
    urgent_only?: boolean;
    missing_settings_only?: boolean;
  }
): Promise<RestockRecommendationRowOut[]> {
  const q = new URLSearchParams();
  if (params.days != null) q.set("days", String(params.days));
  if (params.marketplace) q.set("marketplace", params.marketplace);
  if (params.supplier_id != null) q.set("supplier_id", String(params.supplier_id));
  if (params.urgent_only === true) q.set("urgent_only", "true");
  if (params.missing_settings_only === true) q.set("missing_settings_only", "true");
  return request("GET", `/restock/recommendations?${q}`, token);
}

export function getRestockRecommendationDetail(
  token: string,
  sku: string,
  params: { days?: number; marketplace?: string }
): Promise<RestockRecommendationRowOut> {
  const q = new URLSearchParams();
  if (params.days != null) q.set("days", String(params.days));
  if (params.marketplace) q.set("marketplace", params.marketplace);
  return request("GET", `/restock/recommendations/${encodeURIComponent(sku)}?${q}`, token);
}

export function postRestockWhatIf(
  token: string,
  body: RestockWhatIfRequest
): Promise<RestockWhatIfResponse> {
  return request("POST", "/restock/what-if", token, body);
}

export async function getRestockExportCsv(
  token: string,
  params: { days?: number; marketplace?: string; supplier_id?: number }
): Promise<Blob> {
  const q = new URLSearchParams();
  if (params.days != null) q.set("days", String(params.days));
  if (params.marketplace) q.set("marketplace", params.marketplace);
  if (params.supplier_id != null) q.set("supplier_id", String(params.supplier_id));
  const url = `${API_BASE || ""}/api/restock/export/csv?${q}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    credentials: "include",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const msg = err?.error?.message || err?.detail || res.statusText || "Export failed";
    throw new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
  }
  return res.blob();
}
