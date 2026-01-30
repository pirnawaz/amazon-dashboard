import { useEffect, useState } from "react";
import { dashboardSummary, type DashboardSummary } from "./api";

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

type Props = {
  token: string;
};

export default function Dashboard({ token }: Props) {
  const [days, setDays] = useState<number>(30);
  const [marketplace, setMarketplace] = useState<string>("ALL");
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setError(null);
    setLoading(true);
    dashboardSummary(token, { days, marketplace })
      .then(setData)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Failed to load dashboard"))
      .finally(() => setLoading(false));
  }, [token, days, marketplace]);

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
      {!loading && data !== null && (
        <div style={{ display: "grid", gap: 12, maxWidth: 400 }}>
          <div><strong>Revenue</strong>: {formatCurrency(data.revenue)}</div>
          <div><strong>Units</strong>: {data.units.toLocaleString()}</div>
          <div><strong>Orders</strong>: {data.orders.toLocaleString()}</div>
          <div><strong>Ad Spend</strong>: {formatCurrency(data.ad_spend)}</div>
          <div><strong>Net Profit (placeholder)</strong>: {formatCurrency(data.net_profit_placeholder)}</div>
        </div>
      )}
    </section>
  );
}
