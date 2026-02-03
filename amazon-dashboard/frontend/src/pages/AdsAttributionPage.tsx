import { useCallback, useEffect, useState } from "react";
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
  getSkuProfitability,
  getSkuProfitabilityTimeseries,
  type SkuProfitabilityResponse,
  type SkuProfitabilityRow,
  type SkuTimeseriesResponse,
} from "../api";
import {
  getDemoSkuProfitability,
  getDemoSkuProfitabilityTimeseries,
} from "../data/demoData";
import Card from "../components/ui/Card";
import EmptyState from "../components/ui/EmptyState";
import LoadingSkeleton from "../components/ui/LoadingSkeleton";
import Table from "../components/ui/Table";
import ChartContainer from "../components/ui/ChartContainer";
import { useAuth } from "../context/AuthContext";
import { isDemoMode } from "../utils/preferences";
import { formatCurrency, formatPercent, formatInteger, formatShortDate } from "../utils/format";

const DAYS_OPTIONS = [7, 30, 90] as const;
const MARKETPLACE_OPTIONS = ["ALL", "US", "UK", "DE"] as const;

type SortKey = keyof SkuProfitabilityRow;
type SortDir = "asc" | "desc";

function WarningBadge({ flags }: { flags: string[] }) {
  if (!flags || flags.length === 0) return null;
  const labels: Record<string, string> = {
    missing_cogs: "Missing COGS",
    missing_attribution: "Missing Attribution",
    missing_mapping: "Missing Mapping",
  };
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-1)" }}>
      {flags.map((f) => (
        <span
          key={f}
          style={{
            padding: "2px 6px",
            fontSize: "var(--text-xs)",
            backgroundColor: "var(--color-warning-muted)",
            color: "var(--color-warning)",
            borderRadius: "var(--radius-sm)",
          }}
        >
          {labels[f] || f}
        </span>
      ))}
    </div>
  );
}

