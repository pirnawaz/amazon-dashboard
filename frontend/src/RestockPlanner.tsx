import { useEffect, useState } from "react";
import { restockPlan, suggestedSkus, type RestockPlanResponse } from "./api";
import { useToast } from "./context/ToastContext";
import EmptyState from "./components/ui/EmptyState";
import Card from "./components/ui/Card";
import ForecastQualityBadge from "./components/insights/ForecastQualityBadge";
import { formatDecimal } from "./utils/format";
import {
  getPref,
  PREF_KEYS,
  DEFAULT_MARKETPLACE_DEFAULT,
  DEFAULT_LEAD_TIME_DAYS_DEFAULT,
  DEFAULT_SERVICE_LEVEL_DEFAULT,
} from "./utils/preferences";

const MARKETPLACE_OPTIONS = ["US", "UK", "DE", "FR", "IT", "ES"] as const;
const SERVICE_LEVEL_OPTIONS = [
  { value: 0.85, label: "0.85" },
  { value: 0.9, label: "0.90" },
  { value: 0.95, label: "0.95" },
  { value: 0.99, label: "0.99" },
] as const;

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/** UI-only: stockout risk from days of cover vs lead time. */
function stockoutRisk(
  daysOfCover: number | null | undefined,
  leadTimeDays: number,
  recommendedOrderByDate: string
): "High" | "Medium" | "Low" {
  const today = todayISO();
  if (recommendedOrderByDate <= today) return "High";
  if (daysOfCover == null) return "Low";
  if (daysOfCover < leadTimeDays) return "High";
  if (daysOfCover < leadTimeDays + 7) return "Medium";
  return "Low";
}

/** UI-only: overstock risk from order qty vs demand over horizon (lead-time demand). */
function overstockRisk(reorderQty: number, leadTimeDemand: number): "High" | "Medium" | "Low" {
  if (leadTimeDemand <= 0) return "Low";
  if (reorderQty > leadTimeDemand * 1.5) return "High";
  if (reorderQty > leadTimeDemand * 1.2) return "Medium";
  return "Low";
}

type Props = {
  token: string | null;
};

