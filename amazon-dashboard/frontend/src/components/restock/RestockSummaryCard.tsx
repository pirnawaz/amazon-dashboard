import { useState, useCallback } from "react";
import type { RestockActionItem } from "../../api";
import Card from "../ui/Card";
import StatusBadge from "./StatusBadge";
import { formatDecimal, formatShortDate } from "../../utils/format";
import { copyToClipboard } from "../../utils/clipboard";
import { buildRestockPlanText } from "../../utils/restockPlanText";

type Props = {
  title: string;
  item: RestockActionItem;
};

const FEEDBACK_DURATION_MS = 1500;

export default function RestockSummaryCard({ title, item }: Props) {
  const [copyFeedback, setCopyFeedback] = useState<"idle" | "copied" | "failed">("idle");

  const handleCopy = useCallback(async () => {
    const text = buildRestockPlanText(item);
    const ok = await copyToClipboard(text);
    setCopyFeedback(ok ? "copied" : "failed");
    setTimeout(() => setCopyFeedback("idle"), FEEDBACK_DURATION_MS);
  }, [item]);

  const {
    status,
    days_of_cover_expected,
    stockout_date_expected,
    order_by_date,
    suggested_reorder_qty_expected,
    suggested_reorder_qty_high,
    recommendation,
    reasoning,
  } = item;

  return (
    <Card>
      <div style={{ padding: "var(--space-6)" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--space-2)",
            marginBottom: "var(--space-4)",
          }}
        >
          <span
            style={{
              fontSize: "var(--text-lg)",
              fontWeight: "var(--font-semibold)",
              color: "var(--color-text)",
            }}
          >
            {title}
          </span>
          <StatusBadge status={status} />
        </div>

        {status !== "insufficient_data" && (
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "var(--space-4)",
              marginBottom: "var(--space-4)",
              fontSize: "var(--text-sm)",
              color: "var(--color-text)",
            }}
          >
            {days_of_cover_expected != null && (
              <span>
                <strong>Days of cover (expected):</strong>{" "}
                {formatDecimal(days_of_cover_expected, 1)}
              </span>
            )}
            {stockout_date_expected && (
              <span>
                <strong>Stockout date (expected):</strong>{" "}
                {formatShortDate(stockout_date_expected)}
              </span>
            )}
            {order_by_date && (
              <span>
                <strong>Order by:</strong> {formatShortDate(order_by_date)}
              </span>
            )}
            <span>
              <strong>Suggested reorder:</strong>{" "}
              {formatDecimal(suggested_reorder_qty_expected, 0)} units (expected),{" "}
              {formatDecimal(suggested_reorder_qty_high, 0)} units (high)
            </span>
          </div>
        )}

        <p
          style={{
            margin: "0 0 var(--space-4)",
            fontSize: "var(--text-sm)",
            color: "var(--color-text)",
            lineHeight: 1.5,
          }}
        >
          <strong>Recommendation:</strong> {recommendation}
        </p>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--space-2)",
            marginBottom: "var(--space-4)",
          }}
        >
          <button
            type="button"
            onClick={handleCopy}
            style={{
              padding: "var(--space-2) var(--space-3)",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-md)",
              backgroundColor: "var(--color-bg-elevated)",
              fontSize: "var(--text-sm)",
              fontWeight: "var(--font-medium)",
              cursor: "pointer",
              color: "var(--color-text)",
            }}
          >
            Copy plan
          </button>
          {copyFeedback === "copied" && (
            <span style={{ fontSize: "var(--text-xs)", color: "var(--color-success)" }}>
              Copied
            </span>
          )}
          {copyFeedback === "failed" && (
            <span style={{ fontSize: "var(--text-xs)", color: "var(--color-error)" }}>
              Copy failed
            </span>
          )}
        </div>

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
            Why?
          </summary>
          <ul
            style={{
              margin: "var(--space-2) 0 0",
              paddingLeft: "var(--space-6)",
              lineHeight: 1.6,
            }}
          >
            {reasoning.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </details>
      </div>
    </Card>
  );
}
