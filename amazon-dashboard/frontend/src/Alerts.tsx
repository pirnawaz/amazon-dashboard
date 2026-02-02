import { useCallback, useEffect, useState } from "react";
import {
  getAlerts,
  acknowledgeAlerts,
  getAlertSettings,
  updateAlertSettings,
  runAlertsNow,
  type AlertEventResponse,
  type AlertListResponse,
  type AlertSettingsResponse,
  type AlertSettingsUpdateRequest,
} from "./api";
import {
  getDemoAlerts,
  acknowledgeDemoAlerts,
  getDemoAlertSettings,
  updateDemoAlertSettings,
  runDemoAlertsNow,
} from "./data/demoData";
import Card from "./components/ui/Card";
import EmptyState from "./components/ui/EmptyState";
import LoadingSkeleton from "./components/ui/LoadingSkeleton";
import Table from "./components/ui/Table";
import { useAuth } from "./context/AuthContext";
import { useToast } from "./context/ToastContext";
import { isDemoMode } from "./utils/preferences";

const SEVERITY_OPTIONS = [
  { value: "", label: "All" },
  { value: "critical", label: "Critical" },
  { value: "warning", label: "Warning" },
  { value: "info", label: "Info" },
];

const MESSAGE_TRUNCATE = 80;

type Props = {
  token: string;
};

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso.slice(0, 16);
  }
}

function SeverityBadge({ severity }: { severity: string }) {
  const style =
    severity === "critical"
      ? { bg: "var(--color-error-muted)", color: "var(--color-error)" }
      : severity === "warning"
        ? { bg: "var(--color-warning-muted)", color: "var(--color-warning)" }
        : { bg: "var(--color-bg-muted)", color: "var(--color-text-muted)" };
  return (
    <span
      style={{
        padding: "var(--space-1) var(--space-2)",
        borderRadius: "var(--radius-sm)",
        backgroundColor: style.bg,
        color: style.color,
        fontSize: "var(--text-xs)",
        fontWeight: "var(--font-medium)",
      }}
    >
      {severity}
    </span>
  );
}

