import type { ReactNode } from "react";
import EmptyState from "./EmptyState";

type Column<T> = {
  key: keyof T | string;
  header: string | ReactNode;
  align?: "left" | "right";
  render?: (row: T) => ReactNode;
};

type Props<T> = {
  columns: Column<T>[];
  data: T[];
  getRowKey: (row: T) => string;
  emptyMessage?: string;
  emptyTitle?: string;
  emptyDescription?: string;
  stickyHeader?: boolean;
  rowClickable?: boolean;
  onRowClick?: (row: T) => void;
};

export default function Table<T extends object>({
  columns,
  data,
  getRowKey,
  emptyMessage = "No data to display.",
  emptyTitle,
  emptyDescription,
  stickyHeader = false,
  rowClickable = false,
  onRowClick,
}: Props<T>) {
  if (data.length === 0) {
    return (
      <div
        style={{
          padding: "var(--space-6)",
          minHeight: 120,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {emptyTitle != null ? (
          <EmptyState
            title={emptyTitle}
            description={emptyDescription ?? emptyMessage}
          />
        ) : (
          <p
            style={{
              margin: 0,
              textAlign: "center",
              color: "var(--color-text-muted)",
              fontSize: "var(--text-sm)",
            }}
          >
            {emptyMessage}
          </p>
        )}
      </div>
    );
  }

  return (
    <div style={{ overflowX: "auto" }}>
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          minWidth: 500,
          fontSize: "var(--text-sm)",
        }}
        role="grid"
        aria-label="Data table"
      >
        <thead>
          <tr
            style={{
              borderBottom: "2px solid var(--color-border-strong)",
              textAlign: "left",
              backgroundColor: "var(--color-bg-muted)",
              ...(stickyHeader && {
                position: "sticky",
                top: 0,
                zIndex: 1,
                boxShadow: "0 1px 0 var(--color-border)",
              }),
            }}
          >
            {columns.map((col) => (
              <th
                key={String(col.key)}
                style={{
                  padding: "var(--space-3) var(--space-4)",
                  fontWeight: "var(--font-semibold)",
                  color: "var(--color-text)",
                  textAlign: col.align ?? "left",
                  backgroundColor: "var(--color-bg-muted)",
                }}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr
              key={getRowKey(row)}
              style={{
                borderBottom: "1px solid var(--color-border)",
                cursor: rowClickable || onRowClick ? "pointer" : undefined,
              }}
              className="table-row-hover"
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              role={onRowClick ? "button" : undefined}
            >
              {columns.map((col) => (
                <td
                  key={String(col.key)}
                  style={{
                    padding: "var(--space-3) var(--space-4)",
                    color: "var(--color-text)",
                    textAlign: col.align ?? "left",
                  }}
                >
                  {col.render != null
                    ? col.render(row)
                    : String((row as Record<string, unknown>)[col.key as string] ?? "—")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
