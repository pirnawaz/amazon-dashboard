import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  className?: string;
};

export default function Card({ children, className = "" }: Props) {
  return (
    <div
      className={`card ${className}`.trim()}
      style={{
        backgroundColor: "var(--color-bg-elevated)",
        borderRadius: "var(--radius-lg)",
        boxShadow: "var(--shadow-sm)",
        border: "1px solid var(--color-border)",
        overflow: "hidden",
      }}
    >
      {children}
    </div>
  );
}
