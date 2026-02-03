import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  LineChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Legend,
  ComposedChart,
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
import { useAuth } from "./context/AuthContext";
import {
  getDemoForecastTotal,
  getDemoForecastSku,
  getDemoForecastTopSkus,
  getDemoForecastRestockPlan,
} from "./data/demoData";
import ChartContainer from "./components/ui/ChartContainer";
import EmptyState from "./components/ui/EmptyState";
import LoadingSkeleton from "./components/ui/LoadingSkeleton";
import Card from "./components/ui/Card";
import Tooltip from "./components/ui/Tooltip";
import ForecastQualityBadge from "./components/insights/ForecastQualityBadge";
import ForecastSummaryCard from "./components/forecast/ForecastSummaryCard";
import ForecastTable, { type ForecastTableRow } from "./components/forecast/ForecastTable";
import { formatShortDate, formatPercent, formatDecimal } from "./utils/format";
import {
  getPref,
  PREF_KEYS,
  DEFAULT_FORECAST_HORIZON_DEFAULT,
  DEFAULT_MARKETPLACE_DEFAULT,
} from "./utils/preferences";
import { isDemoMode } from "./utils/preferences";

const MARKETPLACE_OPTIONS = ["ALL", "US", "UK", "DE"] as const;
const HORIZON_OPTIONS = [14, 30, 60] as const;
const LEAD_TIME_OPTIONS = [7, 14, 30] as const;
const SERVICE_LEVEL_OPTIONS = [0, 0.1, 0.2] as const;
const CHART_ACTUAL_DAYS = 60;

type Props = {
  token: string;
};

const MAE_DESC =
  "Mean Absolute Error: average difference between predicted and actual units over the last 30 days. Lower is better.";
const MAPE_DESC =
  "Mean Absolute Percentage Error: average percentage difference between predicted and actual units. Lower is better.";

