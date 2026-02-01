import { useCallback, useEffect, useState, Fragment } from "react";
import { getAuditLog, type AuditLogEntry } from "../api";
import Card from "../components/ui/Card";
import EmptyState from "../components/ui/EmptyState";
import LoadingSkeleton from "../components/ui/LoadingSkeleton";
import Table from "../components/ui/Table";
import { useAuth } from "../context/AuthContext";

const DEFAULT_LIMIT = 50;

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return iso.slice(0, 19);
  }
}

function formatMetadata(metadata: Record<string, unknown> | null | undefined): string {
  if (metadata == null || Object.keys(metadata).length === 0) return "";
  try {
    return JSON.stringify(metadata, null, 2);
  } catch {
    return String(metadata);
  }
}

export default function AuditLogPage() {
  const { token } = useAuth();
  const [data, setData] = useState<{ items: AuditLogEntry[]; limit: number; offset: number; total: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [offset, setOffset] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const limit = DEFAULT_LIMIT;

  const load = useCallback(() => {
    if (!token) return;
    setLoading(true);
    setError(null);
    setForbidden(false);
    getAuditLog(token, { limit, offset })
      .then(setData)
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : "Failed to load audit log";
        setError(msg);
        setForbidden(msg.includes("Owner access required") || msg.includes("403"));
      })
      .finally(() => setLoading(false));
  }, [token, limit, offset]);

  useEffect(() => {
    load();
  }, [load]);

  if (forbidden) {
    return (
      <section style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
        <h2
          style={{
            margin: 0,
            fontSize: "var(--text-2xl)",
            fontWeight: "var(--font-semibold)",
            color: "var(--color-text)",
          }}
        >
          Audit log
        </h2>
        <Card>
          <div style={{ padding: "var(--space-6)" }}>
            <EmptyState
              title="Owner access required"
              description="This section can only be viewed by the account owner."
            />
          </div>
        </Card>
      </section>
    );
  }

  if (error && !forbidden) {
    return (
      <section style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
        <h2
          style={{
            margin: 0,
            fontSize: "var(--text-2xl)",
            fontWeight: "var(--font-semibold)",
            color: "var(--color-text)",
          }}
        >
          Audit log
        </h2>
        <Card>
          <EmptyState
            title="Something went wrong"
            description={error}
            action={
              <button
                type="button"
                onClick={load}
                style={{
                  padding: "var(--space-2) var(--space-4)",
                  backgroundColor: "var(--color-primary)",
                  color: "white",
                  border: "none",
                  borderRadius: "var(--radius-md)",
                  fontWeight: "var(--font-medium)",
                  cursor: "pointer",
                }}
              >
                Try again
              </button>
            }
          />
        </Card>
      </section>
    );
  }

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const canPrev = offset > 0;
  const canNext = offset + limit < total;

  return (
    <section style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
      <h2
        style={{
          margin: 0,
          fontSize: "var(--text-2xl)",
          fontWeight: "var(--font-semibold)",
          color: "var(--color-text)",
        }}
      >
        Audit log
      </h2>
      <p style={{ margin: 0, fontSize: "var(--text-sm)", color: "var(--color-text-muted)" }}>
        Owner-only actions: alert settings changes and manual alert runs.
      </p>

      <Card>
        {loading ? (
          <div style={{ padding: "var(--space-6)" }}>
            <LoadingSkeleton />
          </div>
        ) : items.length === 0 ? (
          <div
            style={{
              padding: "var(--space-6)",
              minHeight: 120,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <EmptyState
              title="No audit entries"
              description="Owner-only actions will appear here."
            />
          </div>
        ) : (
          <>
            <div style={{ overflowX: "auto" }}>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  minWidth: 600,
                  fontSize: "var(--text-sm)",
                }}
                role="grid"
                aria-label="Audit log"
              >
                <thead>
                  <tr
                    style={{
                      borderBottom: "2px solid var(--color-border-strong)",
                      textAlign: "left",
                      backgroundColor: "var(--color-bg-muted)",
                    }}
                  >
                    <th
                      style={{
                        padding: "var(--space-3) var(--space-4)",
                        fontWeight: "var(--font-semibold)",
                        color: "var(--color-text)",
                      }}
                    >
                      Time
                    </th>
                    <th
                      style={{
                        padding: "var(--space-3) var(--space-4)",
                        fontWeight: "var(--font-semibold)",
                        color: "var(--color-text)",
                      }}
                    >
                      Actor
                    </th>
                    <th
                      style={{
                        padding: "var(--space-3) var(--space-4)",
                        fontWeight: "var(--font-semibold)",
                        color: "var(--color-text)",
                      }}
                    >
                      Action
                    </th>
                    <th
                      style={{
                        padding: "var(--space-3) var(--space-4)",
                        fontWeight: "var(--font-semibold)",
                        color: "var(--color-text)",
                      }}
                    >
                      Resource
                    </th>
                    <th
                      style={{
                        padding: "var(--space-3) var(--space-4)",
                        fontWeight: "var(--font-semibold)",
                        color: "var(--color-text)",
                      }}
                    >
                      Resource ID
                    </th>
                    <th
                      style={{
                        padding: "var(--space-3) var(--space-4)",
                        fontWeight: "var(--font-semibold)",
                        color: "var(--color-text)",
                      }}
                    >
                      Metadata
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((row) => (
                    <Fragment key={row.id}>
                      <tr
                        style={{
                          borderBottom: "1px solid var(--color-border)",
                        }}
                        className="table-row-hover"
                      >
                        <td
                          style={{
                            padding: "var(--space-3) var(--space-4)",
                            color: "var(--color-text)",
                          }}
                        >
                          {formatTime(row.created_at)}
                        </td>
                        <td
                          style={{
                            padding: "var(--space-3) var(--space-4)",
                            color: "var(--color-text)",
                          }}
                        >
                          {row.actor_email ?? `User #${row.actor_user_id}`}
                        </td>
                        <td
                          style={{
                            padding: "var(--space-3) var(--space-4)",
                            color: "var(--color-text)",
                          }}
                        >
                          {row.action}
                        </td>
                        <td
                          style={{
                            padding: "var(--space-3) var(--space-4)",
                            color: "var(--color-text)",
                          }}
                        >
                          {row.resource_type}
                        </td>
                        <td
                          style={{
                            padding: "var(--space-3) var(--space-4)",
                            color: "var(--color-text)",
                          }}
                        >
                          {row.resource_id ?? "—"}
                        </td>
                        <td
                          style={{
                            padding: "var(--space-3) var(--space-4)",
                            color: "var(--color-text)",
                          }}
                        >
                          {row.metadata != null && Object.keys(row.metadata).length > 0 ? (
                            <button
                              type="button"
                              onClick={() => setExpandedId(expandedId === row.id ? null : row.id)}
                              style={{
                                padding: "var(--space-1) var(--space-2)",
                                fontSize: "var(--text-xs)",
                                backgroundColor: "var(--color-bg-muted)",
                                border: "1px solid var(--color-border)",
                                borderRadius: "var(--radius-sm)",
                                cursor: "pointer",
                                color: "var(--color-primary)",
                              }}
                            >
                              {expandedId === row.id ? "Hide" : "View"}
                            </button>
                          ) : (
                            "—"
                          )}
                        </td>
                      </tr>
                      {expandedId === row.id &&
                        row.metadata != null &&
                        Object.keys(row.metadata).length > 0 && (
                          <tr
                            key={`${row.id}-meta`}
                            style={{
                              borderBottom: "1px solid var(--color-border)",
                              backgroundColor: "var(--color-bg-muted)",
                            }}
                          >
                            <td
                              colSpan={6}
                              style={{
                                padding: "var(--space-4)",
                                verticalAlign: "top",
                              }}
                            >
                              <pre
                                style={{
                                  margin: 0,
                                  fontSize: "var(--text-xs)",
                                  fontFamily: "var(--font-mono)",
                                  color: "var(--color-text)",
                                  whiteSpace: "pre-wrap",
                                  wordBreak: "break-word",
                                  maxHeight: 320,
                                  overflow: "auto",
                                  padding: "var(--space-3)",
                                  backgroundColor: "var(--color-bg-elevated)",
                                  border: "1px solid var(--color-border)",
                                  borderRadius: "var(--radius-md)",
                                }}
                              >
                                {formatMetadata(row.metadata)}
                              </pre>
                            </td>
                          </tr>
                        )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
            {(
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: "var(--space-3)",
                  padding: "var(--space-4)",
                  borderTop: "1px solid var(--color-border)",
                  backgroundColor: "var(--color-bg-muted)",
                }}
              >
                <span style={{ fontSize: "var(--text-sm)", color: "var(--color-text-muted)" }}>
                  Showing {offset + 1}–{Math.min(offset + limit, total)} of {total}
                </span>
                <div style={{ display: "flex", gap: "var(--space-2)" }}>
                  <button
                    type="button"
                    disabled={!canPrev}
                    onClick={() => setOffset((o) => Math.max(0, o - limit))}
                    style={{
                      padding: "var(--space-2) var(--space-4)",
                      border: "1px solid var(--color-border)",
                      borderRadius: "var(--radius-md)",
                      backgroundColor: canPrev ? "var(--color-bg-elevated)" : "var(--color-bg-muted)",
                      color: canPrev ? "var(--color-text)" : "var(--color-text-muted)",
                      fontSize: "var(--text-sm)",
                      cursor: canPrev ? "pointer" : "not-allowed",
                    }}
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    disabled={!canNext}
                    onClick={() => setOffset((o) => o + limit)}
                    style={{
                      padding: "var(--space-2) var(--space-4)",
                      border: "1px solid var(--color-border)",
                      borderRadius: "var(--radius-md)",
                      backgroundColor: canNext ? "var(--color-bg-elevated)" : "var(--color-bg-muted)",
                      color: canNext ? "var(--color-text)" : "var(--color-text-muted)",
                      fontSize: "var(--text-sm)",
                      cursor: canNext ? "pointer" : "not-allowed",
                    }}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </Card>
    </section>
  );
}
