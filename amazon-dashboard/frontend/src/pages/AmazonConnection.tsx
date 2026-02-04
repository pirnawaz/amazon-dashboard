import { useCallback, useEffect, useState } from "react";
import {
  getAmazonConnection,
  getAmazonCredential,
  upsertAmazonConnection,
  upsertAmazonCredential,
  adminSpapiPing,
  adminOrdersSync,
  adminInventorySync,
  type AmazonConnectionResponse,
  type AmazonConnectionUpsertRequest,
  type AmazonCredentialSafeResponse,
  type ConnectionStatus,
  type InventorySyncFreshness,
} from "../api";
import Card from "../components/ui/Card";
import EmptyState from "../components/ui/EmptyState";
import LoadingSkeleton from "../components/ui/LoadingSkeleton";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";

function isForbidden(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.includes("Owner access required") || msg.includes("403");
}

const CONNECTION_STATUS_STYLES: Record<
  ConnectionStatus,
  { bg: string; text: string; label: string }
> = {
  pending: {
    bg: "var(--color-bg-muted)",
    text: "var(--color-text-muted)",
    label: "Pending",
  },
  active: {
    bg: "var(--color-success-muted)",
    text: "var(--color-success)",
    label: "Active",
  },
  error: {
    bg: "var(--color-error-muted)",
    text: "var(--color-error)",
    label: "Error",
  },
  disconnected: {
    bg: "var(--color-warning-muted)",
    text: "var(--color-warning)",
    label: "Disconnected",
  },
};

function ConnectionStatusBadge({ status }: { status: ConnectionStatus }) {
  const s = CONNECTION_STATUS_STYLES[status];
  return (
    <span
      style={{
        padding: "var(--space-1) var(--space-2)",
        borderRadius: "var(--radius-sm)",
        backgroundColor: s.bg,
        color: s.text,
        fontSize: "var(--text-xs)",
        fontWeight: "var(--font-medium)",
      }}
    >
      {s.label}
    </span>
  );
}

