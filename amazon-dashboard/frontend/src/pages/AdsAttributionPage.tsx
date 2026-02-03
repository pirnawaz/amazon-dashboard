import { useCallback, useEffect, useState } from "react";
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
  getSkuProfitability,
  getSkuProfitabilityTimeseries,
  type SkuProfitabilityResponse,
  type SkuProfitabilityRow,
  type SkuTimeseriesResponse,
} from "../api";
import { getDemoSkuProfitability, getDemoSkuTimeseries } from "../data/demoData";
import Card from "../components/ui/Card";
import ChartContainer from "../components/ui/ChartContainer";
import EmptyState from "../components/ui/EmptyState";
import LoadingSkeleton from "../components/ui/LoadingSkeleton";
import { formatCurrency, formatShortDate } from "../utils/format";
import { useDemo } from "../context/DemoContext";

const DAYS_OPTIONS = [7, 30, 90] as const;
const MARKETPLACE_OPTIONS = ["ALL", "US", "UK", "DE"] as const;

type Props = {
  token: string;
};

function numOrNull(v: number | string | null | undefined): number | null {
  if (v == null) return null;
  const n = typeof v === "string" ? parseFloat(v) : v;
  return Number.isFinite(n) ? n : null;
}

function formatNumOrDash(
  v: number | string | null | undefined,
  fmt: (n: number) => string = (n) => n.toFixed(2)
): string {
  const n = numOrNull(v);
  return n != null ? fmt(n) : "—";
}

