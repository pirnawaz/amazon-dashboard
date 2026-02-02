import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Card from "../components/ui/Card";
import Tooltip from "../components/ui/Tooltip";
import { useToast } from "../context/ToastContext";
import {
  getPref,
  setPref,
  PREF_KEYS,
  DEFAULT_MARKETPLACE_DEFAULT,
  DEFAULT_FORECAST_HORIZON_DEFAULT,
  DEFAULT_LEAD_TIME_DAYS_DEFAULT,
  DEFAULT_SERVICE_LEVEL_DEFAULT,
} from "../utils/preferences";
import { useDemo } from "../context/DemoContext";

const MARKETPLACE_OPTIONS = ["ALL", "US", "UK", "DE", "FR", "IT", "ES"] as const;
const HORIZON_OPTIONS = [30, 60] as const;
const SERVICE_LEVEL_OPTIONS = [0.85, 0.9, 0.95, 0.99] as const;

export default function Settings() {
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [marketplace, setMarketplace] = useState<string>(DEFAULT_MARKETPLACE_DEFAULT);
  const [horizon, setHorizon] = useState<number>(DEFAULT_FORECAST_HORIZON_DEFAULT);
  const [leadTimeDays, setLeadTimeDays] = useState<number>(DEFAULT_LEAD_TIME_DAYS_DEFAULT);
  const [serviceLevel, setServiceLevel] = useState<number>(DEFAULT_SERVICE_LEVEL_DEFAULT);
  const { isDemoMode: demoActive, clearDemoMode } = useDemo();

  useEffect(() => {
    setMarketplace(String(getPref(PREF_KEYS.DEFAULT_MARKETPLACE, DEFAULT_MARKETPLACE_DEFAULT)));
    setHorizon(Number(getPref(PREF_KEYS.DEFAULT_FORECAST_HORIZON, DEFAULT_FORECAST_HORIZON_DEFAULT)));
    setLeadTimeDays(Number(getPref(PREF_KEYS.DEFAULT_LEAD_TIME_DAYS, DEFAULT_LEAD_TIME_DAYS_DEFAULT)));
    setServiceLevel(Number(getPref(PREF_KEYS.DEFAULT_SERVICE_LEVEL, DEFAULT_SERVICE_LEVEL_DEFAULT)));
  }, []);

  const handleMarketplace = (v: string) => {
    setMarketplace(v);
    setPref(PREF_KEYS.DEFAULT_MARKETPLACE, v);
    showToast("Default marketplace saved", "success");
  };

  const handleHorizon = (v: number) => {
    setHorizon(v);
    setPref(PREF_KEYS.DEFAULT_FORECAST_HORIZON, v);
    showToast("Default forecast horizon saved", "success");
  };

  const handleLeadTime = (v: number) => {
    const n = Math.max(1, Math.min(365, Math.floor(v)));
    setLeadTimeDays(n);
    setPref(PREF_KEYS.DEFAULT_LEAD_TIME_DAYS, n);
    showToast("Default lead time saved", "success");
  };

  const handleServiceLevel = (v: number) => {
    setServiceLevel(v);
    setPref(PREF_KEYS.DEFAULT_SERVICE_LEVEL, v);
    showToast("Default service level saved", "success");
  };

  const handleClearDemo = () => {
    clearDemoMode();
    showToast("Demo mode cleared. You can now see real data on the Dashboard.", "success");
    navigate("/dashboard", { replace: true });
  };

  return (
    <section style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
      <h2 style={{ margin: 0, fontSize: "var(--text-2xl)", fontWeight: "var(--font-semibold)", color: "var(--color-text)" }}>
        Settings
      </h2>

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
            Amazon Connections
          </h3>
          <p style={{ margin: "0 0 var(--space-4)", fontSize: "var(--text-sm)", color: "var(--color-text-muted)" }}>
            Connect your Amazon Seller Central account to sync orders, inventory, and ads. Not yet available.
          </p>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--space-4)",
              flexWrap: "wrap",
            }}
          >
            <span
              style={{
                padding: "var(--space-1) var(--space-2)",
                backgroundColor: "var(--color-bg-muted)",
                borderRadius: "var(--radius-sm)",
                fontSize: "var(--text-sm)",
                color: "var(--color-text-muted)",
              }}
            >
              Status: {demoActive ? "Connected (mock)" : "Not connected"}
            </span>
            <Tooltip content="Coming soon — Amazon account linking is not available yet.">
              <span style={{ display: "inline-block" }}>
                <button
                  type="button"
                  disabled
                  style={{
                    padding: "var(--space-2) var(--space-4)",
                    border: "1px solid var(--color-border)",
                    borderRadius: "var(--radius-md)",
                    backgroundColor: "var(--color-bg-muted)",
                    color: "var(--color-text-muted)",
                    fontSize: "var(--text-sm)",
                    cursor: "not-allowed",
                  }}
                >
                  Connect Amazon account
                </button>
              </span>
            </Tooltip>
          </div>
        </div>
      </Card>

      {demoActive && (
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
              Demo mode
            </h3>
            <p style={{ margin: "0 0 var(--space-4)", fontSize: "var(--text-sm)", color: "var(--color-text-muted)" }}>
              Sample data is currently shown across the app. Clear it to use real data from your account.
            </p>
            <button
              type="button"
              onClick={handleClearDemo}
              style={{
                padding: "var(--space-2) var(--space-4)",
                backgroundColor: "var(--color-bg-elevated)",
                color: "var(--color-text)",
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius-md)",
                fontWeight: "var(--font-medium)",
                cursor: "pointer",
                fontSize: "var(--text-sm)",
              }}
            >
              Clear demo data
            </button>
          </div>
        </Card>
      )}

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
            Preferences
          </h3>
          <p style={{ margin: "0 0 var(--space-4)", fontSize: "var(--text-sm)", color: "var(--color-text-muted)" }}>
            These defaults are used on the Forecast and Restock Planner pages. Stored locally in your browser.
          </p>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "var(--space-4)",
              maxWidth: 400,
            }}
          >
            <label style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)", fontSize: "var(--text-sm)" }}>
              <span style={{ fontWeight: "var(--font-medium)", color: "var(--color-text)" }}>Default marketplace</span>
              <select
                value={marketplace}
                onChange={(e) => handleMarketplace(e.target.value)}
                style={{
                  padding: "var(--space-2) var(--space-3)",
                  border: "1px solid var(--color-border)",
                  borderRadius: "var(--radius-md)",
                  backgroundColor: "var(--color-bg-elevated)",
                  fontSize: "var(--text-sm)",
                }}
              >
                {MARKETPLACE_OPTIONS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </label>

            <label style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)", fontSize: "var(--text-sm)" }}>
              <span style={{ fontWeight: "var(--font-medium)", color: "var(--color-text)" }}>Default forecast horizon (days)</span>
              <select
                value={horizon}
                onChange={(e) => handleHorizon(Number(e.target.value))}
                style={{
                  padding: "var(--space-2) var(--space-3)",
                  border: "1px solid var(--color-border)",
                  borderRadius: "var(--radius-md)",
                  backgroundColor: "var(--color-bg-elevated)",
                  fontSize: "var(--text-sm)",
                }}
              >
                {HORIZON_OPTIONS.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </label>

            <label style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)", fontSize: "var(--text-sm)" }}>
              <span style={{ fontWeight: "var(--font-medium)", color: "var(--color-text)" }}>Default lead time (days)</span>
              <input
                type="number"
                min={1}
                max={365}
                value={leadTimeDays}
                onChange={(e) => handleLeadTime(Number(e.target.value))}
                style={{
                  padding: "var(--space-2) var(--space-3)",
                  border: "1px solid var(--color-border)",
                  borderRadius: "var(--radius-md)",
                  fontSize: "var(--text-sm)",
                }}
              />
            </label>

            <label style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)", fontSize: "var(--text-sm)" }}>
              <span style={{ fontWeight: "var(--font-medium)", color: "var(--color-text)" }}>Default service level</span>
              <select
                value={serviceLevel}
                onChange={(e) => handleServiceLevel(Number(e.target.value))}
                style={{
                  padding: "var(--space-2) var(--space-3)",
                  border: "1px solid var(--color-border)",
                  borderRadius: "var(--radius-md)",
                  backgroundColor: "var(--color-bg-elevated)",
                  fontSize: "var(--text-sm)",
                }}
              >
                {SERVICE_LEVEL_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
      </Card>
    </section>
  );
}
