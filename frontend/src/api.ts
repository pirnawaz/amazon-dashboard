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
