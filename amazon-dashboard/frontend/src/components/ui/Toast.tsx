import { useEffect, type ReactNode } from "react";

export type ToastVariant = "success" | "error" | "info";

type Props = {
  message: ReactNode;
  variant?: ToastVariant;
  onDismiss: () => void;
  duration?: number;
};

const variantStyles: Record<ToastVariant, React.CSSProperties> = {
  success: {
    backgroundColor: "var(--color-success-muted)",
    borderColor: "var(--color-success)",
    color: "var(--color-text)",
  },
  error: {
    backgroundColor: "var(--color-error-muted)",
    borderColor: "var(--color-error)",
    color: "var(--color-error)",
  },
  info: {
    backgroundColor: "var(--color-bg-elevated)",
    borderColor: "var(--color-border)",
    color: "var(--color-text)",
  },
};

export default function Toast({
  message,
  variant = "info",
  onDismiss,
  duration = 4000,
}: Props) {
  useEffect(() => {
    const id = window.setTimeout(onDismiss, duration);
    return () => window.clearTimeout(id);
  }, [onDismiss, duration]);

  return (
    <div
      role="alert"
      style={{
        padding: "var(--space-3) var(--space-4)",
        borderRadius: "var(--radius-md)",
        border: "1px solid",
        boxShadow: "var(--shadow-lg)",
        fontSize: "var(--text-sm)",
        ...variantStyles[variant],
      }}
    >
      {message}
    </div>
  );
}
