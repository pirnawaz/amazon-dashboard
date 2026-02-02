import type { ReactNode } from "react";

type Props = {
  title: string;
  subtitle?: string;
  /** Display "Data through: YYYY-MM-DD" when provided (e.g. from data_end_date). */
  dataThroughDate?: string;
  actions?: ReactNode;
  children: ReactNode;
};

export default function ChartContainer({
  title,
  subtitle,
  dataThroughDate,
  actions,
  children,
}: Props) {
  const dataThroughLine =
    dataThroughDate != null ? `Data through: ${dataThroughDate}` : null;
  const combinedSubtitle = [subtitle, dataThroughLine].filter(Boolean).join(" · ") || undefined;

  return (
    <div
      style={{
        padding: "var(--space-6)",
        backgroundColor: "var(--color-bg-elevated)",
        borderRadius: "var(--radius-lg)",
        border: "1px solid var(--color-border)",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: "var(--space-2)",
          marginBottom: "var(--space-4)",
        }}
      >
        <div>
          <h3
            style={{
              margin: 0,
              fontSize: "var(--text-lg)",
              fontWeight: "var(--font-semibold)",
              color: "var(--color-text)",
            }}
          >
            {title}
          </h3>
          {combinedSubtitle != null && (
            <p
              style={{
                margin: "var(--space-1) 0 0",
                fontSize: "var(--text-sm)",
                color: "var(--color-text-muted)",
              }}
            >
              {combinedSubtitle}
            </p>
          )}
        </div>
        {actions != null && <div>{actions}</div>}
      </div>
      <div style={{ minHeight: 200 }}>{children}</div>
    </div>
  );
}
