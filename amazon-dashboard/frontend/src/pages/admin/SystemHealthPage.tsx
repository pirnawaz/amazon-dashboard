import { useCallback, useEffect, useState } from "react";
import {
  getHealthSummary,
  getHealthJobs,
  getHealthNotifications,
  type HealthSummaryResponse,
  type JobRunOut,
  type NotificationDeliveryOut,
} from "../../api";
import Card from "../../components/ui/Card";
import LoadingSkeleton from "../../components/ui/LoadingSkeleton";
import { useAuth } from "../../context/AuthContext";
import { useDemo } from "../../context/DemoContext";
import {
  getDemoHealthSummary,
  getDemoHealthJobs,
  getDemoHealthNotifications,
} from "../../data/demoData";

function formatDate(iso: string | null): string {
  if (iso == null) return "—";
  try {
    return new Date(iso).toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso.slice(0, 19);
  }
}

function statusColor(status: string): string {
  switch (status) {
    case "ok":
    case "success":
    case "sent":
      return "var(--color-success)";
    case "warning":
      return "var(--color-warning)";
    case "critical":
    case "failed":
      return "var(--color-error)";
    default:
      return "var(--color-text-muted)";
  }
}

function statusBg(status: string): string {
  switch (status) {
    case "ok":
    case "success":
    case "sent":
      return "var(--color-success-muted)";
    case "warning":
      return "var(--color-warning-muted)";
    case "critical":
    case "failed":
      return "var(--color-error-muted)";
    default:
      return "var(--color-bg-muted)";
  }
}

