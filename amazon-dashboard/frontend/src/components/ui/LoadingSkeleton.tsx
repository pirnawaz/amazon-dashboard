import type { ReactNode } from "react";
import type { CSSProperties } from "react";

type Props = {
  /** Number of skeleton blocks to show. Default 1. */
  count?: number;
  /** Alias for count (table rows). */
  rows?: number;
  /** Alias for count (text lines). */
  lines?: number;
  /** Height of skeleton block in px (default 24). */
  height?: number;
  /** Optional wrapper style. */
  style?: CSSProperties;
  /** Custom content instead of blocks. */
  children?: ReactNode;
};

function SkeletonBlock({ height = 24 }: { height?: number }) {
  return (
    <div
      style={{
        height,
        borderRadius: "var(--radius-sm)",
        backgroundColor: "var(--color-border)",
        animation: "skeleton-pulse 1.5s ease-in-out infinite",
      }}
    />
  );
}

export default function LoadingSkeleton({
  count: countProp,
  rows,
  lines,
  height = 24,
  style,
  children,
}: Props) {
  const count = countProp ?? rows ?? lines ?? 1;
  if (children != null) {
    return <div className="loading-skeleton" style={style}>{children}</div>;
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-3)",
        ...style,
      }}
    >
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonBlock key={i} height={height} />
      ))}
    </div>
  );
}
