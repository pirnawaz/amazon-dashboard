import { useEffect, useState } from "react";
import { restock, type RestockResponse, type RestockRow } from "./api";
import Card from "./components/ui/Card";
import Table from "./components/ui/Table";
import EmptyState from "./components/ui/EmptyState";
import LoadingSkeleton from "./components/ui/LoadingSkeleton";
import { formatInteger, formatDecimal } from "./utils/format";

const DAYS_OPTIONS = [7, 30, 90] as const;
const TARGET_DAYS_OPTIONS = [14, 30, 60] as const;
const MARKETPLACE_OPTIONS = ["ALL", "US", "UK", "DE"] as const;

function riskBadgeStyle(risk: string): React.CSSProperties {
  if (risk === "CRITICAL")
    return {
      padding: "var(--space-1) var(--space-2)",
      background: "var(--color-error-muted)",
      borderRadius: "var(--radius-sm)",
      color: "var(--color-error)",
      fontSize: "var(--text-xs)",
      fontWeight: "var(--font-medium)",
    };
  if (risk === "LOW")
    return {
      padding: "var(--space-1) var(--space-2)",
      background: "var(--color-warning-muted)",
      borderRadius: "var(--radius-sm)",
      color: "var(--color-warning)",
      fontSize: "var(--text-xs)",
      fontWeight: "var(--font-medium)",
    };
  return {
    padding: "var(--space-1) var(--space-2)",
    background: "var(--color-success-muted)",
    borderRadius: "var(--radius-sm)",
    color: "var(--color-success)",
    fontSize: "var(--text-xs)",
    fontWeight: "var(--font-medium)",
  };
}

type Props = {
  token: string;
};

const RESTOCK_COLUMNS = [
  { key: "risk_level" as const, header: "Risk", render: (r: RestockRow) => <span style={riskBadgeStyle(r.risk_level)}>{r.risk_level}</span> },
  { key: "sku" as const, header: "SKU" },
  { key: "title" as const, header: "Title", render: (r: RestockRow) => r.title ?? "—" },
  { key: "on_hand" as const, header: "On Hand", align: "right" as const, render: (r: RestockRow) => formatInteger(r.on_hand) },
  { key: "avg_daily_units" as const, header: "Avg Daily Units", align: "right" as const, render: (r: RestockRow) => formatDecimal(r.avg_daily_units, 2) },
  { key: "days_of_cover" as const, header: "Days of Cover", align: "right" as const, render: (r: RestockRow) => formatDecimal(r.days_of_cover, 2) },
  { key: "reorder_qty" as const, header: "Reorder Qty", align: "right" as const, render: (r: RestockRow) => formatInteger(r.reorder_qty) },
];

export default function Restock({ token }: Props) {
  const [days, setDays] = useState<number>(30);
  const [targetDays, setTargetDays] = useState<number>(30);
  const [marketplace, setMarketplace] = useState<string>("ALL");
  const [data, setData] = useState<RestockResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = () => {
    setError(null);
    setLoading(true);
    restock(token, { days, target_days: targetDays, marketplace, limit: 50 })
      .then(setData)
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : "Failed to load restock data")
      )
      .finally(() => setLoading(false));
  };

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

  if (error) {
    return (
      <Card>
        <EmptyState
          title="Something went wrong"
          description={error}
          action={
            <button
              type="button"
              onClick={loadData}
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
        <div style={{ display: "flex", gap: "var(--space-4)", flexWrap: "wrap" }}>
          <LoadingSkeleton count={3} />
        </div>
        <Card>
          <div style={{ padding: "var(--space-6)" }}>
            <LoadingSkeleton
              children={
                <div
                  style={{
                    height: 320,
                    borderRadius: "var(--radius-md)",
                    backgroundColor: "var(--color-border)",
                    animation: "skeleton-pulse 1.5s ease-in-out infinite",
                  }}
                />
              }
            />
          </div>
        </Card>
      </div>
    );
  }

  return (
    <section style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
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
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", fontSize: "var(--text-sm)" }}>
          Target days
          <select
            value={targetDays}
            onChange={(e) => setTargetDays(Number(e.target.value))}
            style={{
              padding: "var(--space-2) var(--space-3)",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-md)",
              backgroundColor: "var(--color-bg-elevated)",
              fontSize: "var(--text-sm)",
            }}
          >
            {TARGET_DAYS_OPTIONS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
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
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>
      </div>

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
            Restock recommendations
          </h3>
        </div>
        <Table
          columns={RESTOCK_COLUMNS}
          data={data?.items ?? []}
          getRowKey={(r) => r.sku}
          emptyTitle="No restock items"
          emptyDescription="No restock recommendations for the selected period and marketplace. Try different filters."
          stickyHeader
        />
      </Card>
    </section>
  );
}
