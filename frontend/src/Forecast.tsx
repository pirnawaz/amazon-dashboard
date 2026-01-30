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
  forecastRestockPlan,
  type ForecastResponse,
  type ForecastTopSkuRow,
  type ForecastRestockPlanResponse,
} from "./api";

const MARKETPLACE_OPTIONS = ["ALL", "US", "UK", "DE"] as const;
const HORIZON_OPTIONS = [14, 30] as const;
const LEAD_TIME_OPTIONS = [7, 14, 30] as const;
const SERVICE_LEVEL_OPTIONS = [0, 0.1, 0.2] as const;
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
  const [restockPlan, setRestockPlan] = useState<ForecastRestockPlanResponse | null>(null);
  const [leadTimeDays, setLeadTimeDays] = useState<number>(14);
  const [serviceLevel, setServiceLevel] = useState<number>(0.1);
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

  useEffect(() => {
    if (!token || mode !== "sku" || !effectiveSku) {
      setRestockPlan(null);
      return;
    }
    setError(null);
    forecastRestockPlan(token, {
      sku: effectiveSku,
      horizon_days: horizonDays,
      lead_time_days: leadTimeDays,
      service_level: serviceLevel,
      marketplace,
    })
      .then(setRestockPlan)
      .catch(() => setRestockPlan(null));
  }, [token, mode, effectiveSku, horizonDays, leadTimeDays, serviceLevel, marketplace]);

  const actualLast60 = data?.actual_points?.slice(-CHART_ACTUAL_DAYS) ?? [];
  const backtestPoints = data?.backtest_points ?? [];
  const backtestChartData = backtestPoints.map((p) => ({
    date: p.date,
    dateLabel: formatShortDate(p.date),
    actual: p.actual_units,
    predicted: p.predicted_units,
  }));
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
              Lead time:
              <select
                value={leadTimeDays}
                onChange={(e) => setLeadTimeDays(Number(e.target.value))}
                style={{ padding: 6 }}
              >
                {LEAD_TIME_OPTIONS.map((d) => (
                  <option key={d} value={d}>
                    {d} days
                  </option>
                ))}
              </select>
            </label>
            <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
              Service level:
              <select
                value={serviceLevel}
                onChange={(e) => setServiceLevel(Number(e.target.value))}
                style={{ padding: 6 }}
              >
                {SERVICE_LEVEL_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s === 0 ? "0" : s}
                  </option>
                ))}
              </select>
            </label>
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
            <strong>Data end date:</strong> {data.data_end_date} &nbsp;| <strong>Model:</strong> {data.model_name} &nbsp;|{" "}
            <strong>MAE (30d):</strong> {data.mae_30d.toFixed(4)} &nbsp;| <strong>MAPE (30d):</strong> {(data.mape_30d * 100).toFixed(2)}%
          </p>
          {backtestChartData.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <h3 style={{ fontSize: 14, marginBottom: 8 }}>Backtest (last 30 days: actual vs predicted)</h3>
              <div style={{ width: "100%", height: 220 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={backtestChartData} margin={{ top: 8, right: 24, left: 8, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="dateLabel" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip labelFormatter={(_, payload) => payload?.[0]?.payload?.date ? formatShortDate(payload[0].payload.date) : ""} />
                    <Legend />
                    <Line type="monotone" dataKey="actual" name="Actual" stroke="#2563eb" dot={false} connectNulls />
                    <Line type="monotone" dataKey="predicted" name="Predicted" stroke="#dc2626" strokeDasharray="4 4" dot={false} connectNulls />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
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
          {mode === "sku" && restockPlan && (
            <div style={{ marginTop: 24, padding: 16, border: "1px solid #ccc", borderRadius: 8, maxWidth: 420 }}>
              <h3 style={{ marginTop: 0, marginBottom: 12 }}>Restock Plan</h3>
              <p style={{ margin: "4px 0" }}>
                <strong>Forecast units during lead time:</strong> {restockPlan.forecast_units_lead_time.toFixed(2)}
              </p>
              <p style={{ margin: "4px 0" }}>
                <strong>Safety stock units:</strong> {restockPlan.safety_stock_units.toFixed(2)}
              </p>
              <p style={{ margin: "4px 0" }}>
                <strong>Recommended reorder qty:</strong> {restockPlan.recommended_reorder_qty}
              </p>
              <p style={{ margin: "4px 0", fontSize: 12, color: "#666" }}>
                Lead time: {restockPlan.lead_time_days} days · Service level: {restockPlan.service_level}
              </p>
            </div>
          )}
        </>
      )}

      {mode === "sku" && !effectiveSku && !loading && (
        <p style={{ color: "#666" }}>Select a SKU from the dropdown or enter one manually to see the forecast.</p>
      )}
    </section>
  );
}
