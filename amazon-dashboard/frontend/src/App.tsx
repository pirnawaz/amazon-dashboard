import { useMemo, useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ToastProvider } from "./context/ToastContext";
import { DemoProvider } from "./context/DemoContext";
import AppShell from "./layout/AppShell";
import Dashboard from "./Dashboard";
import Restock from "./Restock";
import RestockPlanner from "./RestockPlanner";
import RestockActions from "./RestockActions";
import Forecast from "./Forecast";
import Inventory from "./Inventory";
import Alerts from "./Alerts";
import RequireOwner from "./components/auth/RequireOwner";
import Settings from "./pages/Settings";
import AlertSettings from "./pages/AlertSettings";
import AmazonConnection from "./pages/AmazonConnection";
import AuditLog from "./pages/AuditLog";
import CatalogMappingPage from "./pages/admin/CatalogMappingPage";
import DataHealthPage from "./pages/admin/DataHealthPage";

const SESSION_EXPIRED_KEY = "seller-hub-session-expired";

function LoginRegisterForm() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);
  const { login, register } = useAuth();

  useEffect(() => {
    try {
      if (sessionStorage.getItem(SESSION_EXPIRED_KEY) === "1") {
        sessionStorage.removeItem(SESSION_EXPIRED_KEY);
        setSessionExpired(true);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const title = useMemo(() => (mode === "login" ? "Login" : "Register"), [mode]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === "login") {
        await login(email, password);
      } else {
        await register(email, password);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      style={{
        maxWidth: 520,
        margin: "40px auto",
        fontFamily: "var(--font-sans)",
        padding: "var(--space-6)",
      }}
    >
      <h1 style={{ marginBottom: "var(--space-4)" }}>Seller Hub</h1>
      {sessionExpired && (
        <p
          style={{
            marginBottom: "var(--space-4)",
            padding: "var(--space-3) var(--space-4)",
            backgroundColor: "var(--color-warning-muted)",
            color: "var(--color-warning)",
            borderRadius: "var(--radius-md)",
            fontSize: "var(--text-sm)",
          }}
        >
          Your session expired. Please log in again.
        </p>
      )}
      <div style={{ display: "flex", gap: "var(--space-2)", marginBottom: "var(--space-4)" }}>
        <button
          onClick={() => setMode("login")}
          disabled={busy}
          style={{
            fontWeight: mode === "login" ? "bold" : "normal",
            padding: "var(--space-2) var(--space-4)",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-md)",
            backgroundColor: mode === "login" ? "var(--color-bg-muted)" : "transparent",
          }}
        >
          Login
        </button>
        <button
          onClick={() => setMode("register")}
          disabled={busy}
          style={{
            fontWeight: mode === "register" ? "bold" : "normal",
            padding: "var(--space-2) var(--space-4)",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-md)",
            backgroundColor: mode === "register" ? "var(--color-bg-muted)" : "transparent",
          }}
        >
          Register
        </button>
      </div>
      <h2>{title}</h2>
      <form
        onSubmit={onSubmit}
        style={{
          display: "grid",
          gap: "var(--space-4)",
          marginTop: "var(--space-4)",
        }}
      >
        <label>
          Email
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            required
            style={{
              width: "100%",
              padding: "var(--space-3)",
              marginTop: "var(--space-1)",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-md)",
            }}
          />
        </label>
        <label>
          Password (min 8 chars)
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            required
            minLength={8}
            style={{
              width: "100%",
              padding: "var(--space-3)",
              marginTop: "var(--space-1)",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-md)",
            }}
          />
        </label>
        <button
          type="submit"
          disabled={busy}
          style={{
            padding: "var(--space-3)",
            backgroundColor: "var(--color-primary)",
            color: "white",
            border: "none",
            borderRadius: "var(--radius-md)",
            fontWeight: "var(--font-medium)",
          }}
        >
          {busy ? "Working..." : title}
        </button>
      </form>
      {error && (
        <pre
          style={{
            background: "var(--color-error-muted)",
            padding: "var(--space-4)",
            marginTop: "var(--space-4)",
            whiteSpace: "pre-wrap",
            borderRadius: "var(--radius-md)",
            color: "var(--color-error)",
          }}
        >
          {error}
        </pre>
      )}
    </div>
  );
}

