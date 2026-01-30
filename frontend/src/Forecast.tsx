import { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import {
  forecastTotal,
  forecastSku,
  forecastTopSkus,
  type ForecastResponse,
  type ForecastTopSkuRow,
} from "./api";

const MARKETPLACE_OPTIONS = ["ALL", "US", "UK", "DE"] as const;
const HORIZON_OPTIONS = [14, 30] as const;
const CHART_ACTUAL_DAYS = 60;

function formatShortDate(isoDate: string): string {
  const d = new Date(isoDate);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

type Props = {
  token: string;
};

export default function Forecast({ token }: Props) {
  const [mode, setMode] = useState<"total" | "sku">("total");
  const [marketplace, setMarketplace] = useState<string>("ALL");
  const [horizonDays, setHorizonDays] = useState<number>(30);
  const [skuSelect, setSkuSelect] = useState<string>("");
  const [skuManual, setSkuManual] = useState<string>("");
  const [data, setData] = useState<ForecastResponse | null>(null);
  const [topSkus, setTopSkus] = useState<ForecastTopSkuRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const effectiveSku = mode === "sku" ? (skuSelect || skuManual).trim() : "";

  useEffect(() => {
    if (!token || mode !== "sku") return;
    setError(null);
    forecastTopSkus(token, { days: 30, marketplace, limit: 20 })
      .then(setTopSkus)
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : "Failed to load top SKUs")
      );
  }, [token, mode, marketplace]);

  useEffect(() => {
    if (!token) return;
    if (mode === "sku" && !effectiveSku) {
      setData(null);
      return;
    }
    setError(null);
    setLoading(true);
    const historyDays = 180;
    const params = {
      history_days: historyDays,
      horizon_days: horizonDays,
      marketplace,
    };
    const req =
      mode === "total"
        ? forecastTotal(token, params)
        : forecastSku(token, { ...params, sku: effectiveSku });
    req
      .then(setData)
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : "Failed to load forecast")
      )
      .finally(() => setLoading(false));
  }, [token, mode, marketplace, horizonDays, effectiveSku]);

  const actualLast60 = data?.actual_points?.slice(-CHART_ACTUAL_DAYS) ?? [];
  const forecastPoints = data?.forecast_points ?? [];
  const actualByDate = Object.fromEntries(actualLast60.map((p) => [p.date, p.units]));
  const forecastByDate = Object.fromEntries(forecastPoints.map((p) => [p.date, p.units]));
  const allDates = [
    ...actualLast60.map((p) => p.date),
    ...forecastPoints.map((p) => p.date),
  ].filter((d, i, arr) => arr.indexOf(d) === i);
  allDates.sort();
  const chartData = allDates.map((date) => ({
    date,
    dateLabel: formatShortDate(date),
    actual: actualByDate[date] ?? undefined,
    forecast: forecastByDate[date] ?? undefined,
  }));

  return (
    <section style={{ marginTop: 24 }}>
      <h2>Forecast</h2>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "center", marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span>Mode:</span>
          <button
            onClick={() => setMode("total")}
            style={{ fontWeight: mode === "total" ? "bold" : "normal" }}
          >
            Total
          </button>
          <button
            onClick={() => setMode("sku")}
            style={{ fontWeight: mode === "sku" ? "bold" : "normal" }}
          >
            SKU
          </button>
        </div>

        <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
          Marketplace:
          <select
            value={marketplace}
            onChange={(e) => setMarketplace(e.target.value)}
            style={{ padding: 6 }}
          >
            {MARKETPLACE_OPTIONS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>

        <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
          Horizon:
          <select
            value={horizonDays}
            onChange={(e) => setHorizonDays(Number(e.target.value))}
            style={{ padding: 6 }}
          >
            {HORIZON_OPTIONS.map((h) => (
              <option key={h} value={h}>
                {h} days
              </option>
            ))}
          </select>
        </label>

        {mode === "sku" && (
          <>
            <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
              SKU (dropdown):
              <select
                value={skuSelect}
                onChange={(e) => setSkuSelect(e.target.value)}
                style={{ padding: 6, minWidth: 160 }}
              >
                <option value="">-- Select --</option>
                {topSkus.map((r) => (
                  <option key={r.sku} value={r.sku}>
                    {r.sku} ({r.title.slice(0, 30)}…)
                  </option>
                ))}
              </select>
            </label>
            <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
              Or manual SKU:
              <input
                type="text"
                value={skuManual}
                onChange={(e) => setSkuManual(e.target.value)}
                placeholder="e.g. SKU-0001"
                style={{ padding: 6, width: 120 }}
              />
            </label>
          </>
        )}
      </div>

      {error && (
        <pre style={{ background: "#fee", padding: 12, marginBottom: 16, whiteSpace: "pre-wrap" }}>
          {error}
        </pre>
      )}

      {loading && <p>Loading forecast…</p>}

      {data && !loading && (
        <>
          <p>
            <strong>MAE (last 30 days):</strong> {data.mae_30d.toFixed(4)} &nbsp;| Model: {data.model_name}
          </p>
          <div style={{ width: "100%", height: 360, marginTop: 16 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 8, right: 24, left: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="dateLabel" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  labelFormatter={(_, payload) =>
                    payload?.[0]?.payload?.date ? formatShortDate(payload[0].payload.date) : ""
                  }
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="actual"
                  name="Actual (units)"
                  stroke="#2563eb"
                  dot={false}
                  connectNulls
                />
                <Line
                  type="monotone"
                  dataKey="forecast"
                  name="Forecast (units)"
                  stroke="#dc2626"
                  strokeDasharray="4 4"
                  dot={false}
                  connectNulls
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </>
      )}

      {mode === "sku" && !effectiveSku && !loading && (
        <p style={{ color: "#666" }}>Select a SKU from the dropdown or enter one manually to see the forecast.</p>
      )}
    </section>
  );
}
