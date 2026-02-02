import type { ReactNode } from "react";

type Delta = {
  value: string | number;
  trend?: "up" | "down" | "neutral";
};

type Props = {
  label: string;
  value: string | number;
  delta?: Delta;
};

function formatDeltaTrend(trend?: Delta["trend"]): string {
  if (trend === "up") return "↑";
  if (trend === "down") return "↓";
  return "";
}

export default function Metric({ label, value, delta }: Props) {
  const deltaColor =
    delta?.trend === "up"
      ? "var(--color-success)"
      : delta?.trend === "down"
        ? "var(--color-error)"
        : "var(--color-text-muted)";

  return (
    <div
      style={{
        padding: "var(--space-4)",
        backgroundColor: "var(--color-bg-elevated)",
        borderRadius: "var(--radius-md)",
        border: "1px solid var(--color-border)",
      }}
    >
      <div
        style={{
          fontSize: "var(--text-sm)",
          color: "var(--color-text-muted)",
          marginBottom: "var(--space-1)",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: "var(--text-xl)",
          fontWeight: "var(--font-semibold)",
          color: "var(--color-text)",
        }}
      >
        {value}
      </div>
      {delta != null && (
        <div
          style={{
            fontSize: "var(--text-xs)",
            color: deltaColor,
            marginTop: "var(--space-1)",
          }}
        >
          {formatDeltaTrend(delta.trend)} {delta.value}
        </div>
      )}
    </div>
  );
}
