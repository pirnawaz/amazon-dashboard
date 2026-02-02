import type { ReactNode } from "react";

type Props = {
  /** Number of skeleton blocks to show. Default 1. */
  count?: number;
  /** Custom content instead of blocks. */
  children?: ReactNode;
};

function SkeletonBlock() {
  return (
    <div
      style={{
        height: 24,
        borderRadius: "var(--radius-sm)",
        backgroundColor: "var(--color-border)",
        animation: "skeleton-pulse 1.5s ease-in-out infinite",
      }}
    />
  );
}

export default function LoadingSkeleton({
  count = 1,
  children,
}: Props) {
  if (children != null) {
    return <div className="loading-skeleton">{children}</div>;
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-3)",
      }}
    >
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonBlock key={i} />
      ))}
    </div>
  );
}
