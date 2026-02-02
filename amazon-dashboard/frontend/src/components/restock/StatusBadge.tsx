import type { RestockActionStatus } from "../../api";

const STATUS_STYLES: Record<
  RestockActionStatus,
  { dot: string; bg: string; text: string; label: string }
> = {
  healthy: {
    dot: "🟢",
    bg: "var(--color-success-muted)",
    text: "var(--color-success)",
    label: "healthy",
  },
  watch: {
    dot: "🟡",
    bg: "var(--color-warning-muted)",
    text: "var(--color-warning)",
    label: "watch",
  },
  urgent: {
    dot: "🔴",
    bg: "var(--color-error-muted)",
    text: "var(--color-error)",
    label: "urgent",
  },
  insufficient_data: {
    dot: "⚪",
    bg: "var(--color-bg-muted)",
    text: "var(--color-text-muted)",
    label: "insufficient data",
  },
};

type Props = {
  status: RestockActionStatus;
  showLabel?: boolean;
};

export default function StatusBadge({ status, showLabel = true }: Props) {
  const style = STATUS_STYLES[status];
  return (
    <span
      style={{
        padding: "var(--space-1) var(--space-2)",
        borderRadius: "var(--radius-sm)",
        backgroundColor: style.bg,
        color: style.text,
        fontSize: "var(--text-xs)",
        fontWeight: "var(--font-medium)",
        display: "inline-flex",
        alignItems: "center",
        gap: "var(--space-1)",
      }}
    >
      <span>{style.dot}</span>
      {showLabel && <span>{style.label}</span>}
    </span>
  );
}
