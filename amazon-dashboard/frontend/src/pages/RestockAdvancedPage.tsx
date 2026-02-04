import { useCallback, useEffect, useState } from "react";
import {
  getRestockRecommendations,
  getRestockRecommendationDetail,
  postRestockWhatIf,
  getRestockExportCsv,
  getRestockSuppliers,
  type RestockRecommendationRowOut,
  type RestockWhatIfRequest,
  type UserRole,
} from "../api";
import Card from "../components/ui/Card";
import LoadingSkeleton from "../components/ui/LoadingSkeleton";
import EmptyState from "../components/ui/EmptyState";
import { getDemoRestockRecommendations, getDemoRestockDetail } from "../data/demoData";
import { isDemoMode } from "../utils/preferences";
import { useToast } from "../context/ToastContext";
import { formatDecimal, formatInteger } from "../utils/format";

const DAYS_OPTIONS = [7, 30, 90] as const;
const MARKETPLACE_OPTIONS = ["US", "UK", "DE", "ALL"] as const;

type Props = {
  token: string;
  userRole?: UserRole;
};

export default function RestockAdvancedPage({ token, userRole }: Props) {
  const { showToast } = useToast();
  const [days, setDays] = useState(30);
  const [marketplace, setMarketplace] = useState("US");
  const [supplierId, setSupplierId] = useState<number | null>(null);
  const [urgentOnly, setUrgentOnly] = useState(false);
  const [missingSettingsOnly, setMissingSettingsOnly] = useState(false);
  const [rows, setRows] = useState<RestockRecommendationRowOut[]>([]);
  const [suppliers, setSuppliers] = useState<{ id: number; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSku, setSelectedSku] = useState<string | null>(null);
  const [detail, setDetail] = useState<RestockRecommendationRowOut | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [whatIfLoading, setWhatIfLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);

  const loadRecommendations = useCallback(() => {
    setError(null);
    setLoading(true);
    if (isDemoMode()) {
      setRows(
        getDemoRestockRecommendations({
          days,
          marketplace,
          supplier_id: supplierId ?? undefined,
          urgent_only: urgentOnly,
          missing_settings_only: missingSettingsOnly,
        })
      );
      setLoading(false);
      return;
    }
    getRestockRecommendations(token, {
      days,
      marketplace,
      supplier_id: supplierId ?? undefined,
      urgent_only: urgentOnly,
      missing_settings_only: missingSettingsOnly,
    })
      .then(setRows)
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Failed to load recommendations");
        setRows([]);
      })
      .finally(() => setLoading(false));
  }, [token, days, marketplace, supplierId, urgentOnly, missingSettingsOnly]);

  const loadSuppliers = useCallback(() => {
    if (isDemoMode()) {
      setSuppliers([{ id: 1, name: "Demo Supplier A" }]);
      return;
    }
    getRestockSuppliers(token)
      .then((list) => setSuppliers(list.map((s) => ({ id: s.id, name: s.name }))))
      .catch(() => setSuppliers([]));
  }, [token]);

  useEffect(() => {
    loadRecommendations();
  }, [loadRecommendations]);

  useEffect(() => {
    loadSuppliers();
  }, [loadSuppliers]);

  useEffect(() => {
    if (!selectedSku) {
      setDetail(null);
      return;
    }
    setDetailLoading(true);
    if (isDemoMode()) {
      setDetail(getDemoRestockDetail({ sku: selectedSku, days, marketplace }));
      setDetailLoading(false);
      return;
    }
    getRestockRecommendationDetail(token, selectedSku, { days, marketplace })
      .then(setDetail)
      .catch(() => setDetail(null))
      .finally(() => setDetailLoading(false));
  }, [token, selectedSku, days, marketplace]);

  const handleWhatIf = (body: RestockWhatIfRequest) => {
    if (isDemoMode()) {
      showToast("Demo: what-if result is simulated.", "info");
      if (detail) setDetail({ ...detail, ...body });
      return;
    }
    setWhatIfLoading(true);
    postRestockWhatIf(token, body)
      .then((res) => {
        setDetail(res.result);
        showToast("Recomputed with what-if inputs", "success");
      })
      .catch((err: unknown) =>
        showToast(err instanceof Error ? err.message : "What-if failed", "error")
      )
      .finally(() => setWhatIfLoading(false));
  };

  const handleExportCsv = () => {
    setExportLoading(true);
    if (isDemoMode()) {
      showToast("Demo: CSV export is simulated.", "info");
      setExportLoading(false);
      return;
    }
    getRestockExportCsv(token, { days, marketplace, supplier_id: supplierId ?? undefined })
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "restock_po_suggestions.csv";
        a.click();
        URL.revokeObjectURL(url);
        showToast("CSV downloaded", "success");
      })
      .catch((err: unknown) =>
        showToast(err instanceof Error ? err.message : "Export failed", "error")
      )
      .finally(() => setExportLoading(false));
  };

  if (error) {
    return (
      <Card>
        <EmptyState title="Something went wrong" description={error} />
      </Card>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      <Card>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-4)", alignItems: "center" }}>
          <label>
            <span style={{ marginRight: "var(--space-2)" }}>Marketplace</span>
            <select
              value={marketplace}
              onChange={(e) => setMarketplace(e.target.value)}
              style={{ padding: "var(--space-2)", borderRadius: "var(--radius-md)" }}
            >
              {MARKETPLACE_OPTIONS.map((mp) => (
                <option key={mp} value={mp}>
                  {mp}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span style={{ marginRight: "var(--space-2)" }}>Days</span>
            <select
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              style={{ padding: "var(--space-2)", borderRadius: "var(--radius-md)" }}
            >
              {DAYS_OPTIONS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span style={{ marginRight: "var(--space-2)" }}>Supplier</span>
            <select
              value={supplierId ?? ""}
              onChange={(e) => setSupplierId(e.target.value ? Number(e.target.value) : null)}
              style={{ padding: "var(--space-2)", borderRadius: "var(--radius-md)", minWidth: 140 }}
            >
              <option value="">All</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
            <input
              type="checkbox"
              checked={urgentOnly}
              onChange={(e) => setUrgentOnly(e.target.checked)}
            />
            Urgent only
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
            <input
              type="checkbox"
              checked={missingSettingsOnly}
              onChange={(e) => setMissingSettingsOnly(e.target.checked)}
            />
            Missing settings only
          </label>
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={exportLoading}
            style={{
              padding: "var(--space-2) var(--space-4)",
              backgroundColor: "var(--color-primary)",
              color: "white",
              border: "none",
              borderRadius: "var(--radius-md)",
              cursor: exportLoading ? "not-allowed" : "pointer",
            }}
          >
            {exportLoading ? "Exporting…" : "Export PO CSV"}
          </button>
        </div>
      </Card>

      <Card>
        <h2 style={{ marginBottom: "var(--space-4)" }}>
          Restock recommendations {isDemoMode() ? "(demo)" : ""}
        </h2>
        {loading ? (
          <LoadingSkeleton count={8} />
        ) : rows.length === 0 ? (
          <EmptyState
            title="No recommendations"
            description="No inventory or data for this marketplace. Add inventory or run a sync."
          />
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--color-border)", textAlign: "left" }}>
                  <th style={{ padding: "var(--space-2)" }}>SKU</th>
                  <th style={{ padding: "var(--space-2)", textAlign: "right" }}>Available</th>
                  <th style={{ padding: "var(--space-2)", textAlign: "right" }}>Daily forecast</th>
                  <th style={{ padding: "var(--space-2)", textAlign: "right" }}>Days of cover</th>
                  <th style={{ padding: "var(--space-2)", textAlign: "right" }}>Reorder point</th>
                  <th style={{ padding: "var(--space-2)", textAlign: "right" }}>Recommended order</th>
                  <th style={{ padding: "var(--space-2)" }}>Supplier</th>
                  <th style={{ padding: "var(--space-2)" }}>Flags</th>
                  <th style={{ padding: "var(--space-2)", textAlign: "right" }}>Priority</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={`${r.sku}-${r.marketplace_code}`}
                    style={{
                      borderBottom: "1px solid var(--color-border)",
                      cursor: "pointer",
                      backgroundColor: selectedSku === r.sku ? "var(--color-bg-muted)" : undefined,
                    }}
                    onClick={() => setSelectedSku(r.sku)}
                  >
                    <td style={{ padding: "var(--space-2)" }}>{r.sku}</td>
                    <td style={{ padding: "var(--space-2)", textAlign: "right" }}>
                      {formatInteger(r.available_units)}
                    </td>
                    <td style={{ padding: "var(--space-2)", textAlign: "right" }}>
                      {formatDecimal(r.daily_demand_forecast, 2)}
                    </td>
                    <td style={{ padding: "var(--space-2)", textAlign: "right" }}>
                      {r.days_of_cover != null ? formatDecimal(r.days_of_cover, 1) : "—"}
                    </td>
                    <td style={{ padding: "var(--space-2)", textAlign: "right" }}>
                      {formatInteger(r.reorder_point_units)}
                    </td>
                    <td style={{ padding: "var(--space-2)", textAlign: "right" }}>
                      {formatInteger(r.recommended_order_units_rounded)}
                    </td>
                    <td style={{ padding: "var(--space-2)" }}>{r.supplier_name ?? "—"}</td>
                    <td style={{ padding: "var(--space-2)", fontSize: "var(--text-xs)" }}>
                      {r.reason_flags.length ? r.reason_flags.join(", ") : "—"}
                    </td>
                    <td style={{ padding: "var(--space-2)", textAlign: "right" }}>
                      {formatDecimal(r.priority_score, 2)}
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
          <h3 style={{ marginBottom: "var(--space-4)" }}>
            Detail: {selectedSku} {detailLoading && "(loading…)"}
          </h3>
          {detail && !detailLoading && (
            <>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
                  gap: "var(--space-4)",
                  marginBottom: "var(--space-4)",
                }}
              >
                <div>
                  <div style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)" }}>
                    Available units
                  </div>
                  <div>{formatInteger(detail.available_units)}</div>
                </div>
                <div>
                  <div style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)" }}>
                    Daily forecast
                  </div>
                  <div>{formatDecimal(detail.daily_demand_forecast, 2)}</div>
                </div>
                <div>
                  <div style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)" }}>
                    Safety stock
                  </div>
                  <div>{formatInteger(detail.safety_stock_units)}</div>
                </div>
                <div>
                  <div style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)" }}>
                    Reorder point
                  </div>
                  <div>{formatInteger(detail.reorder_point_units)}</div>
                </div>
                <div>
                  <div style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)" }}>
                    Recommended (rounded)
                  </div>
                  <div>{formatInteger(detail.recommended_order_units_rounded)}</div>
                </div>
              </div>
              <div style={{ fontSize: "var(--text-sm)", color: "var(--color-text-muted)", marginBottom: "var(--space-4)" }}>
                Flags: {detail.reason_flags.length ? detail.reason_flags.join(", ") : "none"}
              </div>
              <WhatIfForm
                sku={detail.sku}
                marketplace_code={detail.marketplace_code}
                currentLeadTimeMean={detail.lead_time_days_mean}
                currentLeadTimeStd={detail.lead_time_days_std}
                currentDailyForecast={detail.daily_demand_forecast}
                currentOnHand={detail.on_hand_units}
                loading={whatIfLoading}
                onSubmit={handleWhatIf}
              />
            </>
          )}
        </Card>
      )}
    </div>
  );
}

