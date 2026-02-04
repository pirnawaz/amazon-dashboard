import { useMemo, useState } from "react";
import type { ForecastResponse, ForecastIntelligence } from "../../api";
import Table from "../ui/Table";
import {
  formatDailyDemand,
  formatCommas,
  formatForecastTotal,
} from "../../utils/format";

type TrendType = ForecastIntelligence["trend"];
type ConfidenceType = ForecastIntelligence["confidence"];

function getStatusColor(
  trend: TrendType,
  confidence: ConfidenceType
): "red" | "yellow" | "green" {
  if (confidence === "low") return "red";
  if (trend === "decreasing" && confidence !== "high") return "yellow";
  return "green";
}

function formatTrendLabel(trend: TrendType): string {
  return trend.replace(/_/g, " ");
}

function formatConfidenceLabel(c: ConfidenceType): string {
  return c.charAt(0).toUpperCase() + c.slice(1);
}

const STATUS_STYLES = {
  red: { dot: "🔴" },
  yellow: { dot: "🟡" },
  green: { dot: "🟢" },
} as const;

export type ForecastTableRow = {
  id: string;
  name: string;
  forecast: ForecastResponse;
};

type SortKey = "confidence" | "expected" | "name";

const CONFIDENCE_ORDER: Record<ConfidenceType, number> = { high: 0, medium: 1, low: 2 };

function sortRows(rows: ForecastTableRow[], sortKey: SortKey, asc: boolean): ForecastTableRow[] {
  const sorted = [...rows].sort((a, b) => {
    const ia = a.forecast.intelligence;
    const ib = b.forecast.intelligence;
    switch (sortKey) {
      case "name":
        return a.name.localeCompare(b.name);
      case "confidence":
        return CONFIDENCE_ORDER[ia.confidence] - CONFIDENCE_ORDER[ib.confidence];
      case "expected":
        return ia.daily_demand_estimate - ib.daily_demand_estimate;
      default:
        return 0;
    }
  });
  return asc ? sorted : sorted.reverse();
}

type Props = {
  rows: ForecastTableRow[];
};

export default function ForecastTable({ rows: initialRows }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("expected");
  const [sortAsc, setSortAsc] = useState(false);

  const sortedRows = useMemo(
    () => sortRows(initialRows, sortKey, sortAsc),
    [initialRows, sortKey, sortAsc]
  );

  const columns = [
    {
      key: "name",
      header: (
        <SortableHeader
          label="Name"
          active={sortKey === "name"}
          asc={sortAsc}
          onClick={() => {
            setSortKey("name");
            setSortAsc(sortKey === "name" ? !sortAsc : true);
          }}
        />
      ),
      render: (row: ForecastTableRow) => row.name,
    },
    {
      key: "trend",
      header: "Trend",
      render: (row: ForecastTableRow) => {
        const t = row.forecast.intelligence.trend;
        return (
          <span
            style={{
              padding: "2px 6px",
              borderRadius: "var(--radius-sm)",
              backgroundColor: "var(--color-bg-muted)",
              fontSize: "var(--text-xs)",
            }}
          >
            {formatTrendLabel(t)}
          </span>
        );
      },
    },
    {
      key: "confidence",
      header: (
        <SortableHeader
          label="Confidence"
          active={sortKey === "confidence"}
          asc={sortAsc}
          onClick={() => {
            setSortKey("confidence");
            setSortAsc(sortKey === "confidence" ? !sortAsc : true);
          }}
        />
      ),
      render: (row: ForecastTableRow) => {
        const { trend, confidence } = row.forecast.intelligence;
        const status = getStatusColor(trend, confidence);
        return (
          <span style={{ display: "flex", alignItems: "center", gap: "var(--space-1)" }}>
            <span>{STATUS_STYLES[status].dot}</span>
            <span>{formatConfidenceLabel(confidence)}</span>
          </span>
        );
      },
    },
    {
      key: "expected",
      header: (
        <SortableHeader
          label="Expected"
          active={sortKey === "expected"}
          asc={sortAsc}
          onClick={() => {
            setSortKey("expected");
            setSortAsc(sortKey === "expected" ? !sortAsc : true);
          }}
        />
      ),
      align: "right" as const,
      render: (row: ForecastTableRow) =>
        formatDailyDemand(row.forecast.intelligence.daily_demand_estimate),
    },
    {
      key: "range",
      header: "Range",
      align: "right" as const,
      render: (row: ForecastTableRow) => {
        const r = row.forecast.intelligence.forecast_range;
        return `${formatCommas(r.low, 0)}–${formatCommas(r.high, 0)}`;
      },
    },
    {
      key: "recommendation",
      header: "Recommendation",
      render: (row: ForecastTableRow) => (
        <span
          style={{
            maxWidth: 280,
            display: "block",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
          title={row.forecast.recommendation}
        >
          {row.forecast.recommendation}
        </span>
      ),
    },
    {
      key: "why",
      header: "Why?",
      render: (row: ForecastTableRow) => (
        <ExpandableReasoning reasoning={row.forecast.reasoning ?? []} />
      ),
    },
  ];

  return (
    <Table
      columns={columns}
      data={sortedRows}
      getRowKey={(row) => row.id}
      emptyTitle="No forecast data"
      emptyDescription="Load a total or SKU forecast to see the table."
    />
  );
}

function SortableHeader({
  label,
  active,
  asc,
  onClick,
}: {
  label: string;
  active: boolean;
  asc: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        background: "none",
        border: "none",
        padding: 0,
        font: "inherit",
        color: "inherit",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        gap: "var(--space-1)",
      }}
    >
      {label}
      <span style={{ opacity: active ? 1 : 0.4 }}>
        {asc ? "↑" : "↓"}
      </span>
    </button>
  );
}

function ExpandableReasoning({ reasoning }: { reasoning: string[] }) {
  const [open, setOpen] = useState(false);
  return (
    <details
      open={open}
      onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}
    >
      <summary
        style={{
          cursor: "pointer",
          fontSize: "var(--text-sm)",
          color: "var(--color-primary)",
        }}
        onClick={(e) => {
          e.preventDefault();
          setOpen(!open);
        }}
      >
        {open ? "Hide" : "Show"}
      </summary>
      {open && (
        <ul
          style={{
            margin: "var(--space-2) 0 0",
            paddingLeft: "var(--space-4)",
            fontSize: "var(--text-xs)",
            color: "var(--color-text-muted)",
            lineHeight: 1.5,
          }}
        >
          {reasoning.map((r, i) => (
            <li key={i}>{r}</li>
          ))}
        </ul>
      )}
    </details>
  );
}