export default function Alerts({ token }: Props) {
  const [alerts, setAlerts] = useState<AlertListResponse | null>(null);
  const [settings, setSettings] = useState<AlertSettingsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [severity, setSeverity] = useState<string>("");
  const [unacknowledgedOnly, setUnacknowledgedOnly] = useState(false);
  const [runBusy, setRunBusy] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [expandedMessageId, setExpandedMessageId] = useState<number | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsForm, setSettingsForm] = useState<AlertSettingsUpdateRequest>({});
  const [settingsSaving, setSettingsSaving] = useState(false);
  const { user } = useAuth();
  const { showToast } = useToast();
  const isOwner = user?.role === "owner";

  const loadAlerts = useCallback(() => {
    setError(null);
    setLoading(true);
    const params = {
      severity: severity || undefined,
      unacknowledged: unacknowledgedOnly || undefined,
      limit: 200,
    };
    if (isDemoMode()) {
      setAlerts(getDemoAlerts(params));
      setLoading(false);
      return;
    }
    getAlerts(token, params)
      .then(setAlerts)
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : "Failed to load alerts")
      )
      .finally(() => setLoading(false));
  }, [token, severity, unacknowledgedOnly]);

  const loadSettings = useCallback(() => {
    setSettingsLoading(true);
    if (isDemoMode()) {
      setSettings(getDemoAlertSettings());
      setSettingsLoading(false);
      return;
    }
    getAlertSettings(token)
      .then(setSettings)
      .catch(() => setSettingsLoading(false))
      .finally(() => setSettingsLoading(false));
  }, [token]);

  useEffect(() => {
    loadAlerts();
  }, [loadAlerts]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const handleRunNow = () => {
    setRunBusy(true);
    if (isDemoMode()) {
      const result = runDemoAlertsNow();
      showToast(`Demo: created ${result.created} alert(s).`, "info");
      loadAlerts();
      setRunBusy(false);
      return;
    }
    runAlertsNow(token)
      .then((result) => {
        showToast(`Created ${result.created} alert(s), emailed ${result.emailed}.`, "info");
        loadAlerts();
      })
      .catch((err: unknown) =>
        showToast(err instanceof Error ? err.message : "Run failed", "error")
      )
      .finally(() => setRunBusy(false));
  };

  const handleAck = (ids: number[]) => {
    if (isDemoMode()) {
      const count = acknowledgeDemoAlerts(ids);
      showToast(`Acknowledged ${count} alert(s).`, "info");
      setSelectedIds(new Set());
      loadAlerts();
      return;
    }
    acknowledgeAlerts(token, ids)
      .then((res) => {
        showToast(`Acknowledged ${res.acknowledged} alert(s).`, "info");
        setSelectedIds(new Set());
        loadAlerts();
      })
      .catch((err: unknown) =>
        showToast(err instanceof Error ? err.message : "Acknowledge failed", "error")
      );
  };

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = (items: AlertEventResponse[]) => {
    const unacked = items.filter((a) => !a.is_acknowledged);
    if (selectedIds.size >= unacked.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(unacked.map((a) => a.id)));
    }
  };

  const handleSaveSettings = () => {
    if (isDemoMode()) {
      try {
        setSettingsSaving(true);
        const updated = updateDemoAlertSettings(settingsForm);
        setSettings(updated);
        setSettingsForm({});
        showToast("Settings saved.", "info");
        setShowSettings(false);
      } catch (e) {
        showToast(e instanceof Error ? e.message : "Validation failed", "error");
      } finally {
        setSettingsSaving(false);
      }
      return;
    }
    setSettingsSaving(true);
    updateAlertSettings(token, settingsForm)
      .then((updated) => {
        setSettings(updated);
        setSettingsForm({});
        showToast("Settings saved.", "info");
        setShowSettings(false);
      })
      .catch((err: unknown) =>
        showToast(err instanceof Error ? err.message : "Save failed", "error")
      )
      .finally(() => setSettingsSaving(false));
  };

  const items = alerts?.items ?? [];
  const unackedCount = items.filter((a) => !a.is_acknowledged).length;
  const allUnackedSelected =
    unackedCount > 0 && selectedIds.size === unackedCount;

  if (error) {
    return (
      <Card>
        <EmptyState
          title="Something went wrong"
          description={error}
          action={
            <button
              type="button"
              onClick={loadAlerts}
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
    );
  }

  return (
    <section style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
      {isDemoMode() && (
        <div
          style={{
            padding: "var(--space-2) var(--space-4)",
            backgroundColor: "var(--color-info-muted)",
            color: "var(--color-info)",
            borderRadius: "var(--radius-md)",
            fontSize: "var(--text-sm)",
          }}
        >
          Demo mode: alerts and settings are in-memory. Use “Run now” to add a demo alert.
        </div>
      )}

      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "var(--space-4)" }}>
        <h1 style={{ margin: 0, fontSize: "var(--text-2xl)", fontWeight: "var(--font-bold)" }}>
          Alerts
        </h1>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
          <label style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", fontSize: "var(--text-sm)" }}>
            <span>Severity</span>
            <select
              value={severity}
              onChange={(e) => setSeverity(e.target.value)}
              style={{
                padding: "var(--space-2) var(--space-3)",
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius-md)",
                fontSize: "var(--text-sm)",
              }}
            >
              {SEVERITY_OPTIONS.map((o) => (
                <option key={o.value || "all"} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", fontSize: "var(--text-sm)" }}>
            <input
              type="checkbox"
              checked={unacknowledgedOnly}
              onChange={(e) => setUnacknowledgedOnly(e.target.checked)}
            />
            Unacknowledged only
          </label>
          {isOwner && (
            <>
              <button
                type="button"
                onClick={handleRunNow}
                disabled={runBusy}
                style={{
                  padding: "var(--space-2) var(--space-4)",
                  backgroundColor: "var(--color-primary)",
                  color: "white",
                  border: "none",
                  borderRadius: "var(--radius-md)",
                  fontWeight: "var(--font-medium)",
                  cursor: runBusy ? "not-allowed" : "pointer",
                  fontSize: "var(--text-sm)",
                }}
              >
                {runBusy ? "Running…" : "Run now"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowSettings(!showSettings);
                  if (!showSettings && settings) setSettingsForm({});
                }}
                style={{
                  padding: "var(--space-2) var(--space-4)",
                  border: "1px solid var(--color-border)",
                  borderRadius: "var(--radius-md)",
                  backgroundColor: "var(--color-bg)",
                  fontSize: "var(--text-sm)",
                  cursor: "pointer",
                }}
              >
                {showSettings ? "Hide settings" : "Alert settings"}
              </button>
            </>
          )}
        </div>
      </div>

      {showSettings && (
        <Card>
          <h2 style={{ margin: "0 0 var(--space-4)", fontSize: "var(--text-lg)" }}>Alert settings</h2>
          {settingsLoading ? (
            <LoadingSkeleton />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)", maxWidth: 480 }}>
              <label style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                <input
                  type="checkbox"
                  checked={settingsForm.email_enabled ?? settings?.email_enabled ?? false}
                  onChange={(e) => setSettingsForm((p) => ({ ...p, email_enabled: e.target.checked }))}
                />
                Email notifications enabled
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
                <span style={{ fontSize: "var(--text-sm)" }}>Recipients (comma-separated; leave empty for all users)</span>
                <input
                  type="text"
                  value={settingsForm.email_recipients ?? settings?.email_recipients ?? ""}
                  onChange={(e) =>
                    setSettingsForm((p) => ({
                      ...p,
                      email_recipients: e.target.value.trim() || undefined,
                    }))
                  }
                  placeholder="email1@example.com, email2@example.com"
                  style={{
                    padding: "var(--space-3)",
                    border: "1px solid var(--color-border)",
                    borderRadius: "var(--radius-md)",
                  }}
                />
              </label>
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                {(
                  [
                    ["send_inventory_stale", "Inventory stale"],
                    ["send_urgent_restock", "Urgent restock"],
                    ["send_reorder_soon", "Reorder soon"],
                    ["send_order_by_passed", "Order-by passed"],
                  ] as const
                ).map(([key, label]) => (
                  <label key={key} style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                    <input
                      type="checkbox"
                      checked={settingsForm[key] ?? settings?.[key] ?? true}
                      onChange={(e) =>
                        setSettingsForm((p) => ({ ...p, [key]: e.target.checked }))
                      }
                    />
                    {label}
                  </label>
                ))}
              </div>
              <label style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
                <span style={{ fontSize: "var(--text-sm)" }}>Stale threshold (days, 1–60)</span>
                <input
                  type="number"
                  min={1}
                  max={60}
                  value={
                    settingsForm.stale_days_threshold ??
                    settings?.stale_days_threshold ??
                    7
                  }
                  onChange={(e) =>
                    setSettingsForm((p) => ({
                      ...p,
                      stale_days_threshold: parseInt(e.target.value, 10) || undefined,
                    }))
                  }
                  style={{
                    padding: "var(--space-3)",
                    border: "1px solid var(--color-border)",
                    borderRadius: "var(--radius-md)",
                    width: 80,
                  }}
                />
              </label>
              <div style={{ display: "flex", gap: "var(--space-3)" }}>
                <button
                  type="button"
                  onClick={handleSaveSettings}
                  disabled={settingsSaving}
                  style={{
                    padding: "var(--space-3)",
                    backgroundColor: "var(--color-primary)",
                    color: "white",
                    border: "none",
                    borderRadius: "var(--radius-md)",
                    fontWeight: "var(--font-medium)",
                    cursor: settingsSaving ? "not-allowed" : "pointer",
                  }}
                >
                  {settingsSaving ? "Saving…" : "Save"}
                </button>
              </div>
            </div>
          )}
        </Card>
      )}

      <Card>
        {loading ? (
          <div style={{ padding: "var(--space-6)" }}>
            <LoadingSkeleton />
          </div>
        ) : (
          <>
            {unackedCount > 0 && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--space-3)",
                  marginBottom: "var(--space-4)",
                  flexWrap: "wrap",
                }}
              >
                <label style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", fontSize: "var(--text-sm)" }}>
                  <input
                    type="checkbox"
                    checked={allUnackedSelected}
                    onChange={() => toggleSelectAll(items)}
                  />
                  Select all unacknowledged
                </label>
                {selectedIds.size > 0 && (
                  <button
                    type="button"
                    onClick={() => handleAck(Array.from(selectedIds))}
                    style={{
                      padding: "var(--space-2) var(--space-4)",
                      backgroundColor: "var(--color-primary)",
                      color: "white",
                      border: "none",
                      borderRadius: "var(--radius-md)",
                      fontSize: "var(--text-sm)",
                      cursor: "pointer",
                    }}
                  >
                    Acknowledge selected ({selectedIds.size})
                  </button>
                )}
              </div>
            )}
            <Table<AlertEventResponse & { _messageDisplay?: string }>
              getRowKey={(row) => String(row.id)}
              data={items}
              columns={[
                {
                  key: "checkbox",
                  header: "",
                  render: (row) =>
                    !row.is_acknowledged ? (
                      <input
                        type="checkbox"
                        checked={selectedIds.has(row.id)}
                        onChange={() => toggleSelect(row.id)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <span />
                    ),
                },
                {
                  key: "created_at",
                  header: "Created",
                  render: (row) => formatDate(row.created_at),
                },
                {
                  key: "severity",
                  header: "Severity",
                  render: (row) => <SeverityBadge severity={row.severity} />,
                },
                {
                  key: "alert_type",
                  header: "Type",
                  render: (row) => (
                    <span style={{ textTransform: "replace", fontFamily: "var(--font-mono)", fontSize: "var(--text-xs)" }}>
                      {row.alert_type.replace(/_/g, " ")}
                    </span>
                  ),
                },
                { key: "sku", header: "SKU", render: (row) => row.sku ?? "—" },
                { key: "marketplace", header: "Marketplace", render: (row) => row.marketplace ?? "—" },
                { key: "title", header: "Title", render: (row) => row.title },
                {
                  key: "message",
                  header: "Message",
                  render: (row) => {
                    const isExpanded = expandedMessageId === row.id;
                    const truncated =
                      row.message.length <= MESSAGE_TRUNCATE
                        ? row.message
                        : row.message.slice(0, MESSAGE_TRUNCATE) + "…";
                    return (
                      <div>
                        {isExpanded ? row.message : truncated}
                        {row.message.length > MESSAGE_TRUNCATE && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setExpandedMessageId(isExpanded ? null : row.id);
                            }}
                            style={{
                              marginLeft: "var(--space-2)",
                              padding: 0,
                              background: "none",
                              border: "none",
                              color: "var(--color-primary)",
                              cursor: "pointer",
                              fontSize: "var(--text-xs)",
                            }}
                          >
                            {isExpanded ? "Less" : "More"}
                          </button>
                        )}
                      </div>
                    );
                  },
                },
                {
                  key: "is_acknowledged",
                  header: "Acknowledged",
                  render: (row) => (row.is_acknowledged ? "Yes" : "No"),
                },
                {
                  key: "action",
                  header: "Action",
                  render: (row) =>
                    !row.is_acknowledged ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAck([row.id]);
                        }}
                        style={{
                          padding: "var(--space-1) var(--space-3)",
                          border: "1px solid var(--color-border)",
                          borderRadius: "var(--radius-sm)",
                          backgroundColor: "var(--color-bg)",
                          fontSize: "var(--text-xs)",
                          cursor: "pointer",
                        }}
                      >
                        Acknowledge
                      </button>
                    ) : (
                      "—"
                    ),
                },
              ]}
              emptyTitle="No alerts"
              emptyDescription="Alerts are generated by the worker from inventory and restock logic. Use “Run now” to generate once, or wait for the next run."
            />
          </>
        )}
      </Card>
    </section>
  );
}
