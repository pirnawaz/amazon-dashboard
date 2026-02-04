/**
 * Frontend-only demo/sample data for Seller Hub.
 * Used when seller-hub-demo=true so the app isn’t empty for new users.
 * Data is clearly labeled as demo in the UI.
 */

import type {
  DashboardSummary,
  DashboardTimeseriesResponse,
  DashboardTimeseriesPoint,
  TopProductsResponse,
  TopProductRow,
  RestockResponse,
  RestockRow,
  ForecastResponse,
  ForecastPoint,
  ForecastBoundPoint,
  ForecastDrift,
  BacktestPoint,
  ForecastTopSkuRow,
  ForecastRestockPlanResponse,
  RestockPlanResponse,
  RestockActionsResponse,
  RestockActionItem,
  InventoryItemResponse,
  InventoryListResponse,
  InventoryUpsertRequest,
  AlertEventResponse,
  AlertListResponse,
  AlertSettingsResponse,
  AlertSettingsUpdateRequest,
  AdsDashboardSummary,
  AdsTimeseriesResponse,
  AdsTimeseriesPoint,
  SkuProfitabilityResponse,
  SkuProfitabilityRow,
  SkuTimeseriesResponse,
  SkuTimeseriesPoint,
  ForecastOverrideResponse,
  RestockRecommendationRowOut,
  HealthSummaryResponse,
  JobRunOut,
  NotificationDeliveryOut,
  AmazonAccountResponse,
} from "../api";

const DEMO_DAYS = 45;

function demoDates(count: number): string[] {
  const out: string[] = [];
  const d = new Date();
  for (let i = count - 1; i >= 0; i--) {
    const x = new Date(d);
    x.setDate(x.getDate() - i);
    out.push(x.toISOString().slice(0, 10));
  }
  return out;
}

const DEMO_DATES = demoDates(DEMO_DAYS);

export function getDemoDashboardSummary(): DashboardSummary {
  return {
    revenue: 28450,
    units: 892,
    orders: 412,
    ad_spend: 3200,
    net_profit_placeholder: 18200,
  };
}

export function getDemoTimeseries(params: { days: number; marketplace: string }): DashboardTimeseriesResponse {
  const days = Math.min(Math.max(1, params.days), DEMO_DAYS);
  const start = DEMO_DAYS - days;
  const slice = DEMO_DATES.slice(start, DEMO_DAYS);
  const points: DashboardTimeseriesPoint[] = slice.map((date, i) => {
    const baseRev = 400 + (i % 7) * 80;
    const baseUnits = 15 + (i % 5) * 4;
    return {
      date,
      revenue: Math.round(baseRev * (0.9 + Math.random() * 0.2)),
      units: Math.round(baseUnits * (0.85 + Math.random() * 0.3)),
      orders: Math.round(baseUnits * 0.4),
      ad_spend: Math.round(baseRev * 0.12),
      net_profit_placeholder: Math.round(baseRev * 0.55),
    };
  });
  return {
    days: params.days,
    marketplace: params.marketplace,
    points,
  };
}

const DEMO_SKUS: TopProductRow[] = [
  { sku: "DEMO-SKU-001", title: "Demo Product A — Sample item", asin: "B0DEMO01", revenue: 8200, units: 240, orders: 98 },
  { sku: "DEMO-SKU-002", title: "Demo Product B — Sample item", asin: "B0DEMO02", revenue: 6500, units: 180, orders: 72 },
  { sku: "DEMO-SKU-003", title: "Demo Product C — Sample item", asin: "B0DEMO03", revenue: 4200, units: 120, orders: 55 },
  { sku: "DEMO-SKU-004", title: "Demo Product D — Sample item", asin: "B0DEMO04", revenue: 3800, units: 95, orders: 48 },
  { sku: "DEMO-SKU-005", title: "Demo Product E — Sample item", asin: "B0DEMO05", revenue: 2750, units: 78, orders: 42 },
];

export function getDemoTopProducts(params: { days: number; marketplace: string; limit: number }): TopProductsResponse {
  return {
    days: params.days,
    marketplace: params.marketplace,
    limit: params.limit,
    products: DEMO_SKUS.slice(0, Math.min(params.limit, DEMO_SKUS.length)),
  };
}

