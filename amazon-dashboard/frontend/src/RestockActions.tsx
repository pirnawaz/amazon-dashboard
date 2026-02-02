import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  getRestockActionsTotal,
  type RestockActionsResponse,
  type RestockActionItem,
} from "./api";
import { getDemoRestockActionsTotal } from "./data/demoData";
import Card from "./components/ui/Card";
import EmptyState from "./components/ui/EmptyState";
import LoadingSkeleton from "./components/ui/LoadingSkeleton";
import RestockSummaryCard from "./components/restock/RestockSummaryCard";
import RestockTable from "./components/restock/RestockTable";
import { useAuth } from "./context/AuthContext";
import { isDemoMode } from "./utils/preferences";

const HORIZON_OPTIONS = [14, 30, 60] as const;
const MARKETPLACE_OPTIONS = ["ALL", "US", "UK", "DE"] as const;

type Props = {
  token: string;
};

export default function RestockActions({ token }: Props) {
  const [marketplace, setMarketplace] = useState<string>("ALL");
  const [horizonDays, setHorizonDays] = useState<number>(30);
  const [leadTimeDays, setLeadTimeDays] = useState<number>(14);
  const [currentStockUnits, setCurrentStockUnits] = useState<string>("");
  const [includeUnmapped, setIncludeUnmapped] = useState<boolean>(false);
  const [data, setData] = useState<RestockActionsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
  const isOwner = user?.role === "owner";

  const loadData = useCallback(() => {
    setError(null);
    setLoading(true);
    const params = {
      marketplace,
      horizon_days: horizonDays,
      lead_time_days: leadTimeDays,
      service_level: 0.95,
      current_stock_units:
        currentStockUnits.trim() === ""
          ? null
          : Number(currentStockUnits.trim()),
      include_unmapped: includeUnmapped,
    };
    if (isDemoMode()) {
      setData(getDemoRestockActionsTotal(params));
      setLoading(false);
      return;
    }
    getRestockActionsTotal(token, params)
      .then(setData)
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : "Failed to load restock actions")
      )
      .finally(() => setLoading(false));
  }, [token, marketplace, horizonDays, leadTimeDays, currentStockUnits, includeUnmapped]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const totalItem: RestockActionItem | null = data?.items?.[0] ?? null;

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
        <LoadingSkeleton count={4} />
        <Card>
          <div style={{ padding: "var(--space-6)" }}>
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
        </Card>
      </div>
    );
  }

  const dq = data?.data_quality;
  const hasDataQuality = dq != null;
  const severity = dq?.severity ?? "ok";
  const isCritical = severity === "critical";
  const isWarning = severity === "warning";

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
          Demo data — sample restock actions for exploration. Clear in Settings to use real data.
        </div>
      )}

      {hasDataQuality && (
        <div
          style={{
            padding: "var(--space-3) var(--space-4)",
            backgroundColor: isCritical ? "var(--color-error-muted, #fef2f2)" : isWarning ? "var(--color-warning-muted)" : "var(--color-bg-muted)",
            color: isCritical ? "var(--color-error, #b91c1c)" : isWarning ? "var(--color-warning)" : "var(--color-text-muted)",
            borderRadius: "var(--radius-md)",
            fontSize: "var(--text-sm)",
            border: isCritical ? "1px solid var(--color-error, #b91c1c)" : undefined,
          }}
          role="alert"
        >
          <strong>Data quality ({severity === "critical" ? "Critical" : severity === "warning" ? "Warning" : "OK"}):</strong>{" "}
          {dq!.warnings && dq!.warnings!.length > 0 ? dq!.warnings!.join(" ") : "No issues."}
          {(dq!.excluded_units > 0 || (dq!.unmapped_share_30d ?? 0) > 0) && (
            <span> Excluded units: {dq!.excluded_units}; unmapped share (30d): {((dq!.unmapped_share_30d ?? 0) * 100).toFixed(1)}%.</span>
          )}
          {isCritical && (
            <p style={{ margin: "var(--space-2) 0 0", fontWeight: "var(--font-medium)" }}>
              Fix mappings in Admin → Catalog Mapping to improve restock accuracy.
            </p>
          )}
          {isOwner && (dq!.warnings?.length ?? 0) > 0 && (
            <span style={{ display: "block", marginTop: "var(--space-2)" }}>
              <Link to="/admin/catalog-mapping" style={{ color: "var(--color-primary)", fontWeight: "var(--font-medium)" }}>
                Fix mappings
              </Link>
            </span>
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
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--space-2)",
            fontSize: "var(--text-sm)",
          }}
        >
          Horizon days
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
            {HORIZON_OPTIONS.map((d) => (
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
          Lead time (days)
          <input
            type="number"
            min={1}
            max={90}
            value={leadTimeDays}
            onChange={(e) => setLeadTimeDays(Number(e.target.value) || 14)}
            style={{
              padding: "var(--space-2) var(--space-3)",
              width: 72,
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-md)",
              fontSize: "var(--text-sm)",
            }}
          />
        </label>
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--space-2)",
            fontSize: "var(--text-sm)",
          }}
        >
          Current stock units (optional)
          <input
            type="number"
            min={0}
            step={1}
            value={currentStockUnits}
            onChange={(e) => setCurrentStockUnits(e.target.value)}
            placeholder="Leave blank for insufficient_data"
            style={{
              padding: "var(--space-2) var(--space-3)",
              width: 120,
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-md)",
              fontSize: "var(--text-sm)",
            }}
          />
        </label>
        {currentStockUnits.trim() === "" && (
          <span style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)" }}>
            Using saved inventory if available.
          </span>
        )}
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--space-2)",
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
        <button
          type="button"
          onClick={loadData}
          style={{
            padding: "var(--space-2) var(--space-4)",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-md)",
            backgroundColor: "var(--color-bg-elevated)",
            fontSize: "var(--text-sm)",
            fontWeight: "var(--font-medium)",
            cursor: "pointer",
          }}
        >
          Refresh
        </button>
      </div>

      {totalItem && (
        <RestockSummaryCard
          title="Total"
          item={totalItem}
        />
      )}

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
            Restock actions
          </h3>
        </div>
        <div style={{ padding: "var(--space-4)" }}>
          <RestockTable items={data?.items ?? []} />
        </div>
      </Card>
    </section>
  );
}