export default function SystemHealthPage() {
  const { token } = useAuth();
  const { isDemoMode } = useDemo();
  const [summary, setSummary] = useState<HealthSummaryResponse | null>(null);
  const [jobs, setJobs] = useState<JobRunOut[]>([]);
  const [notifications, setNotifications] = useState<NotificationDeliveryOut[]>([]);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [loadingNotifications, setLoadingNotifications] = useState(true);
  const [useDemo, setUseDemo] = useState(false);

  const loadSummary = useCallback(() => {
    if (!token && !isDemoMode) return;
    setLoadingSummary(true);
    if (isDemoMode) {
      setSummary(getDemoHealthSummary());
      setLoadingSummary(false);
      setUseDemo(true);
      return;
    }
    getHealthSummary(token!)
      .then((s) => {
        setSummary(s);
        setUseDemo(false);
      })
      .catch(() => {
        setSummary(getDemoHealthSummary());
        setUseDemo(true);
      })
      .finally(() => setLoadingSummary(false));
  }, [token, isDemoMode]);

  const loadJobs = useCallback(() => {
    if (!token && !isDemoMode) return;
    setLoadingJobs(true);
    if (isDemoMode) {
      setJobs(getDemoHealthJobs());
      setLoadingJobs(false);
      return;
    }
    getHealthJobs(token!, { limit: 50 })
      .then(setJobs)
      .catch(() => setJobs(getDemoHealthJobs()))
      .finally(() => setLoadingJobs(false));
  }, [token, isDemoMode]);

  const loadNotifications = useCallback(() => {
    if (!token && !isDemoMode) return;
    setLoadingNotifications(true);
    if (isDemoMode) {
      setNotifications(getDemoHealthNotifications());
      setLoadingNotifications(false);
      return;
    }
    getHealthNotifications(token!, { limit: 50 })
      .then(setNotifications)
      .catch(() => setNotifications(getDemoHealthNotifications()))
      .finally(() => setLoadingNotifications(false));
  }, [token, isDemoMode]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);
  useEffect(() => {
    loadJobs();
  }, [loadJobs]);
  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  return (
    <div style={{ padding: "var(--space-4)", maxWidth: 1200, margin: "0 auto" }}>
      <h1 style={{ marginBottom: "var(--space-2)", fontSize: "var(--text-xl)", fontWeight: "var(--font-bold)" }}>
        System Health
      </h1>
      {useDemo && (
        <p
          style={{
            marginBottom: "var(--space-4)",
            padding: "var(--space-2) var(--space-3)",
            backgroundColor: "var(--color-warning-muted)",
            color: "var(--color-warning)",
            borderRadius: "var(--radius-md)",
            fontSize: "var(--text-sm)",
          }}
        >
          Showing demo data (backend unavailable or demo mode).
        </p>
      )}

      {loadingSummary ? (
        <LoadingSkeleton height={120} style={{ marginBottom: "var(--space-4)" }} />
      ) : summary ? (
        <>
          <div
            style={{
              marginBottom: "var(--space-4)",
              padding: "var(--space-4)",
              borderRadius: "var(--radius-lg)",
              backgroundColor: statusBg(summary.status),
              border: `2px solid ${statusColor(summary.status)}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: "var(--space-3)",
            }}
          >
            <div>
              <span style={{ fontSize: "var(--text-sm)", color: "var(--color-text-muted)", textTransform: "uppercase" }}>
                Overall status
              </span>
              <div style={{ fontSize: "var(--text-lg)", fontWeight: "var(--font-bold)", color: statusColor(summary.status) }}>
                {summary.status.toUpperCase()}
              </div>
            </div>
            <div style={{ display: "flex", gap: "var(--space-6)", flexWrap: "wrap" }}>
              <div>
                <span style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)" }}>Orders sync</span>
                <div style={{ fontWeight: "var(--font-medium)" }}>{formatDate(summary.last_orders_sync_at)}</div>
              </div>
              <div>
                <span style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)" }}>Ads sync</span>
                <div style={{ fontWeight: "var(--font-medium)" }}>{formatDate(summary.last_ads_sync_at)}</div>
              </div>
              <div>
                <span style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)" }}>Failed notifications</span>
                <div style={{ fontWeight: "var(--font-medium)", color: summary.failed_notifications_count > 0 ? "var(--color-error)" : undefined }}>
                  {summary.failed_notifications_count}
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "var(--space-4)", marginBottom: "var(--space-4)" }}>
            <Card title="Orders sync status" style={{ padding: "var(--space-4)" }}>
              <div style={{ fontSize: "var(--text-sm)" }}>
                Last run: {formatDate(summary.last_orders_sync_at)}
                {summary.last_job_runs.find((j) => j.job_name === "orders_sync") && (
                  <div style={{ marginTop: "var(--space-2)", color: statusColor(summary.last_job_runs.find((j) => j.job_name === "orders_sync")!.last_status || "") }}>
                    Status: {summary.last_job_runs.find((j) => j.job_name === "orders_sync")!.last_status ?? "—"}
                  </div>
                )}
              </div>
            </Card>
            <Card title="Ads sync status" style={{ padding: "var(--space-4)" }}>
              <div style={{ fontSize: "var(--text-sm)" }}>
                Last run: {formatDate(summary.last_ads_sync_at)}
                {summary.last_job_runs.find((j) => j.job_name === "ads_sync") && (
                  <div style={{ marginTop: "var(--space-2)", color: statusColor(summary.last_job_runs.find((j) => j.job_name === "ads_sync")!.last_status || "") }}>
                    Status: {summary.last_job_runs.find((j) => j.job_name === "ads_sync")!.last_status ?? "—"}
                  </div>
                )}
              </div>
            </Card>
            <Card title="Notifications" style={{ padding: "var(--space-4)" }}>
              <div style={{ fontSize: "var(--text-sm)" }}>
                Failed: <strong style={{ color: summary.failed_notifications_count > 0 ? "var(--color-error)" : undefined }}>{summary.failed_notifications_count}</strong>
              </div>
            </Card>
          </div>
        </>
      ) : null}

      <Card title="Recent job runs" style={{ marginBottom: "var(--space-4)" }}>
        {loadingJobs ? (
          <LoadingSkeleton height={200} />
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "var(--text-sm)" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--color-border)", textAlign: "left" }}>
                  <th style={{ padding: "var(--space-2) var(--space-3)" }}>Job</th>
                  <th style={{ padding: "var(--space-2) var(--space-3)" }}>Status</th>
                  <th style={{ padding: "var(--space-2) var(--space-3)" }}>Started</th>
                  <th style={{ padding: "var(--space-2) var(--space-3)" }}>Finished</th>
                  <th style={{ padding: "var(--space-2) var(--space-3)" }}>Error</th>
                </tr>
              </thead>
              <tbody>
                {jobs.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ padding: "var(--space-4)", color: "var(--color-text-muted)" }}>
                      No job runs yet.
                    </td>
                  </tr>
                ) : (
                  jobs.map((j) => (
                    <tr key={j.id} style={{ borderBottom: "1px solid var(--color-border)" }}>
                      <td style={{ padding: "var(--space-2) var(--space-3)" }}>{j.job_name}</td>
                      <td style={{ padding: "var(--space-2) var(--space-3)", color: statusColor(j.status) }}>{j.status}</td>
                      <td style={{ padding: "var(--space-2) var(--space-3)" }}>{formatDate(j.started_at)}</td>
                      <td style={{ padding: "var(--space-2) var(--space-3)" }}>{formatDate(j.finished_at)}</td>
                      <td style={{ padding: "var(--space-2) var(--space-3)", maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={j.error ?? ""}>
                        {j.error ?? "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title="Recent notification deliveries (failed highlighted)">
        {loadingNotifications ? (
          <LoadingSkeleton height={200} />
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "var(--text-sm)" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--color-border)", textAlign: "left" }}>
                  <th style={{ padding: "var(--space-2) var(--space-3)" }}>Type</th>
                  <th style={{ padding: "var(--space-2) var(--space-3)" }}>Severity</th>
                  <th style={{ padding: "var(--space-2) var(--space-3)" }}>Channel</th>
                  <th style={{ padding: "var(--space-2) var(--space-3)" }}>Status</th>
                  <th style={{ padding: "var(--space-2) var(--space-3)" }}>Attempts</th>
                  <th style={{ padding: "var(--space-2) var(--space-3)" }}>Created</th>
                  <th style={{ padding: "var(--space-2) var(--space-3)" }}>Error</th>
                </tr>
              </thead>
              <tbody>
                {notifications.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ padding: "var(--space-4)", color: "var(--color-text-muted)" }}>
                      No notification deliveries yet.
                    </td>
                  </tr>
                ) : (
                  notifications.map((n) => (
                    <tr
                      key={n.id}
                      style={{
                        borderBottom: "1px solid var(--color-border)",
                        backgroundColor: n.status === "failed" ? "var(--color-error-muted)" : undefined,
                      }}
                    >
                      <td style={{ padding: "var(--space-2) var(--space-3)" }}>{n.notification_type}</td>
                      <td style={{ padding: "var(--space-2) var(--space-3)" }}>{n.severity}</td>
                      <td style={{ padding: "var(--space-2) var(--space-3)" }}>{n.channel}</td>
                      <td style={{ padding: "var(--space-2) var(--space-3)", color: statusColor(n.status) }}>{n.status}</td>
                      <td style={{ padding: "var(--space-2) var(--space-3)" }}>{n.attempts}</td>
                      <td style={{ padding: "var(--space-2) var(--space-3)" }}>{formatDate(n.created_at)}</td>
                      <td style={{ padding: "var(--space-2) var(--space-3)", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={n.last_error ?? ""}>
                        {n.last_error ?? "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