const DEMO_RESTOCK_ITEMS: RestockRow[] = [
  { sku: "DEMO-SKU-001", title: "Demo Product A", asin: "B0DEMO01", on_hand: 12, avg_daily_units: 5.2, days_of_cover: 2.3, reorder_qty: 180, risk_level: "CRITICAL", inventory_source: null },
  { sku: "DEMO-SKU-002", title: "Demo Product B", asin: "B0DEMO02", on_hand: 28, avg_daily_units: 4.0, days_of_cover: 7.0, reorder_qty: 140, risk_level: "OK", inventory_source: null },
  { sku: "DEMO-SKU-003", title: "Demo Product C", asin: "B0DEMO03", on_hand: 8, avg_daily_units: 2.7, days_of_cover: 3.0, reorder_qty: 95, risk_level: "LOW", inventory_source: null },
];

export function getDemoRestock(params: { days: number; target_days: number; marketplace: string; limit: number }): RestockResponse {
  return {
    days: params.days,
    target_days: params.target_days,
    marketplace: params.marketplace,
    limit: params.limit,
    items: DEMO_RESTOCK_ITEMS,
  };
}

function demoForecastPoints(count: number, baseUnits: number): ForecastPoint[] {
  const d = new Date();
  const out: ForecastPoint[] = [];
  for (let i = 1; i <= count; i++) {
    const x = new Date(d);
    x.setDate(x.getDate() + i);
    out.push({
      date: x.toISOString().slice(0, 10),
      units: Math.round(baseUnits * (0.9 + Math.random() * 0.2)),
    });
  }
  return out;
}

function demoBacktestPoints(count: number): BacktestPoint[] {
  const start = DEMO_DAYS - count;
  const slice = DEMO_DATES.slice(Math.max(0, start), DEMO_DAYS);
  return slice.map((date, i) => {
    const actual = 18 + (i % 6) * 3;
    const predicted = actual + Math.round((Math.random() - 0.5) * 4);
    return { date, actual_units: actual, predicted_units: Math.max(0, predicted) };
  });
}

const DEMO_INTELLIGENCE = {
  trend: "stable" as const,
  confidence: "high" as const,
  daily_demand_estimate: 18.2,
  volatility_cv: 0.22,
  forecast_range: { low: 450, expected: 546, high: 642 },
};

function demoConfidenceBounds(forecastPoints: ForecastPoint[], margin: number): ForecastBoundPoint[] {
  return forecastPoints.map((p) => ({
    date: p.date,
    predicted_units: p.units,
    lower: Math.max(0, Math.round(p.units - margin)),
    upper: Math.round(p.units + margin),
  }));
}

const DEMO_DRIFT: ForecastDrift = {
  flag: true,
  window_days: 14,
  mae: 3.2,
  mape: 0.18,
  threshold: 0.12,
};

export function getDemoForecastTotal(params: { history_days: number; horizon_days: number; marketplace: string }): ForecastResponse {
  const dataEnd = DEMO_DATES[DEMO_DAYS - 1];
  const actualPoints: ForecastPoint[] = DEMO_DATES.slice(-Math.min(60, params.history_days)).map((date, i) => ({
    date,
    units: 16 + (i % 5) * 2,
  }));
  const forecastPoints = demoForecastPoints(params.horizon_days, 18);
  const backtestPoints = demoBacktestPoints(30);
  const expectedTotal = forecastPoints.reduce((s, p) => s + p.units, 0);
  const low = Math.round(expectedTotal * 0.82);
  const high = Math.round(expectedTotal * 1.18);
  const confidence_bounds = demoConfidenceBounds(forecastPoints, 4);
  return {
    kind: "total",
    sku: null,
    marketplace: params.marketplace,
    history_days: params.history_days,
    horizon_days: params.horizon_days,
    model_name: "demo-seasonality",
    mae_30d: 2.4,
    data_end_date: dataEnd,
    mape_30d: 0.12,
    backtest_points: backtestPoints,
    actual_points: actualPoints,
    forecast_points: forecastPoints,
    intelligence: {
      ...DEMO_INTELLIGENCE,
      daily_demand_estimate: expectedTotal / params.horizon_days,
      forecast_range: { low, expected: expectedTotal, high },
    },
    recommendation: "Forecast suggests ~18 units/day. Plan replenishment accordingly.",
    reasoning: [
      "Demand is stable with no significant trend change.",
      "Forecast accuracy (MAPE) is good; plan with moderate buffer.",
    ],
    confidence_bounds,
    drift: DEMO_DRIFT,
    applied_overrides: [],
  };
}

export function getDemoForecastSku(params: { sku: string; history_days: number; horizon_days: number; marketplace: string }): ForecastResponse {
  const base = getDemoForecastTotal(params);
  return {
    ...base,
    kind: "sku",
    sku: params.sku,
    recommendation: `Forecast for ${params.sku} suggests ~18 units/day. Plan replenishment accordingly.`,
    reasoning: [
      "Demand is stable with no significant trend change.",
      "Forecast accuracy (MAPE) is good; plan with moderate buffer.",
    ],
    confidence_bounds: base.confidence_bounds ?? undefined,
    drift: base.drift,
    applied_overrides: base.applied_overrides ?? [],
  };
}

