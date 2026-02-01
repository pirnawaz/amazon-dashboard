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
  type TopProductRow,
} from "./api";
import Card from "./components/ui/Card";
import Metric from "./components/ui/Metric";
import Table from "./components/ui/Table";
import ChartContainer from "./components/ui/ChartContainer";
import EmptyState from "./components/ui/EmptyState";
import LoadingSkeleton from "./components/ui/LoadingSkeleton";
import { formatCurrency, formatShortDate, formatInteger } from "./utils/format";
import { rolling7dComparison } from "./utils/insights";

const DAYS_OPTIONS = [7, 30, 90] as const;
const MARKETPLACE_OPTIONS = ["ALL", "US", "UK", "DE"] as const;

type Props = {
  token: string;
};

const TOP_PRODUCTS_COLUMNS = [
  { key: "sku" as const, header: "SKU" },
  { key: "title" as const, header: "Title", render: (r: TopProductRow) => r.title ?? "—" },
  { key: "revenue" as const, header: "Revenue", align: "right" as const, render: (r: TopProductRow) => formatCurrency(r.revenue) },
  { key: "units" as const, header: "Units", align: "right" as const, render: (r: TopProductRow) => formatInteger(r.units) },
  { key: "orders" as const, header: "Orders", align: "right" as const, render: (r: TopProductRow) => formatInteger(r.orders) },
];

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

  const insight7d = timeseriesData?.points?.length
    ? rolling7dComparison(
        timeseriesData.points.map((p) => ({ date: p.date, units: p.units, revenue: p.revenue }))
      )
    : null;

  if (error) {
    return (
      <Card>
        <EmptyState
          title="Something went wrong"
          description={error}
          action={
            <button
              type="button"
              onClick={() => {
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
              }}
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
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
            gap: "var(--space-4)",
          }}
        >
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} style={{ padding: "var(--space-4)" }}>
              <LoadingSkeleton count={3} />
            </div>
          ))}
        </div>
        <Card>
          <div style={{ padding: "var(--space-6)" }}>
            <div
              style={{
                height: 280,
                borderRadius: "var(--radius-md)",
                backgroundColor: "var(--color-border)",
                animation: "skeleton-pulse 1.5s ease-in-out infinite",
              }}
            />
          </div>
        </Card>
      </div>
    );
  }

  if (summary === null) {
    return (
      <EmptyState
        title="No dashboard data"
        description="Unable to load dashboard summary. Please try again later."
      />
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
      {/* Filters */}
      <div
        style={{
          display: "flex",
          gap: "var(--space-4)",
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--space-2)",
            fontSize: "var(--text-sm)",
          }}
        >
          Days
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            style={{
              padding: "var(--space-2) var(--space-3)",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-md)",
              backgroundColor: "var(--color-bg-elevated)",
              fontSize: "var(--text-sm)",
            }}
          >
            {DAYS_OPTIONS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </label>
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--space-2)",
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
      </div>

      {/* Metrics */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
          gap: "var(--space-4)",
        }}
      >
        <Metric label="Revenue" value={formatCurrency(summary.revenue)} />
        <Metric label="Units" value={formatInteger(summary.units)} />
        <Metric label="Orders" value={formatInteger(summary.orders)} />
        <Metric label="Ad Spend" value={formatCurrency(summary.ad_spend)} />
        <Metric
          label="Net Profit (placeholder)"
          value={formatCurrency(summary.net_profit_placeholder)}
        />
      </div>

      {/* What changed? — last 7 days vs previous 7 */}
      {insight7d != null && (
        <Card>
          <div style={{ padding: "var(--space-4) var(--space-6)" }}>
            <h3
              style={{
                margin: "0 0 var(--space-4)",
                fontSize: "var(--text-lg)",
                fontWeight: "var(--font-semibold)",
                color: "var(--color-text)",
              }}
            >
              What changed?
            </h3>
            <p style={{ margin: "0 0 var(--space-4)", fontSize: "var(--text-sm)", color: "var(--color-text-muted)" }}>
              Last 7 days vs previous 7 days
            </p>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
                gap: "var(--space-4)",
              }}
            >
              <Metric
                label="Units (last 7d)"
                value={formatInteger(insight7d.last7Units)}
                delta={
                  insight7d.unitsPctChange != null
                    ? {
                        value: `${insight7d.unitsPctChange >= 0 ? "+" : ""}${insight7d.unitsPctChange.toFixed(1)}%`,
                        trend: insight7d.unitsPctChange > 0 ? "up" : insight7d.unitsPctChange < 0 ? "down" : "neutral",
                      }
                    : undefined
                }
              />
              <Metric
                label="Revenue (last 7d)"
                value={formatCurrency(insight7d.last7Revenue)}
                delta={
                  insight7d.revenuePctChange != null
                    ? {
                        value: `${insight7d.revenuePctChange >= 0 ? "+" : ""}${insight7d.revenuePctChange.toFixed(1)}%`,
                        trend: insight7d.revenuePctChange > 0 ? "up" : insight7d.revenuePctChange < 0 ? "down" : "neutral",
                      }
                    : undefined
                }
              />
            </div>
          </div>
        </Card>
      )}

      {/* Charts */}
      {chartData.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
          <ChartContainer
            title="Revenue over time"
            dataThroughDate={
              timeseriesData?.points?.length
                ? timeseriesData.points[timeseriesData.points.length - 1].date
                : undefined
            }
          >
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="dateLabel" tick={{ fontSize: 12 }} stroke="var(--color-text-muted)" />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `$${v}`} stroke="var(--color-text-muted)" />
                <Tooltip
                  formatter={(value: number) => [formatCurrency(value), "Revenue"]}
                  labelFormatter={(_, payload) =>
                    payload?.[0]?.payload?.date ? formatShortDate(payload[0].payload.date) : ""
                  }
                />
                <Line
                  type="monotone"
                  dataKey="revenue"
                  stroke="var(--color-accent)"
                  strokeWidth={2}
                  dot={false}
                  name="Revenue"
                />
              </LineChart>
            </ResponsiveContainer>
          </ChartContainer>

          <ChartContainer
            title="Units over time"
            dataThroughDate={
              timeseriesData?.points?.length
                ? timeseriesData.points[timeseriesData.points.length - 1].date
                : undefined
            }
          >
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="dateLabel" tick={{ fontSize: 12 }} stroke="var(--color-text-muted)" />
                <YAxis tick={{ fontSize: 12 }} stroke="var(--color-text-muted)" />
                <Tooltip
                  formatter={(value: number) => [formatInteger(Number(value)), "Units"]}
                  labelFormatter={(_, payload) =>
                    payload?.[0]?.payload?.date ? formatShortDate(payload[0].payload.date) : ""
                  }
                />
                <Line
                  type="monotone"
                  dataKey="units"
                  stroke="var(--color-success)"
                  strokeWidth={2}
                  dot={false}
                  name="Units"
                />
              </LineChart>
            </ResponsiveContainer>
          </ChartContainer>

          <ChartContainer
            title="Ad Spend over time"
            dataThroughDate={
              timeseriesData?.points?.length
                ? timeseriesData.points[timeseriesData.points.length - 1].date
                : undefined
            }
          >
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="dateLabel" tick={{ fontSize: 12 }} stroke="var(--color-text-muted)" />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `$${v}`} stroke="var(--color-text-muted)" />
                <Tooltip
                  formatter={(value: number) => [formatCurrency(value), "Ad Spend"]}
                  labelFormatter={(_, payload) =>
                    payload?.[0]?.payload?.date ? formatShortDate(payload[0].payload.date) : ""
                  }
                />
                <Line
                  type="monotone"
                  dataKey="ad_spend"
                  stroke="var(--color-error)"
                  strokeWidth={2}
                  dot={false}
                  name="Ad Spend"
                />
              </LineChart>
            </ResponsiveContainer>
          </ChartContainer>
        </div>
      ) : (
        <ChartContainer title="Charts">
          <EmptyState
            title="No time series data"
            description="No chart data available for the selected period and marketplace."
          />
        </ChartContainer>
      )}

      {/* Top Products Table */}
      <Card>
        <div style={{ padding: "var(--space-4) var(--space-6)", borderBottom: "1px solid var(--color-border)" }}>
          <h3
            style={{
              margin: 0,
              fontSize: "var(--text-lg)",
              fontWeight: "var(--font-semibold)",
              color: "var(--color-text)",
            }}
          >
            Top Products
          </h3>
        </div>
        <Table
          columns={TOP_PRODUCTS_COLUMNS}
          data={topProductsData?.products ?? []}
          getRowKey={(r) => r.sku}
          emptyTitle="No top products"
          emptyDescription="No top products for the selected period."
          stickyHeader
        />
      </Card>
    </div>
  );
}