function AuthenticatedShell() {
  const { token, user, logout, isRestoring } = useAuth();
  if (isRestoring) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
          fontFamily: "var(--font-sans)",
        }}
      >
        Loading…
      </div>
    );
  }
  if (!token || !user) return <Navigate to="/login" replace />;
  return <AppShell token={token} userEmail={user.email} userRole={user.role} onLogout={logout} />;
}

function AppRoutes() {
  const { token, user, isRestoring } = useAuth();

  return (
    <Routes>
      <Route
        path="/login"
        element={
          isRestoring ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                minHeight: "100vh",
                fontFamily: "var(--font-sans)",
              }}
            >
              Loading…
            </div>
          ) : token && user ? (
            <Navigate to="/dashboard" replace />
          ) : (
            <LoginRegisterForm />
          )
        }
      />
      <Route path="/" element={<AuthenticatedShell />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardRoute />} />
        <Route path="forecasts" element={<ForecastRoute />} />
        <Route path="inventory" element={<InventoryRoute />} />
        <Route path="restock" element={<RestockActionsRoute />} />
        <Route path="restock/actions" element={<Navigate to="/restock" replace />} />
        <Route path="restock/inventory" element={<RestockRoute />} />
        <Route path="restock/planner" element={<RestockPlannerRoute />} />
        <Route path="alerts" element={<AlertsRoute />} />
        <Route path="settings" element={<Settings />} />
        <Route
          path="settings/alerts"
          element={
            <RequireOwner>
              <AlertSettingsRoute />
            </RequireOwner>
          }
        />
        <Route
          path="admin/audit-log"
          element={
            <RequireOwner>
              <AuditLog />
            </RequireOwner>
          }
        />
        <Route
          path="admin/amazon"
          element={
            <RequireOwner>
              <AmazonConnectionRoute />
            </RequireOwner>
          }
        />
        <Route
          path="admin/catalog-mapping"
          element={
            <RequireOwner>
              <CatalogMappingRoute />
            </RequireOwner>
          }
        />
        <Route
          path="admin/data-health"
          element={
            <RequireOwner>
              <DataHealthRoute />
            </RequireOwner>
          }
        />
      </Route>
    </Routes>
  );
}

function DashboardRoute() {
  const { token } = useAuth();
  return token ? <Dashboard token={token} /> : null;
}
function ForecastRoute() {
  const { token } = useAuth();
  return token ? <Forecast token={token} /> : null;
}
function RestockRoute() {
  const { token } = useAuth();
  return token ? <Restock token={token} /> : null;
}
function RestockActionsRoute() {
  const { token } = useAuth();
  return token ? <RestockActions token={token} /> : null;
}
function RestockPlannerRoute() {
  const { token } = useAuth();
  return token ? <RestockPlanner token={token} /> : null;
}
function InventoryRoute() {
  const { token } = useAuth();
  return token ? <Inventory token={token} /> : null;
}
function AlertsRoute() {
  const { token } = useAuth();
  return token ? <Alerts token={token} /> : null;
}
function AlertSettingsRoute() {
  const { token } = useAuth();
  return token ? <AlertSettings /> : null;
}
function AmazonConnectionRoute() {
  const { token } = useAuth();
  return token ? <AmazonConnection /> : null;
}
function CatalogMappingRoute() {
  const { token } = useAuth();
  return token ? <CatalogMappingPage /> : null;
}
function DataHealthRoute() {
  const { token } = useAuth();
  return token ? <DataHealthPage /> : null;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <DemoProvider>
            <AppRoutes />
          </DemoProvider>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
