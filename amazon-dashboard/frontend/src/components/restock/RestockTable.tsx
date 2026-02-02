import { useMemo, useState, useCallback } from "react";
import type { RestockActionItem, RestockActionStatus } from "../../api";
import Table from "../ui/Table";
import StatusBadge from "./StatusBadge";
import { formatDecimal, formatShortDate } from "../../utils/format";
import { copyToClipboard } from "../../utils/clipboard";
import { buildRestockPlanText } from "../../utils/restockPlanText";

const COPY_FEEDBACK_MS = 1500;

const STATUS_ORDER: Record<RestockActionStatus, number> = {
  urgent: 0,
  watch: 1,
  healthy: 2,
  insufficient_data: 3,
};

/** Phase 11.4: Inventory freshness badge styles */
const FRESHNESS_STYLES: Record<
  "unknown" | "fresh" | "warning" | "critical",
  { bg: string; text: string; label: string }
> = {
  unknown: { bg: "var(--color-bg-muted)", text: "var(--color-text-muted)", label: "—" },
  fresh: { bg: "var(--color-success-muted)", text: "var(--color-success)", label: "Fresh" },
  warning: { bg: "var(--color-warning-muted)", text: "var(--color-warning)", label: "Stale" },
  critical: { bg: "var(--color-error-muted)", text: "var(--color-error)", label: "Critical" },
};

function InventoryFreshnessBadge({
  freshness,
}: {
  freshness: "unknown" | "fresh" | "warning" | "critical" | null | undefined;
}) {
  const f = freshness ?? "unknown";
  const s = FRESHNESS_STYLES[f];
  return (
    <span
      style={{
        padding: "var(--space-1) var(--space-2)",
        borderRadius: "var(--radius-sm)",
        backgroundColor: s.bg,
        color: s.text,
        fontSize: "var(--text-xs)",
        fontWeight: "var(--font-medium)",
      }}
      title={
        freshness === "warning" || freshness === "critical"
          ? "Inventory data is stale; consider syncing FBA inventory."
          : undefined
      }
    >
      {s.label}
    </span>
  );
}

function sortItems(
  items: RestockActionItem[],
  sortBy: "status" | "order_by"
): RestockActionItem[] {
  return [...items].sort((a, b) => {
    if (sortBy === "status") {
      const oa = STATUS_ORDER[a.status];
      const ob = STATUS_ORDER[b.status];
      if (oa !== ob) return oa - ob;
      // Then by order_by_date (earliest first)
      const da = a.order_by_date ?? "9999-12-31";
      const db = b.order_by_date ?? "9999-12-31";
      return da.localeCompare(db);
    }
    const da = a.order_by_date ?? "9999-12-31";
    const db = b.order_by_date ?? "9999-12-31";
    return da.localeCompare(db);
  });
}

type Props = {
  items: RestockActionItem[];
};

function getRowId(row: RestockActionItem): string {
  return row.sku ?? "total";
}