export default function Forecast({ token }: Props) {
  const [mode, setMode] = useState<"total" | "sku">("total");
  const [marketplace, setMarketplace] = useState<string>(() =>
    String(getPref(PREF_KEYS.DEFAULT_MARKETPLACE, DEFAULT_MARKETPLACE_DEFAULT))
  );
  const [horizonDays, setHorizonDays] = useState<number>(() => {
    const h = Number(
      getPref(PREF_KEYS.DEFAULT_FORECAST_HORIZON, DEFAULT_FORECAST_HORIZON_DEFAULT)
    );
    return HORIZON_OPTIONS.includes(h as (typeof HORIZON_OPTIONS)[number])
      ? h
      : DEFAULT_FORECAST_HORIZON_DEFAULT;
  });
  const [skuSelect, setSkuSelect] = useState<string>("");
  const [skuManual, setSkuManual] = useState<string>("");
  const [data, setData] = useState<ForecastResponse | null>(null);
  const [topSkus, setTopSkus] = useState<ForecastTopSkuRow[]>([]);
  const [restockPlan, setRestockPlan] = useState<ForecastRestockPlanResponse | null>(null);
  const [leadTimeDays, setLeadTimeDays] = useState<number>(14);
  const [serviceLevel, setServiceLevel] = useState<number>(0.1);
  const [includeUnmapped, setIncludeUnmapped] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showCharts, setShowCharts] = useState(false);
  const { user } = useAuth();
  const isOwner = user?.role === "owner";

  const effectiveSku = mode === "sku" ? (skuSelect || skuManual).trim() : "";

  const loadForecast = () => {
    if (!token && !isDemoMode()) return;
    if (mode === "sku" && !effectiveSku && !isDemoMode()) {
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
      include_unmapped: mode === "sku" ? includeUnmapped : undefined,
    };
    if (isDemoMode()) {
      const demoData =
        mode === "total"
          ? getDemoForecastTotal(params)
          : getDemoForecastSku({ ...params, sku: effectiveSku || "DEMO-SKU-001" });
      setData(demoData);
      setLoading(false);
      return;
    }
    const req =
      mode === "total"
        ? forecastTotal(token!, params)
        : forecastSku(token!, { ...params, sku: effectiveSku });
    req
      .then(setData)
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : "Failed to load forecast")
      )
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (isDemoMode()) {
      setTopSkus(getDemoForecastTopSkus({ days: 30, marketplace, limit: 20 }));
      return;
    }
    if (!token || mode !== "sku") return;
    setError(null);
    forecastTopSkus(token, { days: 30, marketplace, limit: 20 })
      .then(setTopSkus)
      .catch(() => setTopSkus([]));
  }, [token, mode, marketplace]);

  useEffect(() => {
    if (!token) return;
    if (mode === "sku" && !effectiveSku) {
      setData(null);
      setLoading(false);
      return;
    }
    loadForecast();
  }, [token, mode, marketplace, horizonDays, effectiveSku]);

  useEffect(() => {
    if (isDemoMode() && mode === "sku" && effectiveSku) {
      setRestockPlan(
        getDemoForecastRestockPlan({
          sku: effectiveSku,
          horizon_days: horizonDays,
          lead_time_days: leadTimeDays,
          service_level: serviceLevel,
          marketplace,
        })
      );
      return;
    }
    if (!token || mode !== "sku" || !effectiveSku) {
      setRestockPlan(null);
      return;
    }
    forecastRestockPlan(token, {
      sku: effectiveSku,
      horizon_days: horizonDays,
      lead_time_days: leadTimeDays,
      service_level: serviceLevel,
      marketplace,
      include_unmapped: includeUnmapped,
    })
      .then(setRestockPlan)
      .catch(() => setRestockPlan(null));
  }, [token, mode, effectiveSku, horizonDays, leadTimeDays, serviceLevel, marketplace, includeUnmapped]);

  const actualLast60 = data?.actual_points?.slice(-CHART_ACTUAL_DAYS) ?? [];
  const backtestPoints = data?.backtest_points ?? [];
  const backtestChartData = backtestPoints.map((p) => ({
    date: p.date,
    dateLabel: formatShortDate(p.date),
    actual: p.actual_units,
    predicted: p.predicted_units,
  }));
  const forecastPoints = data?.forecast_points ?? [];
  const confidenceBounds = data?.confidence_bounds ?? [];
  const boundsByDate = Object.fromEntries(
    confidenceBounds.map((b) => [b.date, { lower: b.lower, upper: b.upper }])
  );
  const actualByDate = Object.fromEntries(actualLast60.map((p) => [p.date, p.units]));
  const forecastByDate = Object.fromEntries(forecastPoints.map((p) => [p.date, p.units]));
  const allDates = [
    ...actualLast60.map((p) => p.date),
    ...forecastPoints.map((p) => p.date),
  ].filter((d, i, arr) => arr.indexOf(d) === i);
  allDates.sort();
  const chartData = allDates.map((date) => {
    const lower = boundsByDate[date]?.lower;
    const upper = boundsByDate[date]?.upper;
    const bandRange =
      lower != null && upper != null && upper >= lower ? upper - lower : undefined;
    return {
      date,
      dateLabel: formatShortDate(date),
      actual: actualByDate[date] ?? undefined,
      forecast: forecastByDate[date] ?? undefined,
      lower: lower ?? undefined,
      upper: upper ?? undefined,
      bandRange,
    };
  });

  if (error) {
    return (
      <Card>
        <EmptyState
          title="Something went wrong"
          description={error}
          action={
            <button
              type="button"
              onClick={loadForecast}
              style={{
                padding: "var(--space-2) var(--space-4)",
                backgroundColor: "var(--color-primary)",
                color: "white",
                border: "none",
                borderRadius: "var(--radius-md)",
                fontWeight: "var(--font-medium)",
                cursor: "pointer",
              }}
            >
              Try again
            </button>
          }
        />
      </Card>
    );
  }

  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
        <LoadingSkeleton count={4} />
        <div style={{ height: 200 }}>
          <LoadingSkeleton
            children={
              <div
                style={{
                  height: 200,
                  borderRadius: "var(--radius-md)",
                  backgroundColor: "var(--color-border)",
                  animation: "skeleton-pulse 1.5s ease-in-out infinite",
                }}
              />
            }
          />
        </div>
      </div>
    );
  }

  if (mode === "sku" && !effectiveSku) {
    return (
      <EmptyState
        title="Select a SKU"
        description="Choose a SKU from the dropdown or enter one manually to see the demand forecast and restock plan. If you have no data yet, load sample data from the Dashboard or connect your Amazon account in Settings."
      />
    );
  }

  if (mode === "total" && !data) {
    return (
      <EmptyState
        title="No forecast data"
        description="Unable to load the total forecast. Try again or adjust filters. You can also load sample data from the Dashboard to explore forecasts, or check your marketplace selection in Settings."
        action={
          <button
            type="button"
            onClick={loadForecast}
            style={{
              padding: "var(--space-2) var(--space-4)",
              backgroundColor: "var(--color-primary)",
              color: "white",
              border: "none",
              borderRadius: "var(--radius-md)",
              fontWeight: "var(--font-medium)",
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        }
      />
    );
  }

  if (!data) return null;

  const tableRows: ForecastTableRow[] = [
    {
      id: data.kind === "total" ? "total" : data.sku ?? "sku",
      name: data.kind === "total" ? "Total" : data.sku ?? "SKU",
      forecast: data,
    },
  ];

  const summaryTitle = data.kind === "total" ? "Total forecast" : `Forecast: ${data.sku ?? ""}`;

  return (
    <section style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
      {isDemoMode() && (
        <div
          style={{
            padding: "var(--space-2) var(--space-4)",
            backgroundColor: "var(--color-warning-muted)",
            color: "var(--color-warning)",
            borderRadius: "var(--radius-md)",
            fontSize: "var(--text-sm)",
            fontWeight: "var(--font-medium)",
          }}
        >
          Demo data — sample forecast for exploration. Clear in Settings to use real data.
        </div>
      )}

      {data.drift?.flag && (
        <div
          style={{
            padding: "var(--space-3) var(--space-4)",
            backgroundColor: "var(--color-warning-muted)",
            color: "var(--color-warning)",
            borderRadius: "var(--radius-md)",
            fontSize: "var(--text-sm)",
            border: "1px solid var(--color-warning)",
          }}
          role="alert"
        >
          <strong>Forecast drift detected</strong> in the last {data.drift.window_days} days. MAE:{" "}
          {formatDecimal(data.drift.mae, 2)} · MAPE: {formatPercent(data.drift.mape)} (threshold:{" "}
          {formatPercent(data.drift.threshold)}). Consider reviewing recent demand or overrides.
        </div>
      )}
      {data.warnings && data.warnings.length > 0 && (
        <div
          style={{
            padding: "var(--space-3) var(--space-4)",
            backgroundColor: "var(--color-warning-muted)",
            color: "var(--color-warning)",
            borderRadius: "var(--radius-md)",
            fontSize: "var(--text-sm)",
          }}
          role="alert"
        >
          <strong>Data health:</strong>{" "}
          {data.warnings.join(" ")}
          {data.unmapped_share_30d != null && data.unmapped_share_30d > 0 && (
            <span> Unmapped share: {(data.unmapped_share_30d * 100).toFixed(1)}%.</span>
          )}
        </div>
      )}

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "var(--space-4)",
          alignItems: "center",
        }}
      >
        <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "center" }}>
          <span style={{ fontSize: "var(--text-sm)", color: "var(--color-text-muted)" }}>
            Mode:
          </span>
          <button
            onClick={() => setMode("total")}
            style={{
              padding: "var(--space-2) var(--space-3)",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-md)",
              backgroundColor: mode === "total" ? "var(--color-bg-muted)" : "transparent",
              fontWeight: mode === "total" ? "var(--font-medium)" : "var(--font-normal)",
              fontSize: "var(--text-sm)",
            }}
          >
            Total
          </button>
          <button
            onClick={() => setMode("sku")}
            style={{
              padding: "var(--space-2) var(--space-3)",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-md)",
              backgroundColor: mode === "sku" ? "var(--color-bg-muted)" : "transparent",
              fontWeight: mode === "sku" ? "var(--font-medium)" : "var(--font-normal)",
              fontSize: "var(--text-sm)",
            }}
          >
            SKU
          </button>
        </div>

        <label
          style={{
            display: "flex",
            gap: "var(--space-2)",
            alignItems: "center",
            fontSize: "var(--text-sm)",
          }}
        >
          Marketplace
          <select
            value={marketplace}
            onChange={(e) => setMarketplace(e.target.value)}
            style={{
              padding: "var(--space-2) var(--space-3)",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-md)",
              backgroundColor: "var(--color-bg-elevated)",
              fontSize: "var(--text-sm)",
            }}
          >
            {MARKETPLACE_OPTIONS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>

        <label
          style={{
            display: "flex",
            gap: "var(--space-2)",
            alignItems: "center",
            fontSize: "var(--text-sm)",
          }}
        >
          Horizon
          <select
            value={horizonDays}
            onChange={(e) => setHorizonDays(Number(e.target.value))}
            style={{
              padding: "var(--space-2) var(--space-3)",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-md)",
              backgroundColor: "var(--color-bg-elevated)",
              fontSize: "var(--text-sm)",
            }}
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
            <label
              style={{
                display: "flex",
                gap: "var(--space-2)",
                alignItems: "center",
                fontSize: "var(--text-sm)",
              }}
            >
              Lead time
              <select
                value={leadTimeDays}
                onChange={(e) => setLeadTimeDays(Number(e.target.value))}
                style={{
                  padding: "var(--space-2) var(--space-3)",
                  border: "1px solid var(--color-border)",
                  borderRadius: "var(--radius-md)",
                  backgroundColor: "var(--color-bg-elevated)",
                  fontSize: "var(--text-sm)",
                }}
              >
                {LEAD_TIME_OPTIONS.map((d) => (
                  <option key={d} value={d}>
                    {d} days
                  </option>
                ))}
              </select>
            </label>
            <label
              style={{
                display: "flex",
                gap: "var(--space-2)",
                alignItems: "center",
                fontSize: "var(--text-sm)",
              }}
            >
              Service level
              <select
                value={serviceLevel}
                onChange={(e) => setServiceLevel(Number(e.target.value))}
                style={{
                  padding: "var(--space-2) var(--space-3)",
                  border: "1px solid var(--color-border)",
                  borderRadius: "var(--radius-md)",
                  backgroundColor: "var(--color-bg-elevated)",
                  fontSize: "var(--text-sm)",
                }}
              >
                {SERVICE_LEVEL_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s === 0 ? "0" : s}
                  </option>
                ))}
              </select>
            </label>
            {mode === "sku" && (
              <label
                style={{
                  display: "flex",
                  gap: "var(--space-2)",
                  alignItems: "center",
                  fontSize: "var(--text-sm)",
                }}
              >
                <input
                  type="checkbox"
                  checked={includeUnmapped}
                  onChange={(e) => setIncludeUnmapped(e.target.checked)}
                  style={{ margin: 0 }}
                />
                Include unmapped demand
              </label>
            )}
            <label
              style={{
                display: "flex",
                gap: "var(--space-2)",
                alignItems: "center",
                fontSize: "var(--text-sm)",
              }}
            >
              SKU
              <select
                value={skuSelect}
                onChange={(e) => setSkuSelect(e.target.value)}
                style={{
                  padding: "var(--space-2) var(--space-3)",
                  minWidth: 160,
                  border: "1px solid var(--color-border)",
                  borderRadius: "var(--radius-md)",
                  backgroundColor: "var(--color-bg-elevated)",
                  fontSize: "var(--text-sm)",
                }}
              >
                <option value="">— Select —</option>
                {topSkus.map((r) => (
                  <option key={r.sku} value={r.sku}>
                    {r.sku} ({r.title.slice(0, 30)}…)
                  </option>
                ))}
              </select>
            </label>
            <label
              style={{
                display: "flex",
                gap: "var(--space-2)",
                alignItems: "center",
                fontSize: "var(--text-sm)",
              }}
            >
              Or enter SKU
              <input
                type="text"
                value={skuManual}
                onChange={(e) => setSkuManual(e.target.value)}
                placeholder="e.g. SKU-0001"
                style={{
                  padding: "var(--space-2) var(--space-3)",
                  width: 120,
                  border: "1px solid var(--color-border)",
                  borderRadius: "var(--radius-md)",
                  fontSize: "var(--text-sm)",
                }}
              />
            </label>
          </>
        )}
      </div>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: "var(--space-4)",
          fontSize: "var(--text-sm)",
          color: "var(--color-text-muted)",
        }}
      >
        <span>
          <strong style={{ color: "var(--color-text)" }}>Data through:</strong>{" "}
          {data.data_end_date}
        </span>
        <span>
          <strong style={{ color: "var(--color-text)" }}>Model:</strong> {data.model_name}
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
          <strong style={{ color: "var(--color-text)" }}>Forecast quality:</strong>
          <ForecastQualityBadge
            mape_30d={data.mape_30d}
            mae_30d={data.mae_30d}
            backtest_points_count={data.backtest_points?.length}
          />
        </span>
        <Tooltip content={MAE_DESC}>
          <span
            style={{
              cursor: "help",
              borderBottom: "1px dotted var(--color-text-muted)",
            }}
          >
            <strong style={{ color: "var(--color-text)" }}>MAE (30d):</strong>{" "}
            {formatDecimal(data.mae_30d, 4)}
          </span>
        </Tooltip>
        <Tooltip content={MAPE_DESC}>
          <span
            style={{
              cursor: "help",
              borderBottom: "1px dotted var(--color-text-muted)",
            }}
          >
            <strong style={{ color: "var(--color-text)" }}>MAPE (30d):</strong>{" "}
            {formatPercent(data.mape_30d)}
          </span>
        </Tooltip>
      </div>

      <ForecastSummaryCard
        title={summaryTitle}
        intelligence={data.intelligence}
        horizonDays={data.horizon_days}
        recommendation={data.recommendation}
        reasoning={data.reasoning}
      />

      <Card>
        <div style={{ padding: "var(--space-4)" }}>
          <h3
            style={{
              margin: "0 0 var(--space-4)",
              fontSize: "var(--text-lg)",
              fontWeight: "var(--font-semibold)",
              color: "var(--color-text)",
            }}
          >
            Forecast summary
          </h3>
          <ForecastTable rows={tableRows} />
        </div>
      </Card>

      <div>
        <button
          type="button"
          onClick={() => setShowCharts(!showCharts)}
          style={{
            padding: "var(--space-2) var(--space-4)",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-md)",
            backgroundColor: showCharts ? "var(--color-bg-muted)" : "transparent",
            fontSize: "var(--text-sm)",
            fontWeight: "var(--font-medium)",
            cursor: "pointer",
            color: "var(--color-text)",
          }}
        >
          {showCharts ? "Hide chart" : "Show chart (optional)"}
        </button>

        {showCharts && (
          <div style={{ marginTop: "var(--space-6)", display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
            {backtestChartData.length > 0 && (
              <ChartContainer
                title="Details — Backtest (last 30 days)"
                subtitle="Actual vs predicted units"
                dataThroughDate={data.data_end_date}
              >
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart
                    data={backtestChartData}
                    margin={{ top: 8, right: 24, left: 8, bottom: 8 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                    <XAxis
                      dataKey="dateLabel"
                      tick={{ fontSize: 10 }}
                      stroke="var(--color-text-muted)"
                    />
                    <YAxis
                      tick={{ fontSize: 10 }}
                      stroke="var(--color-text-muted)"
                      tickFormatter={(v) => formatDecimal(Number(v), 0)}
                    />
                    <RechartsTooltip
                      formatter={(value: number) => [formatDecimal(value, 0), "Units"]}
                      labelFormatter={(_, payload) =>
                        payload?.[0]?.payload?.date
                          ? formatShortDate(payload[0].payload.date)
                          : ""
                      }
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="actual"
                      name="Actual"
                      stroke="var(--color-accent)"
                      dot={false}
                      connectNulls
                    />
                    <Line
                      type="monotone"
                      dataKey="predicted"
                      name="Predicted"
                      stroke="var(--color-error)"
                      strokeDasharray="4 4"
                      dot={false}
                      connectNulls
                    />
                  </LineChart>
                </ResponsiveContainer>
              </ChartContainer>
            )}

            <ChartContainer
              title="Details — Forecast"
              subtitle="Actual and forecasted units with confidence band"
              dataThroughDate={data.data_end_date}
            >
              <ResponsiveContainer width="100%" height={360}>
                <ComposedChart data={chartData} margin={{ top: 8, right: 24, left: 8, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis
                    dataKey="dateLabel"
                    tick={{ fontSize: 11 }}
                    stroke="var(--color-text-muted)"
                  />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    stroke="var(--color-text-muted)"
                    tickFormatter={(v) => formatDecimal(Number(v), 0)}
                  />
                  <RechartsTooltip
                    formatter={(value: number) => [
                      value != null ? formatDecimal(Number(value), 0) : "—",
                      "Units",
                    ]}
                    labelFormatter={(_, payload) =>
                      payload?.[0]?.payload?.date
                        ? formatShortDate(payload[0].payload.date)
                        : ""
                    }
                  />
                  <Legend />
                  {confidenceBounds.length > 0 && (
                    <>
                      <Area
                        type="monotone"
                        dataKey="lower"
                        stackId="band"
                        fill="transparent"
                        stroke="none"
                      />
                      <Area
                        type="monotone"
                        dataKey="bandRange"
                        stackId="band"
                        fill="var(--color-primary-muted)"
                        fillOpacity={0.25}
                        stroke="none"
                      />
                    </>
                  )}
                  <Line
                    type="monotone"
                    dataKey="actual"
                    name="Actual (units)"
                    stroke="var(--color-accent)"
                    dot={false}
                    connectNulls
                  />
                  <Line
                    type="monotone"
                    dataKey="forecast"
                    name="Forecast (units)"
                    stroke="var(--color-error)"
                    strokeDasharray="4 4"
                    dot={false}
                    connectNulls
                  />
                  {confidenceBounds.length > 0 && (
                    <>
                      <Line
                        type="monotone"
                        dataKey="lower"
                        name="Lower bound"
                        stroke="var(--color-text-muted)"
                        strokeDasharray="2 2"
                        dot={false}
                        connectNulls
                      />
                      <Line
                        type="monotone"
                        dataKey="upper"
                        name="Upper bound"
                        stroke="var(--color-text-muted)"
                        strokeDasharray="2 2"
                        dot={false}
                        connectNulls
                      />
                    </>
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            </ChartContainer>
          </div>
        )}
      </div>

      {mode === "sku" && restockPlan && (
        <Card>
          <div style={{ padding: "var(--space-6)" }}>
            {restockPlan.data_quality && (() => {
              const dq = restockPlan.data_quality;
              const severity = dq.severity ?? "ok";
              const isCritical = severity === "critical";
              const isWarning = severity === "warning";
              const bg = isCritical ? "var(--color-error-muted, #fef2f2)" : isWarning ? "var(--color-warning-muted)" : "var(--color-bg-muted)";
              const color = isCritical ? "var(--color-error, #b91c1c)" : isWarning ? "var(--color-warning)" : "var(--color-text-muted)";
              const label = severity === "critical" ? "Critical" : severity === "warning" ? "Warning" : "OK";
              return (
                <div
                  style={{
                    marginBottom: "var(--space-4)",
                    padding: "var(--space-3) var(--space-4)",
                    backgroundColor: bg,
                    color,
                    borderRadius: "var(--radius-md)",
                    fontSize: "var(--text-sm)",
                    border: isCritical ? "1px solid var(--color-error, #b91c1c)" : undefined,
                  }}
                  role="alert"
                >
                  <strong>Data quality ({label}):</strong>{" "}
                  {dq.warnings && dq.warnings.length > 0 ? dq.warnings.join(" ") : "No issues."}
                  {(dq.excluded_units > 0 || (dq.unmapped_share_30d ?? 0) > 0) && (
                    <span>
                      {" "}
                      Excluded units: {dq.excluded_units}; unmapped share (30d):{" "}
                      {((dq.unmapped_share_30d ?? 0) * 100).toFixed(1)}%.
                    </span>
                  )}
                  {isCritical && (
                    <p style={{ margin: "var(--space-2) 0 0", fontWeight: "var(--font-medium)" }}>
                      Fix mappings in Admin → Catalog Mapping to improve restock accuracy.
                    </p>
                  )}
                  {isOwner && (dq.warnings?.length ?? 0) > 0 && (
                    <span style={{ display: "block", marginTop: "var(--space-2)" }}>
                      <Link
                        to="/admin/catalog-mapping"
                        style={{ color: "var(--color-primary)", fontWeight: "var(--font-medium)" }}
                      >
                        Fix mappings
                      </Link>
                    </span>
                  )}
                </div>
              );
            })()}
            <h3
              style={{
                margin: "0 0 var(--space-4)",
                fontSize: "var(--text-lg)",
                fontWeight: "var(--font-semibold)",
                color: "var(--color-text)",
              }}
            >
              Restock plan
            </h3>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "var(--space-2)",
                fontSize: "var(--text-sm)",
              }}
            >
              <p style={{ margin: 0 }}>
                <strong>Forecast units during lead time:</strong>{" "}
                {formatDecimal(restockPlan.forecast_units_lead_time, 2)}
              </p>
              <p style={{ margin: 0 }}>
                <strong>Safety stock units:</strong>{" "}
                {formatDecimal(restockPlan.safety_stock_units, 2)}
              </p>
              <p style={{ margin: 0 }}>
                <strong>Recommended reorder qty:</strong>{" "}
                {formatDecimal(restockPlan.recommended_reorder_qty, 0)}
              </p>
              <p style={{ margin: 0, color: "var(--color-text-muted)" }}>
                Lead time: {restockPlan.lead_time_days} days · Service level:{" "}
                {restockPlan.service_level}
              </p>
            </div>
          </div>
        </Card>
      )}

      <details
        style={{
          fontSize: "var(--text-sm)",
          color: "var(--color-text-muted)",
          padding: "var(--space-3) var(--space-4)",
          backgroundColor: "var(--color-bg-muted)",
          borderRadius: "var(--radius-md)",
          border: "1px solid var(--color-border)",
        }}
      >
        <summary
          style={{
            cursor: "pointer",
            fontWeight: "var(--font-medium)",
            color: "var(--color-text)",
          }}
        >
          How to interpret this
        </summary>
        <p style={{ margin: "var(--space-3) 0 0 0", lineHeight: 1.5 }}>
          MAE (Mean Absolute Error) is the average difference between predicted and actual
          units—lower is better. MAPE (Mean Absolute Percentage Error) is that difference as
          a percentage—also lower is better. The forecast quality badge summarizes how
          accurate the model has been recently. Forecasts are estimates; use the quality
          badge as guidance.
        </p>
      </details>
    </section>
  );
}
