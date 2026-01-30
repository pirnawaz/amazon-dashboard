import { useMemo, useState } from "react";
import { login, me, register, type UserPublic } from "./api";
import Dashboard from "./Dashboard";
import Restock from "./Restock";

export default function App() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<UserPublic | null>(null);
  const [tab, setTab] = useState<"dashboard" | "restock">("dashboard");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const title = useMemo(() => (mode === "login" ? "Login" : "Register"), [mode]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const tok =
        mode === "login"
          ? await login(email, password)
          : await register(email, password);

      setToken(tok.access_token);

      const u = await me(tok.access_token);
      setUser(u);
    } catch (err: any) {
      setError(err?.message ?? "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  async function refreshMe() {
    if (!token) return;
    setError(null);
    setBusy(true);
    try {
      const u = await me(token);
      setUser(u);
    } catch (err: any) {
      setError(err?.message ?? "Failed to load /me");
    } finally {
      setBusy(false);
    }
  }

  function logout() {
    setToken(null);
    setUser(null);
    setPassword("");
    setError(null);
  }

  return (
    <div style={{ maxWidth: 520, margin: "40px auto", fontFamily: "system-ui, sans-serif" }}>
      <h1>Amazon Dashboard</h1>

      {user && token ? (
        <div>
          <p>
            Logged in as <b>{user.email}</b>
          </p>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
            <button
              onClick={() => setTab("dashboard")}
              style={{ fontWeight: tab === "dashboard" ? "bold" : "normal" }}
            >
              Dashboard
            </button>
            <button
              onClick={() => setTab("restock")}
              style={{ fontWeight: tab === "restock" ? "bold" : "normal" }}
            >
              Restock
            </button>
            <button onClick={refreshMe} disabled={busy} style={{ marginLeft: 8 }}>
              Refresh /me
            </button>
            <button onClick={logout} disabled={busy}>
              Logout
            </button>
          </div>

          {error && (
            <pre style={{ background: "#fee", padding: 12, marginTop: 16, whiteSpace: "pre-wrap" }}>
              {error}
            </pre>
          )}

          {tab === "dashboard" && <Dashboard token={token} />}
          {tab === "restock" && <Restock token={token} />}
        </div>
      ) : (
        <div>
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            <button
              onClick={() => setMode("login")}
              disabled={busy}
              style={{ fontWeight: mode === "login" ? "bold" : "normal" }}
            >
              Login
            </button>
            <button
              onClick={() => setMode("register")}
              disabled={busy}
              style={{ fontWeight: mode === "register" ? "bold" : "normal" }}
            >
              Register
            </button>
          </div>

          <h2>{title}</h2>

          <form onSubmit={onSubmit} style={{ display: "grid", gap: 12 }}>
            <label>
              Email
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                required
                style={{ width: "100%", padding: 8, marginTop: 4 }}
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
                style={{ width: "100%", padding: 8, marginTop: 4 }}
              />
            </label>

            <button type="submit" disabled={busy}>
              {busy ? "Working..." : title}
            </button>
          </form>

          {error && (
            <pre style={{ background: "#fee", padding: 12, marginTop: 16, whiteSpace: "pre-wrap" }}>
              {error}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
