import { useMemo, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ToastProvider } from "./context/ToastContext";
import AppShell from "./layout/AppShell";
import Dashboard from "./Dashboard";
import Restock from "./Restock";
import RestockPlanner from "./RestockPlanner";
import Forecast from "./Forecast";
import Settings from "./pages/Settings";

function LoginRegisterForm() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { login, register } = useAuth();

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
      <h1 style={{ marginBottom: "var(--space-4)" }}>Amazon Dashboard</h1>
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
  const { token, user, logout } = useAuth();
  if (!token || !user) return <Navigate to="/login" replace />;
  return <AppShell userEmail={user.email} onLogout={logout} />;
}

function AppRoutes() {
  const { token, user } = useAuth();

  return (
    <Routes>
      <Route
        path="/login"
        element={
          token && user ? <Navigate to="/dashboard" replace /> : <LoginRegisterForm />
        }
      />
      <Route path="/" element={<AuthenticatedShell />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardRoute />} />
        <Route path="forecasts" element={<ForecastRoute />} />
        <Route path="restock" element={<RestockRoute />} />
        <Route path="restock/planner" element={<RestockPlannerRoute />} />
        <Route path="settings" element={<Settings />} />
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
function RestockPlannerRoute() {
  const { token } = useAuth();
  return token ? <RestockPlanner token={token} /> : null;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <AppRoutes />
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
