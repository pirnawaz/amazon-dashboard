import { useEffect, useState } from "react";
import { restock, type RestockResponse } from "./api";

const DAYS_OPTIONS = [7, 30, 90] as const;
const TARGET_DAYS_OPTIONS = [14, 30, 60] as const;
const MARKETPLACE_OPTIONS = ["ALL", "US", "UK", "DE"] as const;

function riskBadgeStyle(risk: string): React.CSSProperties {
  if (risk === "CRITICAL") return { padding: "4px 8px", background: "#fecaca", borderRadius: 4 };
  if (risk === "LOW") return { padding: "4px 8px", background: "#fef3c7", borderRadius: 4 };
  return { padding: "4px 8px", background: "#d1fae5", borderRadius: 4 };
}

type Props = {
  token: string;
};

export default function Restock({ token }: Props) {
  const [days, setDays] = useState<number>(30);
  const [targetDays, setTargetDays] = useState<number>(30);
  const [marketplace, setMarketplace] = useState<string>("ALL");
  const [data, setData] = useState<RestockResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
    setLoading(true);
    restock(token, { days, target_days: targetDays, marketplace, limit: 50 })
      .then(setData)
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : "Failed to load restock data")
      )
      .finally(() => setLoading(false));
  }, [token, days, targetDays, marketplace]);

  return (
    <section style={{ marginTop: 24 }}>
      <h2>Restock</h2>
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
          Target days
          <select
            value={targetDays}
            onChange={(e) => setTargetDays(Number(e.target.value))}
            style={{ marginLeft: 8, padding: 6 }}
          >
            {TARGET_DAYS_OPTIONS.map((d) => (
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
      {!loading && data && (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 700 }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #ccc", textAlign: "left" }}>
                <th style={{ padding: "8px 12px" }}>Risk</th>
                <th style={{ padding: "8px 12px" }}>SKU</th>
                <th style={{ padding: "8px 12px" }}>Title</th>
                <th style={{ padding: "8px 12px" }}>On Hand</th>
                <th style={{ padding: "8px 12px" }}>Avg Daily Units</th>
                <th style={{ padding: "8px 12px" }}>Days of Cover</th>
                <th style={{ padding: "8px 12px" }}>Reorder Qty</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((row) => (
                <tr key={row.sku} style={{ borderBottom: "1px solid #eee" }}>
                  <td style={{ padding: "8px 12px" }}>
                    <span style={riskBadgeStyle(row.risk_level)}>{row.risk_level}</span>
                  </td>
                  <td style={{ padding: "8px 12px" }}>{row.sku}</td>
                  <td style={{ padding: "8px 12px", maxWidth: 280 }} title={row.title ?? undefined}>
                    {row.title ?? "—"}
                  </td>
                  <td style={{ padding: "8px 12px" }}>{row.on_hand.toLocaleString()}</td>
                  <td style={{ padding: "8px 12px" }}>{row.avg_daily_units.toFixed(2)}</td>
                  <td style={{ padding: "8px 12px" }}>{row.days_of_cover.toFixed(2)}</td>
                  <td style={{ padding: "8px 12px" }}>{row.reorder_qty.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {data.items.length === 0 && (
            <p style={{ color: "#666", marginTop: 12 }}>No restock items for the selected filters.</p>
          )}
        </div>
      )}
    </section>
  );
}