export function getDemoForecastTopSkus(params: { days: number; marketplace: string; limit: number }): ForecastTopSkuRow[] {
  return DEMO_SKUS.slice(0, Math.min(params.limit, DEMO_SKUS.length)).map((p) => ({
    sku: p.sku,
    title: p.title ?? p.sku,
    asin: p.asin,
    total_units: p.units,
    avg_daily: p.units / 30,
  }));
}

export function getDemoForecastRestockPlan(params: {
  sku: string;
  horizon_days: number;
  lead_time_days: number;
  service_level: number;
  marketplace: string;
}): ForecastRestockPlanResponse {
  return {
    sku: params.sku,
    marketplace: params.marketplace,
    horizon_days: params.horizon_days,
    lead_time_days: params.lead_time_days,
    service_level: params.service_level,
    avg_daily_forecast_units: 4.2,
    forecast_units_lead_time: 58.8,
    safety_stock_units: 18,
    recommended_reorder_qty: 77,
    inventory_freshness: null,
    inventory_age_hours: null,
    inventory_as_of_at: null,
    inventory_warning_message: null,
    inventory_source: null,
    no_inventory_data: false,
    data_quality: null,
  };
}

export function getDemoRestockPlan(params: {
  sku: string;
  marketplace: string;
  lead_time_days: number;
  service_level: number;
  current_inventory?: number;
}): RestockPlanResponse {
  const dataEnd = DEMO_DATES[DEMO_DAYS - 1];
  return {
    sku: params.sku,
    marketplace: params.marketplace,
    lead_time_days: params.lead_time_days,
    service_level: params.service_level,
    data_end_date: dataEnd,
    avg_daily_demand: 4.2,
    lead_time_demand: 58.8,
    safety_stock: 18,
    reorder_quantity: 77,
    mape_30d: 0.12,
    days_of_cover: params.current_inventory != null ? params.current_inventory / 4.2 : null,
    expected_stockout_date: params.current_inventory != null ? dataEnd : null,
    stockout_before_lead_time: params.current_inventory != null && params.current_inventory < 60 ? true : null,
    no_inventory_data: false,
    inventory_source: null,
    data_quality: null,
  };
}

export function getDemoSuggestedSkus(marketplace: string): string[] {
  return DEMO_SKUS.map((p) => p.sku);
}

