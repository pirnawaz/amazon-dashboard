import type { ForecastIntelligence } from "../../api";
import Card from "../ui/Card";
import {
  formatDailyDemand,
  formatForecastTotal,
  formatCommas,
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
  red: {
    dot: "🔴",
    bg: "var(--color-error-muted)",
    text: "var(--color-error)",
  },
  yellow: {
    dot: "🟡",
    bg: "var(--color-warning-muted)",
    text: "var(--color-warning)",
  },
  green: {
    dot: "🟢",
    bg: "var(--color-success-muted)",
    text: "var(--color-success)",
  },
} as const;

type Props = {
  title: string;
  intelligence: ForecastIntelligence;
  horizonDays: number;
  recommendation: string;
  reasoning: string[];
};

export default function ForecastSummaryCard({
  title,
  intelligence,
  horizonDays,
  recommendation,
  reasoning,
}: Props) {
  const { trend, confidence, daily_demand_estimate, forecast_range } =
    intelligence;
  const status = getStatusColor(trend, confidence);
  const statusStyle = STATUS_STYLES[status];

  const rangeLabel = `${formatCommas(forecast_range.low, 0)}–${formatCommas(forecast_range.high, 0)} (${formatForecastTotal(forecast_range.expected, true)} expected)`;

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
          <span style={{ fontSize: "var(--text-lg)", fontWeight: "var(--font-semibold)", color: "var(--color-text)" }}>
            {title}
          </span>
          <span
            style={{
              padding: "2px 6px",
              borderRadius: "var(--radius-sm)",
              backgroundColor: statusStyle.bg,
              color: statusStyle.text,
              fontSize: "var(--text-xs)",
              fontWeight: "var(--font-medium)",
            }}
            title={`Status: ${status}`}
          >
            {statusStyle.dot}
          </span>
        </div>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "var(--space-2)",
            marginBottom: "var(--space-4)",
          }}
        >
          <span
            style={{
              padding: "var(--space-1) var(--space-2)",
              borderRadius: "var(--radius-sm)",
              backgroundColor: "var(--color-bg-muted)",
              fontSize: "var(--text-xs)",
              color: "var(--color-text)",
            }}
          >
            Trend: {formatTrendLabel(trend)}
          </span>
          <span
            style={{
              padding: "var(--space-1) var(--space-2)",
              borderRadius: "var(--radius-sm)",
              backgroundColor: "var(--color-bg-muted)",
              fontSize: "var(--text-xs)",
              color: "var(--color-text)",
            }}
          >
            Confidence: {formatConfidenceLabel(confidence)}
          </span>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-2)",
            fontSize: "var(--text-sm)",
            color: "var(--color-text)",
            marginBottom: "var(--space-4)",
          }}
        >
          <p style={{ margin: 0 }}>
            <strong>Expected demand:</strong> {formatDailyDemand(daily_demand_estimate)}/day
          </p>
          <p style={{ margin: 0, color: "var(--color-text-muted)" }}>
            <strong>{horizonDays}d range:</strong> {rangeLabel}
          </p>
        </div>

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
