import Tooltip from "../ui/Tooltip";

const TOOLTIP_CONTENT =
  "Forecast quality is based on backtest accuracy (MAPE). Great: ≤15% error. Good: 15–25%. Watch: 25–40%. Poor: >40%. Lower is better.";

export type ForecastQualityLevel = "Great" | "Good" | "Watch" | "Poor" | "No backtest data";

export type ForecastQualityBadgeProps = {
  mape_30d: number | null | undefined;
  mae_30d?: number | null;
  backtest_points_count?: number | null;
};

function getQualityFromMape(mape: number): { level: ForecastQualityLevel; style: React.CSSProperties } {
  if (mape <= 0.15)
    return {
      level: "Great",
      style: {
        padding: "var(--space-1) var(--space-2)",
        background: "var(--color-success-muted)",
        borderRadius: "var(--radius-sm)",
        color: "var(--color-success)",
        fontSize: "var(--text-xs)",
        fontWeight: "var(--font-medium)",
      },
    };
  if (mape <= 0.25)
    return {
      level: "Good",
      style: {
        padding: "var(--space-1) var(--space-2)",
        background: "var(--color-accent-muted)",
        borderRadius: "var(--radius-sm)",
        color: "var(--color-accent)",
        fontSize: "var(--text-xs)",
        fontWeight: "var(--font-medium)",
      },
    };
  if (mape <= 0.4)
    return {
      level: "Watch",
      style: {
        padding: "var(--space-1) var(--space-2)",
        background: "var(--color-warning-muted)",
        borderRadius: "var(--radius-sm)",
        color: "var(--color-warning)",
        fontSize: "var(--text-xs)",
        fontWeight: "var(--font-medium)",
      },
    };
  return {
    level: "Poor",
    style: {
      padding: "var(--space-1) var(--space-2)",
      background: "var(--color-error-muted)",
      borderRadius: "var(--radius-sm)",
      color: "var(--color-error)",
      fontSize: "var(--text-xs)",
      fontWeight: "var(--font-medium)",
    },
  };
}

export default function ForecastQualityBadge({
  mape_30d,
  mae_30d,
  backtest_points_count,
}: ForecastQualityBadgeProps) {
  const hasMape = mape_30d != null && !Number.isNaN(mape_30d);
  const hasBacktest = hasMape && (backtest_points_count == null || backtest_points_count > 0);

  if (!hasBacktest) {
    return (
      <span
        style={{
          padding: "var(--space-1) var(--space-2)",
          background: "var(--color-bg-muted)",
          borderRadius: "var(--radius-sm)",
          color: "var(--color-text-muted)",
          fontSize: "var(--text-xs)",
          fontWeight: "var(--font-medium)",
        }}
      >
        No backtest data
      </span>
    );
  }

  const { level, style } = getQualityFromMape(mape_30d as number);

  return (
    <Tooltip content={TOOLTIP_CONTENT}>
      <span style={style}>{level}</span>
    </Tooltip>
  );
}
