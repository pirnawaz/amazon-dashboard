import type { ReactNode } from "react";

type Props = {
  title: string;
  description?: string;
  action?: ReactNode;
};

export default function EmptyState({ title, description, action }: Props) {
  return (
    <div
      style={{
        padding: "var(--space-10)",
        textAlign: "center",
        backgroundColor: "var(--color-bg-muted)",
        borderRadius: "var(--radius-lg)",
        border: "1px dashed var(--color-border-strong)",
      }}
    >
      <p
        style={{
          margin: 0,
          fontSize: "var(--text-base)",
          fontWeight: "var(--font-medium)",
          color: "var(--color-text)",
        }}
      >
        {title}
      </p>
      {description != null && (
        <p
          style={{
            margin: "var(--space-2) 0 0",
            fontSize: "var(--text-sm)",
            color: "var(--color-text-muted)",
          }}
        >
          {description}
        </p>
      )}
      {action != null && (
        <div style={{ marginTop: "var(--space-4)" }}>{action}</div>
      )}
    </div>
  );
}