export default function RestockTable({ items: initialItems }: Props) {
  const [sortBy, setSortBy] = useState<"status" | "order_by">("status");
  const [copiedRowId, setCopiedRowId] = useState<{ id: string; status: "copied" | "failed" } | null>(
    null
  );

  const sortedItems = useMemo(
    () => sortItems(initialItems, sortBy),
    [initialItems, sortBy]
  );

  const handleCopyRow = useCallback(async (row: RestockActionItem) => {
    const id = getRowId(row);
    const text = buildRestockPlanText(row);
    const ok = await copyToClipboard(text);
    setCopiedRowId({ id, status: ok ? "copied" : "failed" });
    setTimeout(() => setCopiedRowId(null), COPY_FEEDBACK_MS);
  }, []);

  const columns = [
    {
      key: "name",
      header: "Name",
      render: (row: RestockActionItem) => (row.sku ? row.sku : "Total"),
    },
    {
      key: "status",
      header: "Status",
      render: (row: RestockActionItem) => <StatusBadge status={row.status} />,
    },
    {
      key: "inventory_freshness",
      header: "Inventory",
      render: (row: RestockActionItem) => (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
          <InventoryFreshnessBadge freshness={row.inventory_freshness ?? undefined} />
          {row.inventory_warning_message && (
            <span
              style={{
                fontSize: "var(--text-xs)",
                color: "var(--color-warning)",
                maxWidth: 200,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
              title={row.inventory_warning_message}
            >
              Stale data
            </span>
          )}
        </div>
      ),
    },
    {
      key: "days_of_cover",
      header: "Days of cover",
      align: "right" as const,
      render: (row: RestockActionItem) =>
        row.days_of_cover_expected != null
          ? formatDecimal(row.days_of_cover_expected, 1)
          : "—",
    },
    {
      key: "order_by",
      header: "Order by",
      render: (row: RestockActionItem) =>
        row.order_by_date ? formatShortDate(row.order_by_date) : "—",
    },
    {
      key: "reorder_qty",
      header: "Reorder qty (expected / high)",
      align: "right" as const,
      render: (row: RestockActionItem) =>
        `${formatDecimal(row.suggested_reorder_qty_expected, 0)} / ${formatDecimal(row.suggested_reorder_qty_high, 0)}`,
    },
    {
      key: "recommendation",
      header: "Recommendation",
      render: (row: RestockActionItem) => (
        <span
          style={{
            maxWidth: 280,
            display: "block",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
          title={row.recommendation}
        >
          {row.recommendation}
        </span>
      ),
    },
    {
      key: "why",
      header: "Why?",
      render: (row: RestockActionItem) => (
        <details
          style={{
            fontSize: "var(--text-xs)",
            color: "var(--color-text-muted)",
          }}
        >
          <summary
            style={{
              cursor: "pointer",
              color: "var(--color-primary)",
            }}
          >
            Expand
          </summary>
          <ul
            style={{
              margin: "var(--space-2) 0 0",
              paddingLeft: "var(--space-4)",
              lineHeight: 1.5,
            }}
          >
            {row.reasoning.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </details>
      ),
    },
    {
      key: "copy",
      header: "Copy",
      render: (row: RestockActionItem) => {
        const id = getRowId(row);
        const feedback = copiedRowId?.id === id ? copiedRowId.status : null;
        return (
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
            <button
              type="button"
              onClick={() => handleCopyRow(row)}
              style={{
                padding: "var(--space-1) var(--space-2)",
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius-sm)",
                backgroundColor: "var(--color-bg-elevated)",
                fontSize: "var(--text-xs)",
                fontWeight: "var(--font-medium)",
                cursor: "pointer",
                color: "var(--color-text)",
              }}
            >
              Copy
            </button>
            {feedback === "copied" && (
              <span style={{ fontSize: "var(--text-xs)", color: "var(--color-success)" }}>
                Copied
              </span>
            )}
            {feedback === "failed" && (
              <span style={{ fontSize: "var(--text-xs)", color: "var(--color-error)" }}>
                Copy failed
              </span>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--space-2)",
          marginBottom: "var(--space-3)",
          fontSize: "var(--text-sm)",
          color: "var(--color-text-muted)",
        }}
      >
        <span>Sort by:</span>
        <button
          type="button"
          onClick={() => setSortBy("status")}
          style={{
            padding: "var(--space-1) var(--space-2)",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-sm)",
            background: sortBy === "status" ? "var(--color-bg-muted)" : "transparent",
            cursor: "pointer",
            fontSize: "var(--text-sm)",
          }}
        >
          Status
        </button>
        <button
          type="button"
          onClick={() => setSortBy("order_by")}
          style={{
            padding: "var(--space-1) var(--space-2)",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-sm)",
            background: sortBy === "order_by" ? "var(--color-bg-muted)" : "transparent",
            cursor: "pointer",
            fontSize: "var(--text-sm)",
          }}
        >
          Order by date
        </button>
      </div>
      <Table<RestockActionItem>
        columns={columns}
        data={sortedItems}
        getRowKey={(row) => row.sku ?? "total"}
        emptyTitle="No restock actions"
        emptyDescription="Adjust filters or provide current stock to see actions."
        stickyHeader
      />
    </div>
  );
}
