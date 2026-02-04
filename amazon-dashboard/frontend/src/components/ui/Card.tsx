import type { ReactNode } from "react";
import type { CSSProperties } from "react";

type Props = {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  title?: string;
};

export default function Card({ children, className = "", style, title }: Props) {
  return (
    <div
      className={`card ${className}`.trim()}
      style={{
        backgroundColor: "var(--color-bg-elevated)",
        borderRadius: "var(--radius-lg)",
        boxShadow: "var(--shadow-sm)",
        border: "1px solid var(--color-border)",
        overflow: "hidden",
        ...style,
      }}
      title={title}
    >
      {children}
    </div>
  );
}
