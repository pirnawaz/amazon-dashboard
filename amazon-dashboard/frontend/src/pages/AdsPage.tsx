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
  adsDashboardSummary,
  adsTimeseries,
  getAdsAccount,
  triggerAdsSync,
  type AdsDashboardSummary as AdsDashboardSummaryType,
  type AdsTimeseriesResponse,
} from "../api";
import { getDemoAdsSummary, getDemoAdsTimeseries } from "../data/demoData";
import Card from "../components/ui/Card";
import Metric from "../components/ui/Metric";
import ChartContainer from "../components/ui/ChartContainer";
import EmptyState from "../components/ui/EmptyState";
import LoadingSkeleton from "../components/ui/LoadingSkeleton";
import { formatCurrency, formatShortDate } from "../utils/format";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { useDemo } from "../context/DemoContext";

const DAYS_OPTIONS = [7, 30, 90] as const;
const MARKETPLACE_OPTIONS = ["ALL", "US", "UK", "DE"] as const;

type Props = {
  token: string;
};

export default function AdsPage({ token }: Props) {
  const { showToast } = useToast();
  const { isDemoMode: demoMode } = useDemo();
  const [days, setDays] = useState<number>(30);
  const [marketplace, setMarketplace] = useState<string>("ALL");
  const [summary, setSummary] = useState<AdsDashboardSummaryType | null>(null);
  const [timeseriesData, setTimeseriesData] = useState<AdsTimeseriesResponse | null>(null);
  const [account, setAccount] = useState<{ has_refresh_token: boolean; last_sync_status: string | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const loadData = useCallback(() => {
    const params = { days, marketplace };
    if (demoMode) {
      setError(null);
      setLoading(true);
      setSummary(getDemoAdsSummary(params));
      setTimeseriesData(getDemoAdsTimeseries(params));
      setAccount({ has_refresh_token: false, last_sync_status: null });
      setLoading(false);
      return;
    }
    setError(null);
    setLoading(true);
    Promise.all([
      adsDashboardSummary(token, params),
      adsTimeseries(token, params),
      getAdsAccount(token),
    ])
      .then(([s, t, acc]) => {
        setSummary(s);
        setTimeseriesData(t);
        setAccount(acc ? { has_refresh_token: acc.has_refresh_token, last_sync_status: acc.last_sync_status } : null);
      })
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : "Failed to load Ads data")
      )
      .finally(() => setLoading(false));
  }, [token, days, marketplace, demoMode]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSync = useCallback(() => {
    if (demoMode) {
      showToast("Use real data to sync Ads.", "info");
      return;
    }
    setSyncing(true);
    triggerAdsSync(token)
      .then((res) => {
        if (res.ok) {
          showToast(`Sync done: ${res.metrics_upserted} metrics.`, "success");
          loadData();
        } else {
          showToast(res.error || "Sync failed.", "error");
        }
      })
      .catch((err: unknown) => {
        showToast(err instanceof Error ? err.message : "Sync failed", "error");
      })
      .finally(() => setSyncing(false));
  }, [token, demoMode, showToast, loadData]);

  const chartData =
    timeseriesData?.points.map((p) => ({
      date: p.date,
      dateLabel: formatShortDate(p.date),
      spend: p.spend,
      sales: p.sales,
      acos: p.acos ?? undefined,
      roas: p.roas ?? undefined,
    })) ?? [];

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
                onClick={() => loadData()}
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
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
            gap: "var(--space-4)",
          }}
        >
          {[1, 2, 3, 4].map((i) => (
            <div key={i} style={{ padding: "var(--space-4)" }}>
              <LoadingSkeleton count={2} />
            </div>
          ))}
        </div>
        <Card>
          <div style={{ padding: "var(--space-6)", height: 280, backgroundColor: "var(--color-border)", borderRadius: "var(--radius-md)" }} />
        </Card>
      </div>
    );
  }

  if (summary === null) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
        <EmptyState
          title="No Ads data"
          description="Connect an Ads account in Admin or load sample data to see spend, sales, ACOS, and ROAS."
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
                fontWeight: "var(--font-medium)",
                cursor: "pointer",
              }}
            >
              Try again
            </button>
          }
        />
      </div>
    );
  }

  const acosStr = summary.acos != null ? `${Number(summary.acos).toFixed(1)}%` : "—";
  const roasStr = summary.roas != null ? `${Number(summary.roas).toFixed(2)}x` : "—";

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
          Demo data — sample Ads metrics. Connect Ads account in Admin for real data.
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
        {!demoMode && (
          <button
            type="button"
            onClick={handleSync}
            disabled={syncing}
            style={{
              padding: "var(--space-2) var(--space-4)",
              backgroundColor: "var(--color-primary)",
              color: "white",
              border: "none",
              borderRadius: "var(--radius-md)",
              fontWeight: "var(--font-medium)",
              cursor: syncing ? "wait" : "pointer",
              opacity: syncing ? 0.7 : 1,
            }}
          >
            {syncing ? "Syncing…" : "Sync Ads"}
          </button>
        )}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
          gap: "var(--space-4)",
        }}
      >
        <Metric label="Spend" value={formatCurrency(Number(summary.spend))} />
        <Metric label="Sales" value={formatCurrency(Number(summary.sales))} />
        <Metric label="ACOS" value={acosStr} />
        <Metric label="ROAS" value={roasStr} />
      </div>

      {chartData.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
          <ChartContainer
            title="Spend & Sales by date"
            dataThroughDate={timeseriesData?.points?.length ? timeseriesData.points[timeseriesData.points.length - 1].date : undefined}
          >
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
                <Line type="monotone" dataKey="spend" stroke="var(--color-error)" strokeWidth={2} dot={false} name="Spend" />
                <Line type="monotone" dataKey="sales" stroke="var(--color-accent)" strokeWidth={2} dot={false} name="Sales" />
              </LineChart>
            </ResponsiveContainer>
          </ChartContainer>
        </div>
      ) : (
        <ChartContainer title="Spend & Sales by date">
          <EmptyState
            title="No time series data"
            description="Run Sync Ads or connect an Ads account in Admin to see data by date."
          />
        </ChartContainer>
      )}
    </div>
  );
}