export default function AdsAttributionPage({ token }: Props) {
  const { isDemoMode: demoMode } = useDemo();
  const [days, setDays] = useState<number>(30);
  const [marketplace, setMarketplace] = useState<string>("ALL");
  const [data, setData] = useState<SkuProfitabilityResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedSku, setSelectedSku] = useState<string | null>(null);
  const [timeseries, setTimeseries] = useState<SkuTimeseriesResponse | null>(null);
  const [tsLoading, setTsLoading] = useState(false);

  const loadTable = useCallback(() => {
    const params = { days, marketplace };
    if (demoMode) {
      setError(null);
      setLoading(true);
      setData(getDemoSkuProfitability(params));
      setLoading(false);
      return;
    }
    setError(null);
    setLoading(true);
    getSkuProfitability(token, params)
      .then(setData)
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : "Failed to load profitability data")
      )
      .finally(() => setLoading(false));
  }, [token, days, marketplace, demoMode]);

  useEffect(() => {
    loadTable();
  }, [loadTable]);

  useEffect(() => {
    if (!selectedSku) {
      setTimeseries(null);
      return;
    }
    const params = { sku: selectedSku, days, marketplace };
    if (demoMode) {
      setTsLoading(false);
      setTimeseries(getDemoSkuTimeseries(selectedSku, params));
      return;
    }
    setTsLoading(true);
    getSkuProfitabilityTimeseries(token, params)
      .then(setTimeseries)
      .catch(() => setTimeseries(null))
      .finally(() => setTsLoading(false));
  }, [selectedSku, token, days, marketplace, demoMode]);

  const sortBy = useState<{ key: keyof SkuProfitabilityRow | ""; dir: "asc" | "desc" }>({
    key: "revenue",
    dir: "desc",
  })[0];
  const rows = data?.rows ?? [];
  const sortedRows = [...rows].sort((a, b) => {
    if (!sortBy.key) return 0;
    const va = numOrNull(a[sortBy.key]);
    const vb = numOrNull(b[sortBy.key]);
    if (va == null && vb == null) return 0;
    if (va == null) return sortBy.dir === "asc" ? 1 : -1;
    if (vb == null) return sortBy.dir === "asc" ? -1 : 1;
    return sortBy.dir === "asc" ? va - vb : vb - va;
  });

  if (error) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
        <Card>
          <EmptyState
            title="Something went wrong"
            description={error}
            action={
              <button
                type="button"
                onClick={() => loadTable()}
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
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "var(--space-4)" }}>
          {[1, 2, 3].map((i) => (
            <div key={i} style={{ padding: "var(--space-4)" }}>
              <LoadingSkeleton count={2} />
            </div>
          ))}
        </div>
        <Card>
          <div style={{ padding: "var(--space-6)", height: 320, backgroundColor: "var(--color-border)", borderRadius: "var(--radius-md)" }} />
        </Card>
      </div>
    );
  }

  const chartData =
    timeseries?.points.map((p) => ({
      date: p.date,
      dateLabel: formatShortDate(p.date),
      revenue: numOrNull(p.revenue) ?? 0,
      attributed_sales: numOrNull(p.attributed_sales) ?? 0,
      ad_spend: numOrNull(p.ad_spend) ?? 0,
      net_profit: numOrNull(p.net_profit) ?? 0,
    })) ?? [];

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
          Demo data — sample SKU profitability. Connect Ads and Orders for real attribution.
        </div>
      )}

      <div
        style={{
          display: "flex",
          gap: "var(--space-4)",
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <label style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", fontSize: "var(--text-sm)" }}>
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
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", fontSize: "var(--text-sm)" }}>
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
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </label>
      </div>

      <Card>
        <h3 style={{ marginBottom: "var(--space-4)", fontSize: "var(--text-lg)", fontWeight: "var(--font-semibold)" }}>
          SKU profitability
        </h3>
        {sortedRows.length === 0 ? (
          <EmptyState
            title="No profitability data"
            description="Run Ads sync and ensure Orders data exists. Warnings (e.g. missing COGS) will appear instead of failing."
          />
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "var(--text-sm)" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--color-border)", textAlign: "left" }}>
                  <th style={{ padding: "var(--space-2) var(--space-3)" }}>SKU</th>
                  <th style={{ padding: "var(--space-2) var(--space-3)" }}>Revenue</th>
                  <th style={{ padding: "var(--space-2) var(--space-3)" }}>Ad Spend</th>
                  <th style={{ padding: "var(--space-2) var(--space-3)" }}>Attributed Sales</th>
                  <th style={{ padding: "var(--space-2) var(--space-3)" }}>Units</th>
                  <th style={{ padding: "var(--space-2) var(--space-3)" }}>COGS</th>
                  <th style={{ padding: "var(--space-2) var(--space-3)" }}>Net Profit</th>
                  <th style={{ padding: "var(--space-2) var(--space-3)" }}>ACOS / ROAS</th>
                  <th style={{ padding: "var(--space-2) var(--space-3)" }}>Warnings</th>
                </tr>
              </thead>
              <tbody>
                {sortedRows.map((r) => (
                  <tr
                    key={`${r.sku}-${r.marketplace_code}`}
                    style={{
                      borderBottom: "1px solid var(--color-border)",
                      cursor: "pointer",
                      backgroundColor: selectedSku === r.sku ? "var(--color-bg-muted)" : undefined,
                    }}
                    onClick={() => setSelectedSku(selectedSku === r.sku ? null : r.sku)}
                  >
                    <td style={{ padding: "var(--space-2) var(--space-3)", fontWeight: "var(--font-medium)" }}>
                      {r.sku}
                    </td>
                    <td style={{ padding: "var(--space-2) var(--space-3)" }}>
                      {formatCurrency(numOrNull(r.revenue) ?? 0)}
                    </td>
                    <td style={{ padding: "var(--space-2) var(--space-3)" }}>
                      {formatNumOrDash(r.ad_spend, (n) => formatCurrency(n))}
                    </td>
                    <td style={{ padding: "var(--space-2) var(--space-3)" }}>
                      {formatNumOrDash(r.attributed_sales, (n) => formatCurrency(n))}
                    </td>
                    <td style={{ padding: "var(--space-2) var(--space-3)" }}>{r.units_sold}</td>
                    <td style={{ padding: "var(--space-2) var(--space-3)" }}>
                      {formatNumOrDash(r.total_cogs, (n) => formatCurrency(n))}
                    </td>
                    <td style={{ padding: "var(--space-2) var(--space-3)" }}>
                      {formatNumOrDash(r.net_profit, (n) => formatCurrency(n))}
                    </td>
                    <td style={{ padding: "var(--space-2) var(--space-3)" }}>
                      {numOrNull(r.acos) != null
                        ? `${Number(r.acos).toFixed(1)}%`
                        : numOrNull(r.roas) != null
                          ? `${Number(r.roas).toFixed(2)}x`
                          : "—"}
                    </td>
                    <td style={{ padding: "var(--space-2) var(--space-3)" }}>
                      {r.warning_flags?.length
                        ? r.warning_flags.map((w) => (
                            <span
                              key={w}
                              style={{
                                display: "inline-block",
                                marginRight: "var(--space-1)",
                                padding: "2px 6px",
                                fontSize: "var(--text-xs)",
                                backgroundColor: "var(--color-warning-muted)",
                                color: "var(--color-warning)",
                                borderRadius: "var(--radius-sm)",
                              }}
                            >
                              {w.replace(/_/g, " ")}
                            </span>
                          ))
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {selectedSku && (
        <Card>
          <h3 style={{ marginBottom: "var(--space-4)", fontSize: "var(--text-lg)", fontWeight: "var(--font-semibold)" }}>
            {selectedSku} — Revenue vs Attributed Sales vs Ad Spend
            {tsLoading && <span style={{ marginLeft: "var(--space-2)", fontWeight: "normal", color: "var(--color-text-muted)" }}>Loading…</span>}
          </h3>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="dateLabel" tick={{ fontSize: 12 }} stroke="var(--color-text-muted)" />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `$${v}`} stroke="var(--color-text-muted)" />
                <Tooltip
                  formatter={(value: number) => [formatCurrency(value), "Value"]}
                  labelFormatter={(_, payload) =>
                    payload?.[0]?.payload?.date ? formatShortDate(payload[0].payload.date) : ""
                  }
                />
                <Line type="monotone" dataKey="revenue" stroke="var(--color-accent)" strokeWidth={2} dot={false} name="Revenue" />
                <Line type="monotone" dataKey="attributed_sales" stroke="var(--color-success)" strokeWidth={2} dot={false} name="Attributed Sales" />
                <Line type="monotone" dataKey="ad_spend" stroke="var(--color-error)" strokeWidth={2} dot={false} name="Ad Spend" />
                {chartData.some((d) => d.net_profit != null) ? (
                  <Line type="monotone" dataKey="net_profit" stroke="var(--color-primary)" strokeWidth={2} dot={false} name="Net Profit" />
                ) : null}
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState
              title="No timeseries data"
              description="No daily data for this SKU in the selected period."
            />
          )}
        </Card>
      )}
    </div>
  );
}