function formatIso(iso: string | null): string {
  if (iso == null || iso === "") return "—";
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

function formatMarketplacesJson(value: Record<string, unknown> | null): string {
  if (value == null) return "—";
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

/** SP-API ping check status for display. */
type SpApiCheckStatus = "NEVER" | "OK" | "ERROR";

function getSpApiCheckStatus(conn: AmazonConnectionResponse | null): SpApiCheckStatus {
  if (conn?.last_check_at == null) return "NEVER";
  return conn.last_check_ok === true ? "OK" : "ERROR";
}

/** Orders sync status for display. */
type OrdersSyncStatus = "NEVER" | "RUNNING" | "OK" | "ERROR";

const ORDERS_SYNC_STATUS_STYLES: Record<
  OrdersSyncStatus,
  { bg: string; text: string; label: string }
> = {
  NEVER: { bg: "var(--color-bg-muted)", text: "var(--color-text-muted)", label: "NEVER" },
  RUNNING: { bg: "var(--color-info-muted, #e0f2fe)", text: "var(--color-info, #0284c7)", label: "RUNNING" },
  OK: { bg: "var(--color-success-muted)", text: "var(--color-success)", label: "OK" },
  ERROR: { bg: "var(--color-error-muted)", text: "var(--color-error)", label: "ERROR" },
};

function getOrdersSyncStatus(conn: AmazonConnectionResponse | null): OrdersSyncStatus {
  const s = conn?.last_orders_sync_status;
  if (s == null || s === "") return "NEVER";
  if (s === "running") return "RUNNING";
  if (s === "ok") return "OK";
  return "ERROR";
}

function OrdersSyncStatusBadge({ status }: { status: OrdersSyncStatus }) {
  const s = ORDERS_SYNC_STATUS_STYLES[status];
  return (
    <span
      style={{
        padding: "var(--space-1) var(--space-2)",
        borderRadius: "var(--radius-sm)",
        backgroundColor: s.bg,
        color: s.text,
        fontSize: "var(--text-xs)",
        fontWeight: "var(--font-medium)",
      }}
    >
      {s.label}
    </span>
  );
}

/** Inventory sync status for display. */
type InventorySyncStatus = "NEVER" | "RUNNING" | "OK" | "ERROR";

const INVENTORY_SYNC_STATUS_STYLES: Record<
  InventorySyncStatus,
  { bg: string; text: string; label: string }
> = {
  NEVER: { bg: "var(--color-bg-muted)", text: "var(--color-text-muted)", label: "NEVER" },
  RUNNING: { bg: "var(--color-info-muted, #e0f2fe)", text: "var(--color-info, #0284c7)", label: "RUNNING" },
  OK: { bg: "var(--color-success-muted)", text: "var(--color-success)", label: "OK" },
  ERROR: { bg: "var(--color-error-muted)", text: "var(--color-error)", label: "ERROR" },
};

const INVENTORY_FRESHNESS_STYLES: Record<
  InventorySyncFreshness,
  { bg: string; text: string; label: string }
> = {
  unknown: { bg: "var(--color-bg-muted)", text: "var(--color-text-muted)", label: "Unknown" },
  fresh: { bg: "var(--color-success-muted)", text: "var(--color-success)", label: "Fresh" },
  warning: { bg: "var(--color-warning-muted)", text: "var(--color-warning)", label: "Warning" },
  critical: { bg: "var(--color-error-muted)", text: "var(--color-error)", label: "Critical" },
};

function InventoryFreshnessBadge({
  freshness,
}: {
  freshness: InventorySyncFreshness | null | undefined;
}) {
  const f: InventorySyncFreshness = freshness ?? "unknown";
  const s = INVENTORY_FRESHNESS_STYLES[f];
  return (
    <span
      style={{
        padding: "var(--space-1) var(--space-2)",
        borderRadius: "var(--radius-sm)",
        backgroundColor: s.bg,
        color: s.text,
        fontSize: "var(--text-xs)",
        fontWeight: "var(--font-medium)",
      }}
    >
      {s.label}
    </span>
  );
}

function getInventorySyncStatus(conn: AmazonConnectionResponse | null): InventorySyncStatus {
  const s = conn?.last_inventory_sync_status;
  if (s == null || s === "" || s === "never") return "NEVER";
  if (s === "running") return "RUNNING";
  if (s === "ok") return "OK";
  return "ERROR";
}

function InventorySyncStatusBadge({ status }: { status: InventorySyncStatus }) {
  const s = INVENTORY_SYNC_STATUS_STYLES[status];
  return (
    <span
      style={{
        padding: "var(--space-1) var(--space-2)",
        borderRadius: "var(--radius-sm)",
        backgroundColor: s.bg,
        color: s.text,
        fontSize: "var(--text-xs)",
        fontWeight: "var(--font-medium)",
      }}
    >
      {s.label}
    </span>
  );
}

function truncateError(msg: string | null, maxLen: number = 200): string {
  if (msg == null || msg === "") return "—";
  return msg.length <= maxLen ? msg : msg.slice(0, maxLen) + "…";
}

export default function AmazonConnectionPage() {
  const { token } = useAuth();
  const { showToast } = useToast();
  const [connection, setConnection] = useState<AmazonConnectionResponse | null>(null);
  const [credential, setCredential] = useState<AmazonCredentialSafeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);

  const [connectionForm, setConnectionForm] = useState<{
    seller_identifier: string;
    marketplaces_json: string;
    status: ConnectionStatus;
  }>({ seller_identifier: "", marketplaces_json: "{}", status: "pending" });
  const [connectionSaving, setConnectionSaving] = useState(false);

  const [credentialForm, setCredentialForm] = useState({ refresh_token: "", note: "" });
  const [credentialSaving, setCredentialSaving] = useState(false);

  const [checking, setChecking] = useState(false);
  const [ordersSyncRunning, setOrdersSyncRunning] = useState<"orders_only" | "include_items" | null>(null);
  const [inventorySyncRunning, setInventorySyncRunning] = useState<"run" | "dry_run" | null>(null);

  const load = useCallback(() => {
    if (!token) return;
    setLoading(true);
    setError(null);
    setForbidden(false);
    Promise.all([getAmazonConnection(token), getAmazonCredential(token)])
      .then(([conn, cred]) => {
        setConnection(conn);
        setCredential(cred);
        if (conn) {
          setConnectionForm((prev) => ({
            ...prev,
            seller_identifier: conn.seller_identifier ?? "",
            marketplaces_json: conn.marketplaces_json
              ? JSON.stringify(conn.marketplaces_json, null, 2)
              : "{}",
            status: conn.status,
          }));
        }
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : "Failed to load Amazon connection";
        setError(msg);
        setForbidden(isForbidden(err));
        if (!isForbidden(err)) showToast(msg, "error");
      })
      .finally(() => setLoading(false));
  }, [token, showToast]);

  useEffect(() => {
    load();
  }, [load]);

  const handleRunCheck = () => {
    if (!token) return;
    setChecking(true);
    setError(null);
    adminSpapiPing(token)
      .then((res) => {
        if (res.status === "active") {
          showToast("SP-API check OK", "info");
        } else {
          showToast("Check failed", "error");
        }
        load();
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : "Check failed";
        if (isForbidden(err)) {
          setForbidden(true);
          showToast("Owner access required.", "error");
        } else {
          setError(msg);
          showToast(msg, "error");
        }
      })
      .finally(() => setChecking(false));
  };

  const handleRunOrdersSync = (includeItems: boolean) => {
    if (!token) return;
    setOrdersSyncRunning(includeItems ? "include_items" : "orders_only");
    setError(null);
    adminOrdersSync(token, { dry_run: false, include_items: includeItems })
      .then((res) => {
        if (res.ok) {
          showToast(includeItems ? "Orders sync (with items) completed." : "Orders sync (orders only) completed.", "info");
        } else {
          showToast(res.error ?? "Orders sync failed", "error");
        }
        load();
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : "Orders sync failed";
        if (isForbidden(err)) {
          setForbidden(true);
          showToast("Owner access required.", "error");
        } else {
          setError(msg);
          showToast(msg, "error");
        }
        load();
      })
      .finally(() => setOrdersSyncRunning(null));
  };

  const handleRunInventorySync = (dryRun: boolean) => {
    if (!token) return;
    setInventorySyncRunning(dryRun ? "dry_run" : "run");
    setError(null);
    adminInventorySync(token, { dry_run: dryRun })
      .then((res) => {
        if (res.error) {
          showToast(res.error, "error");
        } else {
          showToast(
            dryRun ? "Inventory sync (dry run) completed." : `Inventory sync completed. ${res.items_upserted} items upserted.`,
            "info"
          );
        }
        load();
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : "Inventory sync failed";
        if (isForbidden(err)) {
          setForbidden(true);
          showToast("Owner access required.", "error");
        } else {
          setError(msg);
          showToast(msg, "error");
        }
        load();
      })
      .finally(() => setInventorySyncRunning(null));
  };

  const handleSaveConnection = () => {
    if (!token) return;
    let marketplaces_json: Record<string, unknown> | null = null;
    try {
      const raw = connectionForm.marketplaces_json.trim();
      if (raw) marketplaces_json = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      showToast("Invalid JSON in marketplaces", "error");
      return;
    }
    setConnectionSaving(true);
    setError(null);
    const payload: AmazonConnectionUpsertRequest = {
      status: connectionForm.status,
      seller_identifier: connectionForm.seller_identifier.trim() || null,
      marketplaces_json,
    };
    upsertAmazonConnection(token, payload)
      .then((updated) => {
        setConnection(updated);
        setConnectionForm((prev) => ({
          ...prev,
          seller_identifier: updated.seller_identifier ?? "",
          marketplaces_json: updated.marketplaces_json
            ? JSON.stringify(updated.marketplaces_json, null, 2)
            : "{}",
          status: updated.status,
        }));
        showToast("Connection saved.", "info");
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : "Save failed";
        if (isForbidden(err)) {
          setForbidden(true);
          showToast("Owner access required.", "error");
        } else {
          setError(msg);
          showToast(msg, "error");
        }
      })
      .finally(() => setConnectionSaving(false));
  };

  const handleSaveCredential = () => {
    if (!token) return;
    setCredentialSaving(true);
    setError(null);
    const payload = {
      lwa_refresh_token_encrypted:
        credentialForm.refresh_token.trim() || undefined,
      note: credentialForm.note.trim() || null,
    };
    upsertAmazonCredential(token, payload)
      .then((updated) => {
        setCredential(updated);
        setCredentialForm({ refresh_token: "", note: updated.note ?? "" });
        showToast("Credential saved.", "info");
        load();
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : "Save failed";
        if (isForbidden(err)) {
          setForbidden(true);
          showToast("Owner access required.", "error");
        } else {
          setError(msg);
          showToast(msg, "error");
        }
      })
      .finally(() => setCredentialSaving(false));
  };

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
          Amazon connection
        </h2>
        <Card>
          <div style={{ padding: "var(--space-6)" }}>
            <EmptyState
              title="Owner access required"
              description="Only the account owner can view and change the Amazon SP-API connection."
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
          Amazon connection
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

  const emptyConnection = !loading && connection == null;

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
        Amazon connection
      </h2>
      <p style={{ margin: 0, fontSize: "var(--text-sm)", color: "var(--color-text-muted)" }}>
        Single SP-API connection and LWA credential (owner only). Run check to ping SP-API with the stored refresh token.
      </p>

      {loading ? (
        <Card>
          <div style={{ padding: "var(--space-6)" }}>
            <LoadingSkeleton />
          </div>
        </Card>
      ) : (
        <>
          <Card>
            <div style={{ padding: "var(--space-6)", display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
              {emptyConnection ? (
                <EmptyState
                  title="No connection yet"
                  description="Save connection below to create the Amazon SP-API connection row."
                />
              ) : connection ? (
                <>
                  <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", flexWrap: "wrap" }}>
                    <span style={{ fontSize: "var(--text-sm)", fontWeight: "var(--font-medium)", color: "var(--color-text)" }}>
                      Status
                    </span>
                    <ConnectionStatusBadge status={connection.status} />
                  </div>
                  <div>
                    <span style={{ fontSize: "var(--text-sm)", color: "var(--color-text-muted)" }}>
                      Seller identifier
                    </span>
                    <div style={{ marginTop: "var(--space-1)", fontSize: "var(--text-sm)", color: "var(--color-text)" }}>
                      {connection.seller_identifier ?? "—"}
                    </div>
                  </div>
                  <div>
                    <span style={{ fontSize: "var(--text-sm)", color: "var(--color-text-muted)" }}>
                      Marketplaces (JSON)
                    </span>
                    <pre
                      style={{
                        margin: "var(--space-1) 0 0",
                        padding: "var(--space-3)",
                        fontSize: "var(--text-xs)",
                        fontFamily: "var(--font-mono)",
                        backgroundColor: "var(--color-bg-muted)",
                        border: "1px solid var(--color-border)",
                        borderRadius: "var(--radius-md)",
                        overflow: "auto",
                        maxHeight: 200,
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-word",
                      }}
                    >
                      {formatMarketplacesJson(connection.marketplaces_json)}
                    </pre>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
                    <span style={{ fontSize: "var(--text-sm)", color: "var(--color-text-muted)" }}>
                      SP-API check status
                    </span>
                    <span style={{ fontSize: "var(--text-sm)", color: "var(--color-text)", fontWeight: "var(--font-medium)" }}>
                      {getSpApiCheckStatus(connection) === "NEVER" && "Never run"}
                      {getSpApiCheckStatus(connection) === "OK" && "OK"}
                      {getSpApiCheckStatus(connection) === "ERROR" && "Error"}
                    </span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
                    <span style={{ fontSize: "var(--text-sm)", color: "var(--color-text-muted)" }}>
                      Last check at
                    </span>
                    <span style={{ fontSize: "var(--text-sm)", color: "var(--color-text)" }}>
                      {formatIso(connection.last_check_at)}
                    </span>
                  </div>
                  {connection.last_check_error != null && connection.last_check_error !== "" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
                      <span style={{ fontSize: "var(--text-sm)", color: "var(--color-text-muted)" }}>
                        Last check error
                      </span>
                      <span style={{ fontSize: "var(--text-sm)", color: "var(--color-error)", wordBreak: "break-word" }}>
                        {truncateError(connection.last_check_error, 200)}
                      </span>
                    </div>
                  )}
                  <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
                    <span style={{ fontSize: "var(--text-sm)", color: "var(--color-text-muted)" }}>
                      Last success
                    </span>
                    <span style={{ fontSize: "var(--text-sm)", color: "var(--color-text)" }}>
                      {formatIso(connection.last_success_at)}
                    </span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
                    <span style={{ fontSize: "var(--text-sm)", color: "var(--color-text-muted)" }}>
                      Last error
                    </span>
                    <span style={{ fontSize: "var(--text-sm)", color: "var(--color-text)" }}>
                      {connection.last_error_at ? formatIso(connection.last_error_at) : "—"}
                      {connection.last_error_message ? ` — ${connection.last_error_message}` : ""}
                    </span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
                    <span style={{ fontSize: "var(--text-sm)", color: "var(--color-text-muted)" }}>
                      Credential
                    </span>
                    <span style={{ fontSize: "var(--text-sm)", color: "var(--color-text)" }}>
                      {credential != null
                        ? `Refresh token: ${credential.has_refresh_token ? "Yes" : "No"}${credential.note ? ` • Note: ${credential.note}` : ""}`
                        : "—"}
                    </span>
                  </div>
                  <div>
                    <button
                      type="button"
                      onClick={handleRunCheck}
                      disabled={checking}
                      style={{
                        padding: "var(--space-2) var(--space-4)",
                        backgroundColor: "var(--color-primary)",
                        color: "white",
                        border: "none",
                        borderRadius: "var(--radius-md)",
                        fontWeight: "var(--font-medium)",
                        cursor: checking ? "not-allowed" : "pointer",
                        fontSize: "var(--text-sm)",
                      }}
                    >
                      {checking ? "Checking…" : "Run check"}
                    </button>
                  </div>

                  <hr style={{ border: "none", borderTop: "1px solid var(--color-border)", margin: "var(--space-4) 0" }} />

                  <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", flexWrap: "wrap" }}>
                    <span style={{ fontSize: "var(--text-sm)", color: "var(--color-text-muted)" }}>
                      Orders sync status
                    </span>
                    <OrdersSyncStatusBadge status={getOrdersSyncStatus(connection)} />
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
                    <span style={{ fontSize: "var(--text-sm)", color: "var(--color-text-muted)" }}>
                      Last orders sync time
                    </span>
                    <span style={{ fontSize: "var(--text-sm)", color: "var(--color-text)" }}>
                      {formatIso(connection.last_orders_sync_at)}
                    </span>
                  </div>
                  {connection.last_orders_sync_error != null && connection.last_orders_sync_error !== "" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
                      <span style={{ fontSize: "var(--text-sm)", color: "var(--color-text-muted)" }}>
                        Last sync error
                      </span>
                      <span style={{ fontSize: "var(--text-sm)", color: "var(--color-error)", wordBreak: "break-word" }}>
                        {truncateError(connection.last_orders_sync_error, 200)}
                      </span>
                    </div>
                  )}
                  {(connection.last_orders_sync_orders_count != null || connection.last_orders_sync_items_count != null) && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
                      <span style={{ fontSize: "var(--text-sm)", color: "var(--color-text-muted)" }}>
                        Last sync stats
                      </span>
                      <span style={{ fontSize: "var(--text-sm)", color: "var(--color-text)" }}>
                        Orders: {connection.last_orders_sync_orders_count ?? "—"} · Items: {connection.last_orders_sync_items_count ?? "—"}
                      </span>
                    </div>
                  )}
                  <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
                    <button
                      type="button"
                      onClick={() => handleRunOrdersSync(false)}
                      disabled={ordersSyncRunning != null}
                      style={{
                        padding: "var(--space-2) var(--space-4)",
                        backgroundColor: "var(--color-primary)",
                        color: "white",
                        border: "none",
                        borderRadius: "var(--radius-md)",
                        fontWeight: "var(--font-medium)",
                        cursor: ordersSyncRunning != null ? "not-allowed" : "pointer",
                        fontSize: "var(--text-sm)",
                      }}
                    >
                      {ordersSyncRunning === "orders_only" ? "Syncing…" : "Run orders sync (orders only)"}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRunOrdersSync(true)}
                      disabled={ordersSyncRunning != null}
                      style={{
                        padding: "var(--space-2) var(--space-4)",
                        backgroundColor: "var(--color-primary)",
                        color: "white",
                        border: "none",
                        borderRadius: "var(--radius-md)",
                        fontWeight: "var(--font-medium)",
                        cursor: ordersSyncRunning != null ? "not-allowed" : "pointer",
                        fontSize: "var(--text-sm)",
                      }}
                    >
                      {ordersSyncRunning === "include_items" ? "Syncing…" : "Run orders sync (include items)"}
                    </button>
                  </div>

                  <hr style={{ border: "none", borderTop: "1px solid var(--color-border)", margin: "var(--space-4) 0" }} />

                  <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", flexWrap: "wrap" }}>
                    <span style={{ fontSize: "var(--text-sm)", color: "var(--color-text-muted)" }}>
                      Inventory Sync (FBA)
                    </span>
                    <InventorySyncStatusBadge status={getInventorySyncStatus(connection)} />
                    <InventoryFreshnessBadge freshness={connection.last_inventory_sync_freshness} />
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
                    <span style={{ fontSize: "var(--text-sm)", color: "var(--color-text-muted)" }}>
                      Last inventory sync time
                    </span>
                    <span style={{ fontSize: "var(--text-sm)", color: "var(--color-text)" }}>
                      {formatIso(connection.last_inventory_sync_at)}
                    </span>
                  </div>
                  {connection.last_inventory_sync_age_hours != null && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
                      <span style={{ fontSize: "var(--text-sm)", color: "var(--color-text-muted)" }}>
                        Age (hours)
                      </span>
                      <span style={{ fontSize: "var(--text-sm)", color: "var(--color-text)" }}>
                        {connection.last_inventory_sync_age_hours.toFixed(1)} hours
                      </span>
                    </div>
                  )}
                  {connection.last_inventory_sync_items_count != null && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
                      <span style={{ fontSize: "var(--text-sm)", color: "var(--color-text-muted)" }}>
                        Last sync items count
                      </span>
                      <span style={{ fontSize: "var(--text-sm)", color: "var(--color-text)" }}>
                        {connection.last_inventory_sync_items_count}
                      </span>
                    </div>
                  )}
                  {connection.last_inventory_sync_error != null && connection.last_inventory_sync_error !== "" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
                      <span style={{ fontSize: "var(--text-sm)", color: "var(--color-text-muted)" }}>
                        Last inventory sync error
                      </span>
                      <span style={{ fontSize: "var(--text-sm)", color: "var(--color-error)", wordBreak: "break-word" }}>
                        {truncateError(connection.last_inventory_sync_error, 200)}
                      </span>
                    </div>
                  )}
                  <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
                    <button
                      type="button"
                      onClick={() => handleRunInventorySync(false)}
                      disabled={inventorySyncRunning != null}
                      style={{
                        padding: "var(--space-2) var(--space-4)",
                        backgroundColor: "var(--color-primary)",
                        color: "white",
                        border: "none",
                        borderRadius: "var(--radius-md)",
                        fontWeight: "var(--font-medium)",
                        cursor: inventorySyncRunning != null ? "not-allowed" : "pointer",
                        fontSize: "var(--text-sm)",
                      }}
                    >
                      {inventorySyncRunning === "run" ? "Syncing…" : "Run inventory sync"}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRunInventorySync(true)}
                      disabled={inventorySyncRunning != null}
                      style={{
                        padding: "var(--space-2) var(--space-4)",
                        backgroundColor: "var(--color-primary)",
                        color: "white",
                        border: "none",
                        borderRadius: "var(--radius-md)",
                        fontWeight: "var(--font-medium)",
                        cursor: inventorySyncRunning != null ? "not-allowed" : "pointer",
                        fontSize: "var(--text-sm)",
                      }}
                    >
                      {inventorySyncRunning === "dry_run" ? "Running…" : "Dry run"}
                    </button>
                  </div>
                </>
              ) : null}
            </div>
          </Card>

          <Card>
            <div style={{ padding: "var(--space-6)" }}>
              <h3
                style={{
                  margin: "0 0 var(--space-4)",
                  fontSize: "var(--text-lg)",
                  fontWeight: "var(--font-semibold)",
                  color: "var(--color-text)",
                }}
              >
                Save connection
              </h3>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "var(--space-4)",
                  maxWidth: 560,
                }}
              >
                <label style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
                  <span style={{ fontSize: "var(--text-sm)" }}>Status</span>
                  <select
                    value={connectionForm.status}
                    onChange={(e) =>
                      setConnectionForm((p) => ({ ...p, status: e.target.value as ConnectionStatus }))
                    }
                    style={{
                      padding: "var(--space-3)",
                      border: "1px solid var(--color-border)",
                      borderRadius: "var(--radius-md)",
                      fontSize: "var(--text-sm)",
                    }}
                  >
                    <option value="pending">pending</option>
                    <option value="active">active</option>
                    <option value="error">error</option>
                    <option value="disconnected">disconnected</option>
                  </select>
                </label>
                <label style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
                  <span style={{ fontSize: "var(--text-sm)" }}>Seller identifier</span>
                  <input
                    type="text"
                    value={connectionForm.seller_identifier}
                    onChange={(e) =>
                      setConnectionForm((p) => ({ ...p, seller_identifier: e.target.value }))
                    }
                    placeholder="e.g. SELLER123"
                    style={{
                      padding: "var(--space-3)",
                      border: "1px solid var(--color-border)",
                      borderRadius: "var(--radius-md)",
                      fontSize: "var(--text-sm)",
                    }}
                  />
                </label>
                <label style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
                  <span style={{ fontSize: "var(--text-sm)" }}>Marketplaces (JSON)</span>
                  <textarea
                    value={connectionForm.marketplaces_json}
                    onChange={(e) =>
                      setConnectionForm((p) => ({ ...p, marketplaces_json: e.target.value }))
                    }
                    rows={6}
                    placeholder='{"NA": "ATVPDKIKX0DER"}'
                    style={{
                      padding: "var(--space-3)",
                      border: "1px solid var(--color-border)",
                      borderRadius: "var(--radius-md)",
                      fontSize: "var(--text-sm)",
                      fontFamily: "var(--font-mono)",
                    }}
                  />
                </label>
                <button
                  type="button"
                  onClick={handleSaveConnection}
                  disabled={connectionSaving}
                  style={{
                    padding: "var(--space-3)",
                    backgroundColor: "var(--color-primary)",
                    color: "white",
                    border: "none",
                    borderRadius: "var(--radius-md)",
                    fontWeight: "var(--font-medium)",
                    cursor: connectionSaving ? "not-allowed" : "pointer",
                    alignSelf: "flex-start",
                  }}
                >
                  {connectionSaving ? "Saving…" : "Save connection"}
                </button>
              </div>
            </div>
          </Card>

          <Card>
            <div style={{ padding: "var(--space-6)" }}>
              <h3
                style={{
                  margin: "0 0 var(--space-4)",
                  fontSize: "var(--text-lg)",
                  fontWeight: "var(--font-semibold)",
                  color: "var(--color-text)",
                }}
              >
                Save credential
              </h3>
              <p style={{ margin: "0 0 var(--space-4)", fontSize: "var(--text-sm)", color: "var(--color-text-muted)" }}>
                Store LWA refresh token (encrypted). Create a connection first if none exists. Token is never shown in responses.
              </p>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "var(--space-4)",
                  maxWidth: 560,
                }}
              >
                <label style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
                  <span style={{ fontSize: "var(--text-sm)" }}>Refresh token (password-type)</span>
                  <input
                    type="password"
                    value={credentialForm.refresh_token}
                    onChange={(e) =>
                      setCredentialForm((p) => ({ ...p, refresh_token: e.target.value }))
                    }
                    placeholder="Paste encrypted or plain token"
                    autoComplete="off"
                    style={{
                      padding: "var(--space-3)",
                      border: "1px solid var(--color-border)",
                      borderRadius: "var(--radius-md)",
                      fontSize: "var(--text-sm)",
                    }}
                  />
                </label>
                <label style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
                  <span style={{ fontSize: "var(--text-sm)" }}>Note (optional)</span>
                  <input
                    type="text"
                    value={credentialForm.note}
                    onChange={(e) =>
                      setCredentialForm((p) => ({ ...p, note: e.target.value }))
                    }
                    placeholder="e.g. Production LWA"
                    style={{
                      padding: "var(--space-3)",
                      border: "1px solid var(--color-border)",
                      borderRadius: "var(--radius-md)",
                      fontSize: "var(--text-sm)",
                    }}
                  />
                </label>
                <button
                  type="button"
                  onClick={handleSaveCredential}
                  disabled={credentialSaving}
                  style={{
                    padding: "var(--space-3)",
                    backgroundColor: "var(--color-primary)",
                    color: "white",
                    border: "none",
                    borderRadius: "var(--radius-md)",
                    fontWeight: "var(--font-medium)",
                    cursor: credentialSaving ? "not-allowed" : "pointer",
                    alignSelf: "flex-start",
                  }}
                >
                  {credentialSaving ? "Saving…" : "Save credential"}
                </button>
              </div>
            </div>
          </Card>
        </>
      )}
    </section>
  );
}
