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
    throw new Error(text || `Request failed: ${res.status}`);
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