function WhatIfForm({
  sku,
  marketplace_code,
  currentLeadTimeMean,
  currentLeadTimeStd,
  currentDailyForecast,
  currentOnHand,
  loading,
  onSubmit,
}: {
  sku: string;
  marketplace_code: string;
  currentLeadTimeMean: number;
  currentLeadTimeStd: number;
  currentDailyForecast: number;
  currentOnHand: number;
  loading: boolean;
  onSubmit: (body: RestockWhatIfRequest) => void;
}) {
  const [leadTimeMean, setLeadTimeMean] = useState(String(currentLeadTimeMean));
  const [leadTimeStd, setLeadTimeStd] = useState(String(currentLeadTimeStd));
  const [serviceLevel, setServiceLevel] = useState("0.95");
  const [dailyOverride, setDailyOverride] = useState("");
  const [onHandOverride, setOnHandOverride] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      sku,
      marketplace_code,
      lead_time_mean: leadTimeMean ? Number(leadTimeMean) : undefined,
      lead_time_std: leadTimeStd ? Number(leadTimeStd) : undefined,
      service_level: serviceLevel ? Number(serviceLevel) : undefined,
      daily_demand_override: dailyOverride ? Number(dailyOverride) : undefined,
      on_hand_override: onHandOverride ? Number(onHandOverride) : undefined,
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
        gap: "var(--space-4)",
        alignItems: "end",
      }}
    >
      <label>
        <span style={{ display: "block", fontSize: "var(--text-xs)", marginBottom: "var(--space-1)" }}>
          Lead time mean (days)
        </span>
        <input
          type="number"
          min={1}
          max={365}
          value={leadTimeMean}
          onChange={(e) => setLeadTimeMean(e.target.value)}
          style={{ width: "100%", padding: "var(--space-2)", borderRadius: "var(--radius-md)" }}
        />
      </label>
      <label>
        <span style={{ display: "block", fontSize: "var(--text-xs)", marginBottom: "var(--space-1)" }}>
          Lead time std (days)
        </span>
        <input
          type="number"
          min={0}
          max={90}
          value={leadTimeStd}
          onChange={(e) => setLeadTimeStd(e.target.value)}
          style={{ width: "100%", padding: "var(--space-2)", borderRadius: "var(--radius-md)" }}
        />
      </label>
      <label>
        <span style={{ display: "block", fontSize: "var(--text-xs)", marginBottom: "var(--space-1)" }}>
          Service level (0.5–0.99)
        </span>
        <input
          type="number"
          min={0.5}
          max={0.99}
          step={0.01}
          value={serviceLevel}
          onChange={(e) => setServiceLevel(e.target.value)}
          style={{ width: "100%", padding: "var(--space-2)", borderRadius: "var(--radius-md)" }}
        />
      </label>
      <label>
        <span style={{ display: "block", fontSize: "var(--text-xs)", marginBottom: "var(--space-1)" }}>
          Daily demand override
        </span>
        <input
          type="number"
          min={0}
          step={0.1}
          placeholder={String(currentDailyForecast)}
          value={dailyOverride}
          onChange={(e) => setDailyOverride(e.target.value)}
          style={{ width: "100%", padding: "var(--space-2)", borderRadius: "var(--radius-md)" }}
        />
      </label>
      <label>
        <span style={{ display: "block", fontSize: "var(--text-xs)", marginBottom: "var(--space-1)" }}>
          On hand override
        </span>
        <input
          type="number"
          min={0}
          placeholder={String(currentOnHand)}
          value={onHandOverride}
          onChange={(e) => setOnHandOverride(e.target.value)}
          style={{ width: "100%", padding: "var(--space-2)", borderRadius: "var(--radius-md)" }}
        />
      </label>
      <button
        type="submit"
        disabled={loading}
        style={{
          padding: "var(--space-2) var(--space-4)",
          backgroundColor: "var(--color-primary)",
          color: "white",
          border: "none",
          borderRadius: "var(--radius-md)",
          cursor: loading ? "not-allowed" : "pointer",
        }}
      >
        {loading ? "Recomputing…" : "Recompute (what-if)"}
      </button>
    </form>
  );
}
