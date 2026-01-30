import { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  dashboardSummary,
  timeseries,
  topProducts,
  type DashboardSummary as DashboardSummaryType,
  type DashboardTimeseriesResponse,
  type TopProductsResponse,
} from "./api";

const DAYS_OPTIONS = [7, 30, 90] as const;
const MARKETPLACE_OPTIONS = ["ALL", "US", "UK", "DE"] as const;

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatShortDate(isoDate: string): string {
  const d = new Date(isoDate);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

type Props = {
  token: string;
};

export default function Dashboard({ token }: Props) {
  const [days, setDays] = useState<number>(30);
  const [marketplace, setMarketplace] = useState<string>("ALL");
  const [summary, setSummary] = useState<DashboardSummaryType | null>(null);
  const [timeseriesData, setTimeseriesData] = useState<DashboardTimeseriesResponse | null>(null);
  const [topProductsData, setTopProductsData] = useState<TopProductsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setError(null);
    setLoading(true);
    const params = { days, marketplace };
    Promise.all([
      dashboardSummary(token, params),
      timeseries(token, params),
      topProducts(token, { ...params, limit: 10 }),
    ])
      .then(([s, t, p]) => {
        setSummary(s);
        setTimeseriesData(t);
        setTopProductsData(p);
      })
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : "Failed to load dashboard")
      )
      .finally(() => setLoading(false));
  }, [token, days, marketplace]);

  const chartData =
    timeseriesData?.points.map((p) => ({
      date: p.date,
      dateLabel: formatShortDate(p.date),
      revenue: p.revenue,
      units: p.units,
      ad_spend: p.ad_spend,
    })) ?? [];

  return (
    <section style={{ marginTop: 24 }}>
      <h2>Dashboard</h2>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 16 }}>
        <label>
          Days
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            style={{ marginLeft: 8, padding: 6 }}
          >
            {DAYS_OPTIONS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </label>
        <label>
          Marketplace
          <select
            value={marketplace}
            onChange={(e) => setMarketplace(e.target.value)} 
            style={{ marginLeft: 8, padding: 6 }}
          >
            {MARKETPLACE_OPTIONS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>
      </div>
      {error && (
        <pre style={{ background: "#fee", padding: 12, marginBottom: 16, whiteSpace: "pre-wrap" }}>
          {error}
        </pre>
      )}
      {loading && <p>Loading...</p>}
      {!loading && summary !== null && (
        <>
          <div style={{ display: "grid", gap: 12, maxWidth: 500, marginBottom: 24 }}>
            <div><strong>Revenue</strong>: {formatCurrency(summary.revenue)}</div>
            <div><strong>Units</strong>: {summary.units.toLocaleString()}</div>
            <div><strong>Orders</strong>: {summary.orders.toLocaleString()}</div>
            <div><strong>Ad Spend</strong>: {formatCurrency(summary.ad_spend)}</div>
            <div><strong>Net Profit (placeholder)</strong>: {formatCurrency(summary.net_profit_placeholder)}</div>
          </div>

          {chartData.length > 0 && (
            <div style={{ display: "grid", gap: 24, marginBottom: 32 }}>
              <div style={{ width: "100%", height: 280 }}>
                <h3 style={{ marginBottom: 8 }}>Revenue over time</h3>
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="dateLabel" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `$${v}`} />
                    <Tooltip
                      formatter={(value: number) => [formatCurrency(value), "Revenue"]}
                      labelFormatter={(_, payload) =>
                        payload?.[0]?.payload?.date ? formatShortDate(payload[0].payload.date) : ""
                      }
                    />
                    <Line type="monotone" dataKey="revenue" stroke="#2563eb" strokeWidth={2} dot={false} name="Revenue" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div style={{ width: "100%", height: 280 }}>
                <h3 style={{ marginBottom: 8 }}>Units over time</h3>
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="dateLabel" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip
                      formatter={(value: number) => [value.toLocaleString(), "Units"]}
                      labelFormatter={(_, payload) =>
                        payload?.[0]?.payload?.date ? formatShortDate(payload[0].payload.date) : ""
                      }
                    />
                    <Line type="monotone" dataKey="units" stroke="#059669" strokeWidth={2} dot={false} name="Units" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div style={{ width: "100%", height: 280 }}>
                <h3 style={{ marginBottom: 8 }}>Ad Spend over time</h3>
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="dateLabel" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `$${v}`} />
                    <Tooltip
                      formatter={(value: number) => [formatCurrency(value), "Ad Spend"]}
                      labelFormatter={(_, payload) =>
                        payload?.[0]?.payload?.date ? formatShortDate(payload[0].payload.date) : ""
                      }
                    />
                    <Line type="monotone" dataKey="ad_spend" stroke="#dc2626" strokeWidth={2} dot={false} name="Ad Spend" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {topProductsData && topProductsData.products.length > 0 && (
            <div style={{ overflowX: "auto" }}>
              <h3 style={{ marginBottom: 8 }}>Top Products</h3>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 500 }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid #ccc", textAlign: "left" }}>
                    <th style={{ padding: "8px 12px" }}>SKU</th>
                    <th style={{ padding: "8px 12px" }}>Title</th>
                    <th style={{ padding: "8px 12px" }}>Revenue</th>
                    <th style={{ padding: "8px 12px" }}>Units</th>
                    <th style={{ padding: "8px 12px" }}>Orders</th>
                  </tr>
                </thead>
                <tbody>
                  {topProductsData.products.map((row) => (
                    <tr key={row.sku} style={{ borderBottom: "1px solid #eee" }}>
                      <td style={{ padding: "8px 12px" }}>{row.sku}</td>
                      <td style={{ padding: "8px 12px", maxWidth: 280 }} title={row.title ?? undefined}>
                        {row.title ?? "—"}
                      </td>
                      <td style={{ padding: "8px 12px" }}>{formatCurrency(row.revenue)}</td>
                      <td style={{ padding: "8px 12px" }}>{row.units.toLocaleString()}</td>
                      <td style={{ padding: "8px 12px" }}>{row.orders.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {topProductsData && topProductsData.products.length === 0 && (
            <p style={{ color: "#666" }}>No top products for the selected period.</p>
          )}
        </>
      )}
    </section>
  );
}