export default function AdsAttributionPage() {
  const { token } = useAuth();
  const [days, setDays] = useState<number>(30);
  const [marketplace, setMarketplace] = useState<string>("ALL");
  const [data, setData] = useState<SkuProfitabilityResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Sorting
  const [sortKey, setSortKey] = useState<SortKey>("revenue");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  // Drilldown
  const [selectedSku, setSelectedSku] = useState<string | null>(null);
  const [timeseriesData, setTimeseriesData] = useState<SkuTimeseriesResponse | null>(null);
  const [timeseriesLoading, setTimeseriesLoading] = useState(false);

  const demoMode = isDemoMode();

  const loadData = useCallback(async () => {
    if (!token && !demoMode) return;
    setLoading(true);
    setError(null);
    try {
      if (demoMode) {
        const res = getDemoSkuProfitability({ days, marketplace });
        setData(res);
      } else if (token) {
        const res = await getSkuProfitability(token, { days, marketplace });
        setData(res);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load profitability data");
    } finally {
      setLoading(false);
    }
  }, [token, days, marketplace, demoMode]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const loadTimeseries = useCallback(
    async (sku: string) => {
      if (!token && !demoMode) return;
      setTimeseriesLoading(true);
      try {
        if (demoMode) {
          const res = getDemoSkuProfitabilityTimeseries({ sku, days, marketplace });
          setTimeseriesData(res);
        } else if (token) {
          const res = await getSkuProfitabilityTimeseries(token, { sku, days, marketplace });
          setTimeseriesData(res);
        }
      } catch (err) {
        console.error("Failed to load timeseries:", err);
        setTimeseriesData(null);
      } finally {
        setTimeseriesLoading(false);
      }
    },
    [token, days, marketplace, demoMode]
  );

  useEffect(() => {
    if (selectedSku) {
      loadTimeseries(selectedSku);
    } else {
      setTimeseriesData(null);
    }
  }, [selectedSku, loadTimeseries]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const sortedItems = [...(data?.items || [])].sort((a, b) => {
    const aVal = a[sortKey];
    const bVal = b[sortKey];
    if (aVal == null && bVal == null) return 0;
    if (aVal == null) return 1;
    if (bVal == null) return -1;
    if (typeof aVal === "number" && typeof bVal === "number") {
      return sortDir === "asc" ? aVal - bVal : bVal - aVal;
    }
    const aStr = String(aVal);
    const bStr = String(bVal);
    return sortDir === "asc" ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr);
  });

  const columns = [
    {
      key: "sku" as const,
      header: "SKU",
      sortable: true,
      render: (r: SkuProfitabilityRow) => (
        <button
          type="button"
          onClick={() => setSelectedSku(r.sku === selectedSku ? null : r.sku)}
          style={{
            background: "none",
            border: "none",
            color: "var(--color-primary)",
            cursor: "pointer",
            textDecoration: "underline",
            padding: 0,
            font: "inherit",
          }}
        >
          {r.sku}
        </button>
      ),
    },
    {
      key: "marketplace_code" as const,
      header: "Marketplace",
      sortable: true,
    },
    {
      key: "revenue" as const,
      header: "Revenue",
      align: "right" as const,
      sortable: true,
      render: (r: SkuProfitabilityRow) => formatCurrency(r.revenue),
    },
    {
      key: "ad_spend" as const,
      header: "Ad Spend",
      align: "right" as const,
      sortable: true,
      render: (r: SkuProfitabilityRow) =>
        r.ad_spend != null ? formatCurrency(r.ad_spend) : "—",
    },
    {
      key: "attributed_sales" as const,
      header: "Attr. Sales",
      align: "right" as const,
      sortable: true,
      render: (r: SkuProfitabilityRow) =>
        r.attributed_sales != null ? formatCurrency(r.attributed_sales) : "—",
    },
    {
      key: "units_sold" as const,
      header: "Units",
      align: "right" as const,
      sortable: true,
      render: (r: SkuProfitabilityRow) => formatInteger(r.units_sold),
    },
    {
      key: "total_cogs" as const,
      header: "COGS",
      align: "right" as const,
      sortable: true,
      render: (r: SkuProfitabilityRow) =>
        r.total_cogs != null ? formatCurrency(r.total_cogs) : "—",
    },
    {
      key: "net_profit" as const,
      header: "Net Profit",
      align: "right" as const,
      sortable: true,
      render: (r: SkuProfitabilityRow) =>
        r.net_profit != null ? (
          <span
            style={{
              color:
                r.net_profit >= 0 ? "var(--color-success)" : "var(--color-error)",
            }}
          >
            {formatCurrency(r.net_profit)}
          </span>
        ) : (
          "—"
        ),
    },
    {
      key: "acos" as const,
      header: "ACOS",
      align: "right" as const,
      sortable: true,
      render: (r: SkuProfitabilityRow) =>
        r.acos != null ? formatPercent(r.acos) : "—",
    },
    {
      key: "roas" as const,
      header: "ROAS",
      align: "right" as const,
      sortable: true,
      render: (r: SkuProfitabilityRow) =>
        r.roas != null ? r.roas.toFixed(2) + "x" : "—",
    },
    {
      key: "warning_flags" as const,
      header: "Warnings",
      render: (r: SkuProfitabilityRow) => <WarningBadge flags={r.warning_flags} />,
    },
  ];

  const chartData =
    timeseriesData?.points.map((p) => ({
      date: p.date,
      dateLabel: formatShortDate(p.date),
      revenue: p.revenue,
      ad_spend: p.ad_spend ?? 0,
      attributed_sales: p.attributed_sales ?? 0,
      net_profit: p.net_profit ?? 0,
    })) ?? [];

  if (error) {
    return (
      <Card>
        <EmptyState
          title="Failed to load"
          description={error}
          action={
            <button
              type="button"
              onClick={() => loadData()}
              style={{
                padding: "var(--space-2) var(--space-4)",
                backgroundColor: "var(--color-primary)",
                color: "white",
                border: "none",
                borderRadius: "var(--radius-md)",
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
        <Card>
          <div style={{ padding: "var(--space-6)" }}>
            <LoadingSkeleton count={5} />
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
      {demoMode && (
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
          Demo data — sample profitability metrics for exploration.
        </div>
      )}

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

      {/* Profitability Table */}
      <Card>
        <div
          style={{
            padding: "var(--space-4) var(--space-6)",
            borderBottom: "1px solid var(--color-border)",
          }}
        >
          <h3
            style={{
              margin: 0,
              fontSize: "var(--text-lg)",
              fontWeight: "var(--font-semibold)",
              color: "var(--color-text)",
            }}
          >
            SKU Profitability
          </h3>
          <p
            style={{
              margin: "var(--space-2) 0 0",
              fontSize: "var(--text-sm)",
              color: "var(--color-text-muted)",
            }}
          >
            Revenue, ad spend, COGS, and net profit by SKU. Click a SKU to see the timeseries.
          </p>
        </div>
        <Table
          columns={columns}
          data={sortedItems}
          getRowKey={(r) => `${r.sku}-${r.marketplace_code}`}
          sortKey={sortKey}
          sortDir={sortDir}
          onSort={handleSort as (key: string) => void}
          emptyTitle="No profitability data"
          emptyDescription="No SKU profitability data available for the selected period. Try connecting your Amazon account or loading sample data."
          stickyHeader
        />
      </Card>

      {/* Drilldown Chart */}
      {selectedSku && (
        <Card>
          <div
            style={{
              padding: "var(--space-4) var(--space-6)",
              borderBottom: "1px solid var(--color-border)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div>
              <h3
                style={{
                  margin: 0,
                  fontSize: "var(--text-lg)",
                  fontWeight: "var(--font-semibold)",
                  color: "var(--color-text)",
                }}
              >
                {selectedSku} — Timeseries
              </h3>
              <p
                style={{
                  margin: "var(--space-2) 0 0",
                  fontSize: "var(--text-sm)",
                  color: "var(--color-text-muted)",
                }}
              >
                Revenue vs Attributed Sales vs Ad Spend (and Net Profit if available)
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSelectedSku(null)}
              style={{
                padding: "var(--space-1) var(--space-3)",
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius-md)",
                backgroundColor: "transparent",
                cursor: "pointer",
                fontSize: "var(--text-sm)",
              }}
            >
              Close
            </button>
          </div>
          <div style={{ padding: "var(--space-4) var(--space-6)" }}>
            {timeseriesLoading ? (
              <div style={{ height: 280 }}>
                <LoadingSkeleton count={3} />
              </div>
            ) : chartData.length > 0 ? (
              <ChartContainer title="">
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart
                    data={chartData}
                    margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="var(--color-border)"
                    />
                    <XAxis
                      dataKey="dateLabel"
                      tick={{ fontSize: 12 }}
                      stroke="var(--color-text-muted)"
                    />
                    <YAxis
                      tick={{ fontSize: 12 }}
                      tickFormatter={(v) => `$${v}`}
                      stroke="var(--color-text-muted)"
                    />
                    <Tooltip
                      formatter={(value: number, name: string) => [
                        formatCurrency(value),
                        name,
                      ]}
                      labelFormatter={(_, payload) =>
                        payload?.[0]?.payload?.date
                          ? formatShortDate(payload[0].payload.date)
                          : ""
                      }
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="revenue"
                      name="Revenue"
                      stroke="var(--color-accent)"
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="attributed_sales"
                      name="Attributed Sales"
                      stroke="var(--color-primary)"
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="ad_spend"
                      name="Ad Spend"
                      stroke="var(--color-error)"
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="net_profit"
                      name="Net Profit"
                      stroke="var(--color-success)"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </ChartContainer>
            ) : (
              <EmptyState
                title="No timeseries data"
                description="No timeseries data available for this SKU."
              />
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