export default function RestockPlanner({ token }: Props) {
  const [sku, setSku] = useState("");
  const [marketplace, setMarketplace] = useState<string>(() => {
    const stored = String(getPref(PREF_KEYS.DEFAULT_MARKETPLACE, "US"));
    return MARKETPLACE_OPTIONS.includes(stored as (typeof MARKETPLACE_OPTIONS)[number]) ? stored : "US";
  });
  const [leadTimeDays, setLeadTimeDays] = useState<number>(() =>
    Number(getPref(PREF_KEYS.DEFAULT_LEAD_TIME_DAYS, DEFAULT_LEAD_TIME_DAYS_DEFAULT))
  );
  const [serviceLevel, setServiceLevel] = useState<number>(() =>
    Number(getPref(PREF_KEYS.DEFAULT_SERVICE_LEVEL, DEFAULT_SERVICE_LEVEL_DEFAULT))
  );
  const [currentInventoryStr, setCurrentInventoryStr] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RestockPlanResponse | null>(null);
  const [lastSubmittedWithInventory, setLastSubmittedWithInventory] = useState(false);
  const [lastSubmittedInventory, setLastSubmittedInventory] = useState<number | null>(null);
  const [copiedFeedback, setCopiedFeedback] = useState(false);

  const [suggestedSkusList, setSuggestedSkusList] = useState<string[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [suggestionsError, setSuggestionsError] = useState<string | null>(null);

  const hasToken = Boolean(token?.trim());
  const { showToast } = useToast();

  useEffect(() => {
    if (!hasToken) {
      setSuggestedSkusList([]);
      setSuggestionsError(null);
      return;
    }
    setSuggestionsError(null);
    setLoadingSuggestions(true);
    suggestedSkus(token!, marketplace)
      .then(setSuggestedSkusList)
      .catch(() => setSuggestionsError("Could not load suggestions"))
      .finally(() => setLoadingSuggestions(false));
  }, [hasToken, token, marketplace]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!hasToken) return;
    setError(null);
    setResult(null);
    setLoading(true);
    const invTrimmed = currentInventoryStr.trim();
    const raw = parseInt(invTrimmed, 10);
    const currentInventory =
      invTrimmed === "" ? undefined : Math.max(0, Math.floor(Number.isNaN(raw) ? 0 : raw));
    const sentWithInventory = currentInventory !== undefined;
    try {
      const body = {
        sku: sku.trim(),
        marketplace,
        lead_time_days: leadTimeDays,
        service_level: serviceLevel,
        ...(currentInventory !== undefined && { current_inventory: currentInventory }),
      };
      const data = await restockPlan(token!, body);
      setResult(data);
      setLastSubmittedWithInventory(sentWithInventory);
      setLastSubmittedInventory(sentWithInventory && currentInventory !== undefined ? currentInventory : null);
      showToast("Plan generated", "success");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to generate plan";
      setError(msg);
      showToast(msg, "error");
    } finally {
      setLoading(false);
    }
  }

  function copyPlanToClipboard() {
    if (!result) return;
    const invVal = lastSubmittedInventory;
    const hasStockout =
      result.days_of_cover != null && result.expected_stockout_date != null;
    const lines = [
      "Restock Plan",
      `SKU: ${result.sku}`,
      `Marketplace: ${result.marketplace}`,
      `Lead time (days): ${result.lead_time_days}`,
      `Service level: ${result.service_level}`,
      ...(invVal != null ? [`Current inventory: ${invVal}`] : []),
      `Data end date: ${result.data_end_date}`,
      "",
      `Recommended reorder quantity: ${result.reorder_quantity}`,
      `Avg daily demand: ${formatDecimal(result.avg_daily_demand, 2)}`,
      `Lead-time demand: ${formatDecimal(result.lead_time_demand, 2)}`,
      `Safety stock: ${formatDecimal(result.safety_stock, 2)}`,
      `MAPE (30d): ${formatDecimal(result.mape_30d, 2)}`,
      ...(hasStockout
        ? [
            "",
            "Stockout estimate:",
            `Days of cover: ${result.days_of_cover!.toFixed(1)} days`,
            `Expected stockout date: ${result.expected_stockout_date!}`,
            `Stockout before lead time: ${result.stockout_before_lead_time ? "Yes" : "No"}`,
          ]
        : lastSubmittedWithInventory
          ? ["", "Stockout estimate: N/A (not enough demand signal)"]
          : ["", "Stockout estimate: N/A (add current inventory to estimate)"]),
    ];
    const text = lines.join("\n");
    navigator.clipboard.writeText(text).then(() => {
      setCopiedFeedback(true);
      window.setTimeout(() => setCopiedFeedback(false), 2000);
    });
  }

  const formDisabled = !hasToken;

  return (
    <section style={{ marginTop: 24 }}>
      <h2>Restock Planner</h2>

      {!hasToken && (
        <p style={{ background: "#fef3c7", padding: 12, borderRadius: 8, marginBottom: 16 }}>
          Please log in to generate a restock plan.
        </p>
      )}

      <form
        onSubmit={handleSubmit}
        style={{
          display: "grid",
          gap: 12,
          maxWidth: 400,
          marginBottom: 24,
          opacity: formDisabled ? 0.7 : 1,
          pointerEvents: formDisabled ? "none" : "auto",
        }}
      >
        <label>
          SKU
          <input
            value={sku}
            onChange={(e) => setSku(e.target.value)}
            type="text"
            required
            placeholder="e.g. SKU-001"
            style={{ width: "100%", padding: 8, marginTop: 4 }}
            disabled={formDisabled}
          />
        </label>

        {hasToken && (
          <div style={{ marginTop: -4, marginBottom: 4 }}>
            <label style={{ fontSize: 14, color: "#666" }}>Suggested SKUs</label>
            {loadingSuggestions && (
              <span style={{ display: "block", fontSize: 13, color: "#666", marginTop: 4 }}>
                Loading suggestions…
              </span>
            )}
            {suggestionsError && (
              <span style={{ display: "block", fontSize: 13, color: "#b45309", marginTop: 4 }}>
                {suggestionsError}
              </span>
            )}
            {!loadingSuggestions && !suggestionsError && suggestedSkusList.length === 0 && (
              <span style={{ display: "block", fontSize: 13, color: "#666", marginTop: 4 }}>
                No suggestions available
              </span>
            )}
            {!loadingSuggestions && suggestedSkusList.length > 0 && (
              <select
                value=""
                onChange={(e) => {
                  const v = e.target.value;
                  if (v) setSku(v);
                }}
                style={{ width: "100%", padding: 8, marginTop: 4 }}
                aria-label="Choose a suggested SKU"
              >
                <option value="">Choose a suggestion…</option>
                {suggestedSkusList.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}

        <label>
          Marketplace
          <select
            value={marketplace}
            onChange={(e) => setMarketplace(e.target.value)}
            style={{ width: "100%", padding: 8, marginTop: 4 }}
            disabled={formDisabled}
          >
            {MARKETPLACE_OPTIONS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>

        <label>
          Lead time (days)
          <input
            value={leadTimeDays}
            onChange={(e) => setLeadTimeDays(Number(e.target.value))}
            type="number"
            min={1}
            max={365}
            required
            style={{ width: "100%", padding: 8, marginTop: 4 }}
            disabled={formDisabled}
          />
        </label>

        <label>
          Service level
          <select
            value={serviceLevel}
            onChange={(e) => setServiceLevel(Number(e.target.value))}
            style={{ width: "100%", padding: 8, marginTop: 4 }}
            disabled={formDisabled}
          >
            {SERVICE_LEVEL_OPTIONS.map(({ value, label }) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>

        <label>
          Current inventory (units)
          <input
            value={currentInventoryStr}
            onChange={(e) => setCurrentInventoryStr(e.target.value)}
            type="number"
            min={0}
            placeholder="Leave blank if unknown"
            style={{ width: "100%", padding: 8, marginTop: 4 }}
            disabled={formDisabled}
          />
        </label>

        <button type="submit" disabled={loading || formDisabled} style={{ padding: 10 }}>
          {loading ? "Generating..." : "Generate Plan"}
        </button>
      </form>

      {error && (
        <Card>
          <EmptyState
            title="Something went wrong"
            description={error}
            action={
              <button
                type="button"
                onClick={() => setError(null)}
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
      )}

      {result && (() => {
        const orderByDate = result.days_of_cover != null && result.days_of_cover < result.lead_time_days
          ? todayISO()
          : todayISO();
        const daysOfDemandCovered = result.avg_daily_demand > 0
          ? Math.round((result.reorder_quantity / result.avg_daily_demand) * 10) / 10
          : 0;
        const stockout = stockoutRisk(result.days_of_cover, result.lead_time_days, orderByDate);
        const overstock = overstockRisk(result.reorder_quantity, result.lead_time_demand);
        return (
        <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
          <Card>
            <div style={{ padding: "var(--space-6)" }}>
              <h3 style={{ margin: "0 0 var(--space-4)", fontSize: "var(--text-lg)", fontWeight: "var(--font-semibold)", color: "var(--color-text)" }}>
                Action Summary
              </h3>
              <p style={{ margin: "0 0 var(--space-4)", fontSize: "var(--text-xl)", fontWeight: "var(--font-semibold)", color: "var(--color-primary)" }}>
                Order {formatDecimal(result.reorder_quantity, 0)} units by {orderByDate}
              </p>
              <p style={{ margin: "0 0 var(--space-4)", fontSize: "var(--text-sm)", color: "var(--color-text-muted)" }}>
                Covers ~{daysOfDemandCovered} days of demand
              </p>
              <ul style={{ margin: 0, paddingLeft: "var(--space-6)", fontSize: "var(--text-sm)", color: "var(--color-text-muted)" }}>
                <li>Lead time: {result.lead_time_days} days</li>
                <li>Service level: {result.service_level}</li>
                <li>Data through: {result.data_end_date}</li>
              </ul>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-4)", marginTop: "var(--space-4)" }}>
                <div>
                  <span style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)", marginRight: "var(--space-2)" }}>Stockout risk:</span>
                  <span
                    style={{
                      padding: "var(--space-1) var(--space-2)",
                      borderRadius: "var(--radius-sm)",
                      fontSize: "var(--text-xs)",
                      fontWeight: "var(--font-medium)",
                      ...(stockout === "High" && { background: "var(--color-error-muted)", color: "var(--color-error)" }),
                      ...(stockout === "Medium" && { background: "var(--color-warning-muted)", color: "var(--color-warning)" }),
                      ...(stockout === "Low" && { background: "var(--color-success-muted)", color: "var(--color-success)" }),
                    }}
                  >
                    {stockout}
                  </span>
                </div>
                <div>
                  <span style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)", marginRight: "var(--space-2)" }}>Overstock risk:</span>
                  <span
                    style={{
                      padding: "var(--space-1) var(--space-2)",
                      borderRadius: "var(--radius-sm)",
                      fontSize: "var(--text-xs)",
                      fontWeight: "var(--font-medium)",
                      ...(overstock === "High" && { background: "var(--color-error-muted)", color: "var(--color-error)" }),
                      ...(overstock === "Medium" && { background: "var(--color-warning-muted)", color: "var(--color-warning)" }),
                      ...(overstock === "Low" && { background: "var(--color-success-muted)", color: "var(--color-success)" }),
                    }}
                  >
                    {overstock}
                  </span>
                </div>
              </div>
            </div>
          </Card>

          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <div
              style={{
                fontSize: "var(--text-xl)",
                fontWeight: "var(--font-bold)",
                padding: "var(--space-4)",
                background: "var(--color-primary-muted)",
                borderRadius: "var(--radius-md)",
                display: "inline-block",
              }}
            >
              Recommended reorder quantity: {formatDecimal(result.reorder_quantity, 0)}
            </div>
            <button
              type="button"
              onClick={copyPlanToClipboard}
              style={{
                padding: "var(--space-2) var(--space-4)",
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius-md)",
                backgroundColor: "var(--color-bg-elevated)",
                fontWeight: "var(--font-medium)",
                cursor: "pointer",
              }}
            >
              Copy plan
            </button>
            {copiedFeedback && (
              <span style={{ fontSize: "var(--text-sm)", color: "var(--color-success)" }}>Copied!</span>
            )}
          </div>

          <table style={{ width: "100%", maxWidth: 480, borderCollapse: "collapse" }}>
            <tbody>
              <tr style={{ borderBottom: "1px solid var(--color-border)" }}>
                <td style={{ padding: "var(--space-2) var(--space-3)", color: "var(--color-text-muted)" }}>Avg daily demand</td>
                <td style={{ padding: "var(--space-2) var(--space-3)" }}>{formatDecimal(result.avg_daily_demand, 2)}</td>
              </tr>
              <tr style={{ borderBottom: "1px solid var(--color-border)" }}>
                <td style={{ padding: "var(--space-2) var(--space-3)", color: "var(--color-text-muted)" }}>Lead-time demand</td>
                <td style={{ padding: "var(--space-2) var(--space-3)" }}>{formatDecimal(result.lead_time_demand, 2)}</td>
              </tr>
              <tr style={{ borderBottom: "1px solid var(--color-border)" }}>
                <td style={{ padding: "var(--space-2) var(--space-3)", color: "var(--color-text-muted)" }}>Safety stock</td>
                <td style={{ padding: "var(--space-2) var(--space-3)" }}>{formatDecimal(result.safety_stock, 2)}</td>
              </tr>
              <tr style={{ borderBottom: "1px solid var(--color-border)" }}>
                <td style={{ padding: "var(--space-2) var(--space-3)", color: "var(--color-text-muted)" }}>MAPE 30d</td>
                <td style={{ padding: "var(--space-2) var(--space-3)" }}>
                  <ForecastQualityBadge mape_30d={result.mape_30d} />{" "}
                  ({formatDecimal(result.mape_30d, 2)})
                </td>
              </tr>
              <tr style={{ borderBottom: "1px solid var(--color-border)" }}>
                <td style={{ padding: "var(--space-2) var(--space-3)", color: "var(--color-text-muted)" }}>Data end date</td>
                <td style={{ padding: "var(--space-2) var(--space-3)" }}>{result.data_end_date}</td>
              </tr>
            </tbody>
          </table>

          <div
            style={{
              marginTop: "var(--space-6)",
              padding: "var(--space-4)",
              background: "var(--color-bg-muted)",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--color-border)",
              maxWidth: 480,
            }}
          >
            <strong>Stockout estimate</strong>
            {result.days_of_cover != null && result.expected_stockout_date != null ? (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 14 }}>
                  Days of cover: {result.days_of_cover.toFixed(1)} days
                </div>
                <div style={{ fontSize: 14, marginTop: 4 }}>
                  Expected stockout date: {result.expected_stockout_date}
                </div>
                {result.stockout_before_lead_time === true ? (
                  <p
                    style={{
                      margin: "var(--space-3) 0 0 0",
                      padding: "var(--space-2) var(--space-3)",
                      background: "var(--color-warning-muted)",
                      borderRadius: "var(--radius-md)",
                      color: "var(--color-warning)",
                      fontWeight: "var(--font-semibold)",
                    }}
                  >
                    ⚠ Stockout before lead time — reorder urgently.
                  </p>
                ) : result.stockout_before_lead_time === false ? (
                  <p style={{ margin: "var(--space-3) 0 0 0", fontSize: "var(--text-sm)", color: "var(--color-success)" }}>
                    Stock should cover the lead time.
                  </p>
                ) : null}
              </div>
            ) : (
              <p style={{ margin: "var(--space-3) 0 0 0", fontSize: "var(--text-sm)", color: "var(--color-text-muted)" }}>
                {lastSubmittedWithInventory
                  ? "Not enough demand signal to estimate stockout."
                  : "Add current inventory to estimate stockout date."}
              </p>
            )}
          </div>

          <div
            style={{
              padding: "var(--space-4)",
              background: "var(--color-bg-muted)",
              borderRadius: "var(--radius-md)",
              fontSize: "var(--text-sm)",
              maxWidth: 520,
              border: "1px solid var(--color-border)",
            }}
          >
            <strong>How this is calculated</strong>
            <ul style={{ margin: "var(--space-2) 0 0 0", paddingLeft: "var(--space-6)" }}>
              <li>Lead-time demand = Avg daily demand × Lead time days</li>
              <li>Safety stock = Service level buffer (z-score) × sqrt(Avg daily demand × Lead time days)</li>
              <li>Recommended reorder quantity = ceil(Lead-time demand + Safety stock)</li>
            </ul>
          </div>
        </div>
        );
      })()}
    </section>
  );
}
