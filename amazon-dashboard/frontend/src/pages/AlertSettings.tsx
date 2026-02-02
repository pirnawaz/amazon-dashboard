import { useCallback, useEffect, useState } from "react";
import {
  getAlertSettings,
  updateAlertSettings,
  type AlertSettingsResponse,
  type AlertSettingsUpdateRequest,
} from "../api";
import { getDemoAlertSettings, updateDemoAlertSettings } from "../data/demoData";
import Card from "../components/ui/Card";
import EmptyState from "../components/ui/EmptyState";
import LoadingSkeleton from "../components/ui/LoadingSkeleton";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { isDemoMode } from "../utils/preferences";

function isForbidden(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.includes("Owner access required") || msg.includes("403");
}

export default function AlertSettingsPage() {
  const { token } = useAuth();
  const { showToast } = useToast();
  const [settings, setSettings] = useState<AlertSettingsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [form, setForm] = useState<AlertSettingsUpdateRequest>({});
  const [saving, setSaving] = useState(false);

  const loadSettings = useCallback(() => {
    setLoading(true);
    setError(null);
    setForbidden(false);
    if (isDemoMode()) {
      setSettings(getDemoAlertSettings());
      setLoading(false);
      return;
    }
    if (!token) {
      setLoading(false);
      setError("Sign in to load alert settings.");
      return;
    }
    getAlertSettings(token)
      .then(setSettings)
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : "Failed to load alert settings";
        setError(msg);
        setForbidden(isForbidden(err));
        if (!isForbidden(err)) showToast(msg, "error");
      })
      .finally(() => setLoading(false));
  }, [token, showToast]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const handleSave = () => {
    if (isDemoMode()) {
      try {
        setSaving(true);
        const updated = updateDemoAlertSettings(form);
        setSettings(updated);
        setForm({});
        showToast("Settings saved.", "info");
      } catch (e) {
        showToast(e instanceof Error ? e.message : "Validation failed", "error");
      } finally {
        setSaving(false);
      }
      return;
    }
    if (!token) return;
    setSaving(true);
    setError(null);
    setForbidden(false);
    updateAlertSettings(token, form)
      .then((updated) => {
        setSettings(updated);
        setForm({});
        showToast("Settings saved.", "info");
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
      .finally(() => setSaving(false));
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
          Alert settings
        </h2>
        <Card>
          <div style={{ padding: "var(--space-6)" }}>
            <EmptyState
              title="Owner access required"
              description="Only the account owner can view and change alert settings."
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
          Alert settings
        </h2>
        <Card>
          <EmptyState
            title="Something went wrong"
            description={error}
            action={
              <button
                type="button"
                onClick={loadSettings}
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

  const hasSettings = settings != null;
  const showEmpty = !loading && !hasSettings;

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
        Alert settings
      </h2>
      <p style={{ margin: 0, fontSize: "var(--text-sm)", color: "var(--color-text-muted)" }}>
        Configure email notifications and alert thresholds. Only the account owner can change these.
      </p>

      <Card>
        {loading ? (
          <div style={{ padding: "var(--space-6)" }}>
            <LoadingSkeleton />
          </div>
        ) : showEmpty ? (
          <div style={{ padding: "var(--space-6)" }}>
            <EmptyState
              title="Could not load settings"
              description="Alert settings could not be loaded."
              action={
                <button
                  type="button"
                  onClick={loadSettings}
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
          </div>
        ) : (
          <div
            style={{
              padding: "var(--space-6)",
              display: "flex",
              flexDirection: "column",
              gap: "var(--space-4)",
              maxWidth: 480,
            }}
          >
            <label style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
              <input
                type="checkbox"
                checked={form.email_enabled ?? settings?.email_enabled ?? false}
                onChange={(e) => setForm((p) => ({ ...p, email_enabled: e.target.checked }))}
              />
              Email notifications enabled
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
              <span style={{ fontSize: "var(--text-sm)" }}>
                Recipients (comma-separated; leave empty for all users)
              </span>
              <input
                type="text"
                value={
                  form.email_recipients !== undefined && form.email_recipients !== null
                    ? form.email_recipients
                    : settings?.email_recipients ?? ""
                }
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    email_recipients: e.target.value.trim() ? e.target.value.trim() : null,
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
                    checked={form[key] ?? settings?.[key] ?? true}
                    onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.checked }))}
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
                value={form.stale_days_threshold ?? settings?.stale_days_threshold ?? 7}
                onChange={(e) =>
                  setForm((p) => ({
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
                onClick={handleSave}
                disabled={saving}
                style={{
                  padding: "var(--space-3)",
                  backgroundColor: "var(--color-primary)",
                  color: "white",
                  border: "none",
                  borderRadius: "var(--radius-md)",
                  fontWeight: "var(--font-medium)",
                  cursor: saving ? "not-allowed" : "pointer",
                }}
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        )}
      </Card>
    </section>
  );
}
