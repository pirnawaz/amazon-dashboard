export type TokenResponse = {
  access_token: string;
  token_type: "bearer";
};

export type UserPublic = {
  id: number;
  email: string;
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
    const text = await res.text();
    try {
      const j = JSON.parse(text) as { detail?: string; message?: string };
      const msg = (j.detail ?? j.message ?? text) || `Request failed: ${res.status}`;
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

export async function me(token: string): Promise<UserPublic> {
  return http<UserPublic>("/api/me", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
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