// --- Forecast overrides (Sprint 15) demo ---
const DEMO_OVERRIDES: ForecastOverrideResponse[] = [
  {
    id: 1,
    sku: null,
    marketplace_code: "US",
    start_date: new Date(Date.now() + 86400_000 * 2).toISOString().slice(0, 10),
    end_date: new Date(Date.now() + 86400_000 * 9).toISOString().slice(0, 10),
    override_type: "multiplier",
    value: 1.25,
    reason: "Demo: promotion week",
    created_by_user_id: 1,
    created_by_email: "demo@example.com",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

export function getDemoForecastOverrides(params: {
  sku?: string;
  marketplace?: string;
}): ForecastOverrideResponse[] {
  let items = [...DEMO_OVERRIDES];
  if (params.sku?.trim()) {
    items = items.filter((r) => r.sku === params.sku!.trim());
  }
  if (params.marketplace?.trim()) {
    items = items.filter((r) => r.marketplace_code === params.marketplace!.trim());
  }
  return items;
}

/** Sprint 16: Demo restock recommendations (advanced) */
const DEMO_RESTOCK_RECOMMENDATIONS: RestockRecommendationRowOut[] = [
  {
    sku: "DEMO-SKU-001",
    marketplace_code: "US",
    supplier_id: 1,
    supplier_name: "Demo Supplier A",
    on_hand_units: 12,
    inbound_units: 0,
    reserved_units: 0,
    available_units: 12,
    daily_demand_forecast: 5.2,
    days_of_cover: 2.31,
    lead_time_days_mean: 14,
    lead_time_days_std: 2,
    safety_stock_units: 18,
    reorder_point_units: 91,
    target_stock_units: 127,
    recommended_order_units: 115,
    recommended_order_units_rounded: 120,
    priority_score: 0.42,
    reason_flags: ["urgent_stockout_risk", "moq_applied"],
  },
  {
    sku: "DEMO-SKU-002",
    marketplace_code: "US",
    supplier_id: 1,
    supplier_name: "Demo Supplier A",
    on_hand_units: 28,
    inbound_units: 0,
    reserved_units: 0,
    available_units: 28,
    daily_demand_forecast: 4.0,
    days_of_cover: 7.0,
    lead_time_days_mean: 14,
    lead_time_days_std: 2,
    safety_stock_units: 14,
    reorder_point_units: 70,
    target_stock_units: 98,
    recommended_order_units: 70,
    recommended_order_units_rounded: 70,
    priority_score: 0.14,
    reason_flags: ["reorder_soon"],
  },
  {
    sku: "DEMO-SKU-003",
    marketplace_code: "US",
    supplier_id: null,
    supplier_name: null,
    on_hand_units: 8,
    inbound_units: 0,
    reserved_units: 0,
    available_units: 8,
    daily_demand_forecast: 2.7,
    days_of_cover: 2.96,
    lead_time_days_mean: 14,
    lead_time_days_std: 0,
    safety_stock_units: 10,
    reorder_point_units: 48,
    target_stock_units: 67,
    recommended_order_units: 59,
    recommended_order_units_rounded: 59,
    priority_score: 0.35,
    reason_flags: ["missing_supplier_settings", "urgent_stockout_risk"],
  },
];

export function getDemoRestockRecommendations(params: {
  days?: number;
  marketplace?: string;
  supplier_id?: number;
  urgent_only?: boolean;
  missing_settings_only?: boolean;
}): RestockRecommendationRowOut[] {
  let items = [...DEMO_RESTOCK_RECOMMENDATIONS];
  if (params.supplier_id != null) {
    items = items.filter((r) => r.supplier_id === params.supplier_id);
  }
  if (params.urgent_only === true) {
    items = items.filter((r) => r.reason_flags.includes("urgent_stockout_risk"));
  }
  if (params.missing_settings_only === true) {
    items = items.filter((r) => r.reason_flags.includes("missing_supplier_settings"));
  }
  return items;
}

export function getDemoRestockDetail(params: {
  sku: string;
  days?: number;
  marketplace?: string;
}): RestockRecommendationRowOut {
  const row = DEMO_RESTOCK_RECOMMENDATIONS.find((r) => r.sku === params.sku);
  if (row) return { ...row };
  return {
    sku: params.sku,
    marketplace_code: params.marketplace ?? "US",
    supplier_id: null,
    supplier_name: null,
    on_hand_units: 0,
    inbound_units: 0,
    reserved_units: 0,
    available_units: 0,
    daily_demand_forecast: 0,
    days_of_cover: null,
    lead_time_days_mean: 14,
    lead_time_days_std: 0,
    safety_stock_units: 0,
    reorder_point_units: 0,
    target_stock_units: 0,
    recommended_order_units: 0,
    recommended_order_units_rounded: 0,
    priority_score: 0,
    reason_flags: ["missing_supplier_settings", "missing_forecast_fallback_used"],
  };
}

/** Demo restock actions (Phase 5C): sensible demo with current_stock_units, status, order_by_date, reorder qty */
function demoRestockActionItem(
  params: {
    sku: string | null;
    marketplace: string;
    horizon_days: number;
    lead_time_days: number;
    service_level: number;
    current_stock_units: number | null;
  },
  overrides: Partial<RestockActionItem> = {}
): RestockActionItem {
  const { sku, marketplace, horizon_days, lead_time_days, service_level, current_stock_units } =
    params;
  const daily = 18.2;
  const dataEnd = DEMO_DATES[DEMO_DAYS - 1];
  const hasStock = current_stock_units != null && current_stock_units > 0;

  let status: RestockActionItem["status"] = "insufficient_data";
  let days_of_cover_expected: number | null = null;
  let days_of_cover_low: number | null = null;
  let days_of_cover_high: number | null = null;
  let stockout_date_expected: string | null = null;
  let order_by_date: string | null = null;
  let suggested_reorder_qty_expected = 0;
  let suggested_reorder_qty_high = 0;
  let recommendation = "Add inventory/stock data to enable restock actions.";
  let reasoning: string[] = [
    "Current stock or data end date is missing, or daily demand is zero.",
    "Provide current_stock_units and ensure forecast data is available.",
  ];

  if (hasStock && daily > 0) {
    days_of_cover_expected = current_stock_units! / daily;
    days_of_cover_low = current_stock_units! / (daily * 1.2);
    days_of_cover_high = current_stock_units! / (daily * 0.8);
    const docDays = Math.ceil(days_of_cover_expected);
    const stockoutDate = new Date(dataEnd);
    stockoutDate.setDate(stockoutDate.getDate() + docDays);
    stockout_date_expected = stockoutDate.toISOString().slice(0, 10);
    const orderBy = new Date(stockout_date_expected);
    orderBy.setDate(orderBy.getDate() - lead_time_days);
    order_by_date = orderBy.toISOString().slice(0, 10);
    const target_days = lead_time_days + 14;
    suggested_reorder_qty_expected = Math.max(0, daily * target_days - current_stock_units!);
    suggested_reorder_qty_high = Math.max(0, daily * 1.2 * target_days - current_stock_units!);
    if (days_of_cover_expected <= lead_time_days + 3) {
      status = "urgent";
      recommendation = "Reorder now to avoid stockout during lead time.";
    } else if (days_of_cover_expected <= lead_time_days + 10) {
      status = "watch";
      recommendation = "Reorder soon (within 7 days).";
    } else {
      status = "healthy";
      recommendation = "Stock level looks OK; keep monitoring.";
    }
    reasoning = [
      `Daily demand estimate: ${daily} units/day (from forecast intelligence).`,
      `Current stock: ${current_stock_units} units.`,
      `Days of cover (expected): ${days_of_cover_expected.toFixed(1)} days.`,
      `Lead time: ${lead_time_days} days; order by ${order_by_date} to avoid stockout.`,
      `Suggested reorder: ${suggested_reorder_qty_expected.toFixed(0)} units (expected) or ${suggested_reorder_qty_high.toFixed(0)} units (buffered).`,
    ];
  }

  return {
    sku,
    marketplace,
    horizon_days,
    lead_time_days,
    service_level,
    current_stock_units,
    daily_demand_estimate: daily,
    demand_range_daily: { low: daily * 0.82, expected: daily, high: daily * 1.18 },
    days_of_cover_expected,
    days_of_cover_low,
    days_of_cover_high,
    stockout_date_expected,
    order_by_date,
    suggested_reorder_qty_expected: Math.round(suggested_reorder_qty_expected),
    suggested_reorder_qty_high: Math.round(suggested_reorder_qty_high),
    status,
    recommendation,
    reasoning,
    inventory_freshness: null,
    inventory_age_hours: null,
    inventory_as_of_at: null,
    inventory_warning_message: null,
    ...overrides,
  };
}

export function getDemoRestockActionsTotal(params: {
  marketplace?: string;
  horizon_days?: number;
  lead_time_days?: number;
  service_level?: number;
  current_stock_units?: number | null;
}): RestockActionsResponse {
  const horizon_days = params.horizon_days ?? 30;
  const lead_time_days = params.lead_time_days ?? 14;
  const service_level = params.service_level ?? 0.95;
  const current_stock_units = params.current_stock_units ?? null;
  const item = demoRestockActionItem({
    sku: null,
    marketplace: params.marketplace ?? "ALL",
    horizon_days,
    lead_time_days,
    service_level,
    current_stock_units,
  });
  return {
    generated_at: new Date().toISOString(),
    items: [item],
    data_quality: null,
  };
}

export function getDemoRestockActionsSku(
  sku: string,
  params: {
    marketplace?: string;
    horizon_days?: number;
    lead_time_days?: number;
    service_level?: number;
    current_stock_units?: number | null;
  }
): RestockActionsResponse {
  const horizon_days = params.horizon_days ?? 30;
  const lead_time_days = params.lead_time_days ?? 14;
  const service_level = params.service_level ?? 0.95;
  const current_stock_units = params.current_stock_units ?? 80;
  const item = demoRestockActionItem({
    sku,
    marketplace: params.marketplace ?? "ALL",
    horizon_days,
    lead_time_days,
    service_level,
    current_stock_units,
  });
  return {
    generated_at: new Date().toISOString(),
    items: [item],
    data_quality: null,
  };
}

// ——— Demo inventory (Phase 6) ——— in-memory store
const STALE_DAYS = 7;

function freshnessDays(updatedAt: string): number {
  const updated = new Date(updatedAt).getTime();
  const now = Date.now();
  return Math.max(0, Math.floor((now - updated) / 86400_000));
}

function toDemoInventoryItem(
  sku: string,
  marketplace: string,
  on_hand_units: number,
  reserved_units: number,
  source: string,
  note: string | null,
  updated_at: string,
  created_at: string
): InventoryItemResponse {
  const available_units = Math.max(0, on_hand_units - reserved_units);
  const fd = freshnessDays(updated_at);
  return {
    sku,
    marketplace,
    on_hand_units,
    reserved_units,
    available_units,
    source,
    note,
    updated_at,
    created_at,
    freshness_days: fd,
    is_stale: fd >= STALE_DAYS,
    as_of_at: null,
    inventory_freshness: "unknown",
    inventory_age_hours: null,
  };
}

const demoInventoryStore: InventoryItemResponse[] = [
  toDemoInventoryItem(
    "DEMO-SKU-001",
    "US",
    120,
    10,
    "manual",
    "Demo item A",
    new Date(Date.now() - 2 * 86400_000).toISOString(),
    new Date(Date.now() - 30 * 86400_000).toISOString()
  ),
  toDemoInventoryItem(
    "DEMO-SKU-002",
    "US",
    85,
    0,
    "manual",
    null,
    new Date().toISOString(),
    new Date(Date.now() - 14 * 86400_000).toISOString()
  ),
  toDemoInventoryItem(
    "DEMO-SKU-003",
    "UK",
    45,
    5,
    "manual",
    "UK stock",
    new Date(Date.now() - 10 * 86400_000).toISOString(),
    new Date(Date.now() - 10 * 86400_000).toISOString()
  ),
];

export function getDemoInventoryList(params: {
  marketplace?: string;
  q?: string;
  limit?: number;
}): InventoryListResponse {
  let items = [...demoInventoryStore];
  if (params.marketplace) {
    items = items.filter((i) => i.marketplace === params.marketplace);
  }
  if (params.q && params.q.trim()) {
    const q = params.q.trim().toLowerCase();
    items = items.filter((i) => i.sku.toLowerCase().includes(q));
  }
  const limit = Math.min(params.limit ?? 200, 500);
  return { items: items.slice(0, limit) };
}

export function getDemoInventoryItem(marketplace: string, sku: string): InventoryItemResponse | null {
  return (
    demoInventoryStore.find(
      (i) => i.marketplace === marketplace && i.sku === sku
    ) ?? null
  );
}

export function upsertDemoInventory(payload: InventoryUpsertRequest): InventoryItemResponse {
  const now = new Date().toISOString();
  const existing = demoInventoryStore.find(
    (i) => i.marketplace === payload.marketplace && i.sku === payload.sku
  );
  const reserved = payload.reserved_units ?? 0;
  const item = toDemoInventoryItem(
    payload.sku,
    payload.marketplace,
    payload.on_hand_units,
    reserved,
    payload.source ?? "manual",
    payload.note ?? null,
    now,
    existing?.created_at ?? now
  );
  if (existing) {
    const idx = demoInventoryStore.indexOf(existing);
    demoInventoryStore[idx] = item;
  } else {
    demoInventoryStore.push(item);
  }
  return item;
}

export function deleteDemoInventory(marketplace: string, sku: string): void {
  const idx = demoInventoryStore.findIndex(
    (i) => i.marketplace === marketplace && i.sku === sku
  );
  if (idx !== -1) demoInventoryStore.splice(idx, 1);
}

// ——— Demo alerts (Phase 7B) ——— in-memory store + ack + run

const demoAlertsStore: AlertEventResponse[] = [
  {
    id: 1,
    alert_type: "urgent_restock",
    severity: "critical",
    sku: "DEMO-SKU-001",
    marketplace: "US",
    title: "Urgent restock — DEMO-SKU-001 (US)",
    message: "Reorder now to avoid stockout during lead time.",
    is_acknowledged: false,
    acknowledged_at: null,
    created_at: new Date(Date.now() - 3600_000).toISOString(),
  },
  {
    id: 2,
    alert_type: "inventory_stale",
    severity: "warning",
    sku: "DEMO-SKU-003",
    marketplace: "UK",
    title: "Inventory stale — DEMO-SKU-003 (UK)",
    message: "Inventory last updated 10 days ago. Update stock data for accurate restock alerts.",
    is_acknowledged: false,
    acknowledged_at: null,
    created_at: new Date(Date.now() - 7200_000).toISOString(),
  },
  {
    id: 3,
    alert_type: "reorder_soon",
    severity: "warning",
    sku: "DEMO-SKU-002",
    marketplace: "US",
    title: "Reorder soon — DEMO-SKU-002 (US)",
    message: "Reorder soon (within 7 days).",
    is_acknowledged: true,
    acknowledged_at: new Date(Date.now() - 86400_000).toISOString(),
    created_at: new Date(Date.now() - 2 * 86400_000).toISOString(),
  },
];

let demoAlertIdNext = 4;

export function getDemoAlerts(params: {
  severity?: string;
  unacknowledged?: boolean;
  limit?: number;
}): AlertListResponse {
  let items = [...demoAlertsStore];
  if (params.severity) {
    items = items.filter((a) => a.severity === params.severity);
  }
  if (params.unacknowledged === true) {
    items = items.filter((a) => !a.is_acknowledged);
  }
  const limit = Math.min(params.limit ?? 200, 500);
  return { items: items.slice(0, limit) };
}

export function acknowledgeDemoAlerts(ids: number[]): number {
  let count = 0;
  const now = new Date().toISOString();
  ids.forEach((id) => {
    const a = demoAlertsStore.find((e) => e.id === id);
    if (a && !a.is_acknowledged) {
      a.is_acknowledged = true;
      a.acknowledged_at = now;
      count++;
    }
  });
  return count;
}

export function runDemoAlertsNow(): { created: number; emailed: number } {
  // Add one demo alert when "Run now" is clicked (demo behavior)
  const created: AlertEventResponse = {
    id: demoAlertIdNext++,
    alert_type: "inventory_stale",
    severity: "info",
    sku: "DEMO-SKU-001",
    marketplace: "US",
    title: "Demo: Inventory check — DEMO-SKU-001 (US)",
    message: "Demo alert generated by Run now. In production, alerts are generated by the worker.",
    is_acknowledged: false,
    acknowledged_at: null,
    created_at: new Date().toISOString(),
  };
  demoAlertsStore.unshift(created);
  return { created: 1, emailed: 0 };
}

const demoAlertSettingsStore: AlertSettingsResponse = {
  email_enabled: false,
  email_recipients: null,
  send_inventory_stale: true,
  send_urgent_restock: true,
  send_reorder_soon: true,
  send_order_by_passed: true,
  stale_days_threshold: 7,
  updated_at: new Date().toISOString(),
};

export function getDemoAlertSettings(): AlertSettingsResponse {
  return { ...demoAlertSettingsStore };
}

export function updateDemoAlertSettings(patch: AlertSettingsUpdateRequest): AlertSettingsResponse {
  if (patch.email_enabled != null) demoAlertSettingsStore.email_enabled = patch.email_enabled;
  if (patch.email_recipients !== undefined)
    demoAlertSettingsStore.email_recipients = patch.email_recipients;
  if (patch.send_inventory_stale != null)
    demoAlertSettingsStore.send_inventory_stale = patch.send_inventory_stale;
  if (patch.send_urgent_restock != null)
    demoAlertSettingsStore.send_urgent_restock = patch.send_urgent_restock;
  if (patch.send_reorder_soon != null)
    demoAlertSettingsStore.send_reorder_soon = patch.send_reorder_soon;
  if (patch.send_order_by_passed != null)
    demoAlertSettingsStore.send_order_by_passed = patch.send_order_by_passed;
  if (patch.stale_days_threshold != null) {
    if (patch.stale_days_threshold < 1 || patch.stale_days_threshold > 60)
      throw new Error("stale_days_threshold must be between 1 and 60");
    demoAlertSettingsStore.stale_days_threshold = patch.stale_days_threshold;
  }
  demoAlertSettingsStore.updated_at = new Date().toISOString();
  return getDemoAlertSettings();
}

// --- Ads (Sprint 13) demo ---
export function getDemoAdsSummary(params: { days: number; marketplace: string }): AdsDashboardSummary {
  const spend = 3200;
  const sales = 28450;
  return {
    spend,
    sales,
    acos: sales > 0 ? (spend / sales) * 100 : null,
    roas: spend > 0 ? sales / spend : null,
    marketplace: params.marketplace,
    days: params.days,
  };
}

export function getDemoAdsTimeseries(params: { days: number; marketplace: string }): AdsTimeseriesResponse {
  const days = Math.min(Math.max(1, params.days), DEMO_DAYS);
  const start = DEMO_DAYS - days;
  const slice = DEMO_DATES.slice(start, DEMO_DAYS);
  const points: AdsTimeseriesPoint[] = slice.map((date, i) => {
    const spend = 80 + (i % 7) * 15;
    const sales = 400 + (i % 5) * 80;
    return {
      date,
      spend: Math.round(spend * (0.9 + Math.random() * 0.2) * 100) / 100,
      sales: Math.round(sales * (0.85 + Math.random() * 0.3) * 100) / 100,
      acos: sales > 0 ? (spend / sales) * 100 : null,
      roas: spend > 0 ? sales / spend : null,
    };
  });
  return {
    days: params.days,
    marketplace: params.marketplace,
    points,
  };
}

// --- Ads Attribution (Sprint 14) demo ---
const DEMO_SKU_PROFITABILITY: SkuProfitabilityRow[] = [
  {
    sku: "DEMO-SKU-001",
    marketplace_code: "US",
    revenue: 8200,
    ad_spend: 420,
    attributed_sales: 3800,
    organic_sales: 4400,
    units_sold: 240,
    unit_cogs: 12.5,
    total_cogs: 3000,
    gross_profit: 5200,
    net_profit: 4780,
    acos: 11.05,
    roas: 9.05,
    warning_flags: [],
  },
  {
    sku: "DEMO-SKU-002",
    marketplace_code: "US",
    revenue: 6500,
    ad_spend: 380,
    attributed_sales: 2900,
    organic_sales: 3600,
    units_sold: 180,
    unit_cogs: null,
    total_cogs: null,
    gross_profit: null,
    net_profit: null,
    acos: 13.1,
    roas: 7.63,
    warning_flags: ["missing_cogs"],
  },
  {
    sku: "DEMO-SKU-003",
    marketplace_code: "US",
    revenue: 4200,
    ad_spend: null,
    attributed_sales: null,
    organic_sales: null,
    units_sold: 120,
    unit_cogs: 8,
    total_cogs: 960,
    gross_profit: 3240,
    net_profit: null,
    acos: null,
    roas: null,
    warning_flags: ["missing_attribution"],
  },
];

export function getDemoSkuProfitability(params: {
  days: number;
  marketplace: string;
}): SkuProfitabilityResponse {
  return {
    days: params.days,
    marketplace: params.marketplace,
    rows: DEMO_SKU_PROFITABILITY,
  };
}

export function getDemoSkuTimeseries(
  sku: string,
  params: { days: number; marketplace: string }
): SkuTimeseriesResponse {
  const days = Math.min(Math.max(1, params.days), DEMO_DAYS);
  const start = DEMO_DAYS - days;
  const slice = DEMO_DATES.slice(start, DEMO_DAYS);
  const points: SkuTimeseriesPoint[] = slice.map((date, i) => {
    const revenue = 80 + (i % 7) * 25;
    const adSpend = 12 + (i % 5) * 4;
    const attributed = Math.round(revenue * 0.45);
    const netProfit = revenue - (sku === "DEMO-SKU-002" ? 0 : revenue * 0.35) - adSpend;
    return {
      date,
      revenue,
      ad_spend: adSpend,
      attributed_sales: attributed,
      net_profit: netProfit,
      units: 3 + (i % 4),
    };
  });
  return {
    sku,
    days: params.days,
    marketplace: params.marketplace,
    points,
  };
}

// --- Sprint 17: System Health demo ---
const nowIso = () => new Date().toISOString();
const oneHourAgo = () => new Date(Date.now() - 3600 * 1000).toISOString();
const twoHoursAgo = () => new Date(Date.now() - 2 * 3600 * 1000).toISOString();

export function getDemoHealthSummary(): HealthSummaryResponse {
  return {
    status: "ok",
    last_orders_sync_at: oneHourAgo(),
    last_ads_sync_at: twoHoursAgo(),
    last_job_runs: [
      { job_name: "orders_sync", last_started_at: oneHourAgo(), last_status: "success", last_finished_at: oneHourAgo(), last_error: null },
      { job_name: "ads_sync", last_started_at: twoHoursAgo(), last_status: "success", last_finished_at: twoHoursAgo(), last_error: null },
      { job_name: "notifications_dispatch", last_started_at: oneHourAgo(), last_status: "success", last_finished_at: oneHourAgo(), last_error: null },
    ],
    failed_notifications_count: 0,
  };
}

export function getDemoHealthJobs(limit = 20): JobRunOut[] {
  return [
    { id: 1, job_name: "orders_sync", status: "success", started_at: oneHourAgo(), finished_at: oneHourAgo(), error: null, job_metadata: { orders_count: 42 } },
    { id: 2, job_name: "ads_sync", status: "success", started_at: twoHoursAgo(), finished_at: twoHoursAgo(), error: null, job_metadata: { profiles_upserted: 2 } },
    { id: 3, job_name: "notifications_dispatch", status: "success", started_at: oneHourAgo(), finished_at: oneHourAgo(), error: null, job_metadata: null },
  ];
}

export function getDemoHealthNotifications(limit = 20): NotificationDeliveryOut[] {
  return [
    {
      id: 1,
      notification_type: "stale_orders",
      severity: "warning",
      channel: "ui",
      recipient: "admin",
      subject: "Orders sync is stale",
      status: "sent",
      attempts: 1,
      last_error: null,
      created_at: twoHoursAgo(),
      updated_at: twoHoursAgo(),
    },
  ];
}

/** Sprint 18: Demo Amazon accounts for selector in demo mode. */
export function getDemoAmazonAccounts(): AmazonAccountResponse[] {
  const now = new Date().toISOString();
  return [
    { id: 1, name: "Default", is_active: true, created_at: now, updated_at: now },
    { id: 2, name: "EU Account", is_active: true, created_at: now, updated_at: now },
  ];
}
