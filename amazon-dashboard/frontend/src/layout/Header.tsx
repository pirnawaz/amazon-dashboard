import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useToast } from "../context/ToastContext";

const MARKETPLACE_STORAGE_KEY = "seller-hub-marketplace";

function getStoredMarketplace(): string {
  try {
    const v = localStorage.getItem(MARKETPLACE_STORAGE_KEY);
    if (v === "US" || v === "UK" || v === "DE" || v === "ALL") return v;
  } catch {
    /* ignore */
  }
  return "US";
}

type Breadcrumb = { label: string; path: string };

type Props = {
  title: string;
  description?: string;
  breadcrumbs?: Breadcrumb[];
  userEmail?: string;
  userRole?: "owner" | "partner";
  onLogout?: () => void;
  onMenuClick?: () => void;
};

export default function Header({
  title,
  description,
  breadcrumbs = [],
  userEmail,
  userRole,
  onLogout,
  onMenuClick,
}: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [marketplace, setMarketplace] = useState(getStoredMarketplace);
  const { showToast } = useToast();

  useEffect(() => {
    try {
      localStorage.setItem(MARKETPLACE_STORAGE_KEY, marketplace);
    } catch {
      /* ignore */
    }
  }, [marketplace]);

  const handleLogout = () => {
    onLogout?.();
    setMenuOpen(false);
    showToast("Logged out", "info");
  };

  const showContext = breadcrumbs.length > 1 || (description != null && description !== "");

  return (
    <>
      <header
        style={{
          height: "var(--header-height)",
          backgroundColor: "var(--color-bg-elevated)",
          borderBottom: "1px solid var(--color-border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 var(--space-6)",
          position: "sticky",
          top: 0,
          zIndex: 50,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
          <button
            type="button"
            onClick={onMenuClick}
            className="header-menu-btn"
            style={{
              display: "none",
              padding: "var(--space-2)",
              backgroundColor: "transparent",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-md)",
              color: "var(--color-text)",
              cursor: "pointer",
            }}
            aria-label="Open menu"
          >
            ☰
          </button>
          <h1
            style={{
              margin: 0,
              fontSize: "var(--text-lg)",
              fontWeight: "var(--font-semibold)",
              color: "var(--color-text)",
            }}
          >
            {title}
          </h1>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--space-4)",
          }}
        >
          <div style={{ position: "relative" }}>
            <select
              value={marketplace}
              onChange={(e) => setMarketplace(e.target.value)}
              aria-label="Select marketplace"
              style={{
                padding: "var(--space-2) var(--space-3)",
                fontSize: "var(--text-sm)",
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius-md)",
                backgroundColor: "var(--color-bg-elevated)",
                color: "var(--color-text)",
                cursor: "pointer",
              }}
            >
              <option value="US">US</option>
              <option value="UK">UK</option>
              <option value="DE">DE</option>
              <option value="ALL">All</option>
            </select>
          </div>

          <div style={{ position: "relative" }}>
            <button
              type="button"
              onClick={() => setMenuOpen((o) => !o)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "var(--space-2)",
                padding: "var(--space-2) var(--space-3)",
                backgroundColor: "transparent",
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius-md)",
                color: "var(--color-text)",
                fontSize: "var(--text-sm)",
              }}
              aria-expanded={menuOpen}
              aria-haspopup="true"
            >
              <span
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: "50%",
                  backgroundColor: "var(--color-primary-muted)",
                  color: "var(--color-primary)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "var(--text-xs)",
                  fontWeight: "var(--font-semibold)",
                }}
              >
                {userEmail?.charAt(0).toUpperCase() ?? "?"}
              </span>
              <span style={{ maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis" }}>
                {userEmail ?? "User"}
              </span>
            </button>
            {menuOpen && (
              <>
                <div
                  role="presentation"
                  style={{
                    position: "fixed",
                    inset: 0,
                    zIndex: 40,
                  }}
                  onClick={() => setMenuOpen(false)}
                />
                <div
                  role="menu"
                  style={{
                    position: "absolute",
                    top: "100%",
                    right: 0,
                    marginTop: "var(--space-1)",
                    minWidth: 160,
                    padding: "var(--space-2)",
                    backgroundColor: "var(--color-bg-elevated)",
                    border: "1px solid var(--color-border)",
                    borderRadius: "var(--radius-md)",
                    boxShadow: "var(--shadow-lg)",
                    zIndex: 50,
                  }}
                >
                  <div
                    style={{
                      padding: "var(--space-2) var(--space-3)",
                      fontSize: "var(--text-sm)",
                      color: "var(--color-text-muted)",
                      borderBottom: "1px solid var(--color-border)",
                      marginBottom: "var(--space-2)",
                    }}
                  >
                    {userEmail ?? "—"}
                    {userRole != null && (
                      <span
                        style={{
                          display: "block",
                          fontSize: "var(--text-xs)",
                          textTransform: "capitalize",
                          marginTop: "var(--space-1)",
                        }}
                      >
                        {userRole}
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={handleLogout}
                    style={{
                      display: "block",
                      width: "100%",
                      padding: "var(--space-2) var(--space-3)",
                      textAlign: "left",
                      backgroundColor: "transparent",
                      border: "none",
                      color: "var(--color-error)",
                      fontSize: "var(--text-sm)",
                    }}
                  >
                    Logout
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {showContext && (
        <div
          style={{
            padding: "var(--space-2) var(--space-6)",
            backgroundColor: "var(--color-bg-muted)",
            borderBottom: "1px solid var(--color-border)",
            fontSize: "var(--text-sm)",
            color: "var(--color-text-muted)",
          }}
        >
          {breadcrumbs.length > 0 && (
            <nav aria-label="Breadcrumb" style={{ marginBottom: description ? "var(--space-1)" : 0 }}>
              {breadcrumbs.map((b, i) => (
                <span key={b.path}>
                  {i > 0 && (
                    <span style={{ margin: "0 var(--space-2)", color: "var(--color-text-subtle)" }} aria-hidden>
                      /
                    </span>
                  )}
                  {i === breadcrumbs.length - 1 ? (
                    <span style={{ color: "var(--color-text)" }}>{b.label}</span>
                  ) : (
                    <Link
                      to={b.path}
                      style={{ color: "inherit", textDecoration: "none" }}
                      className="breadcrumb-link"
                    >
                      {b.label}
                    </Link>
                  )}
                </span>
              ))}
            </nav>
          )}
          {description != null && description !== "" && (
            <p style={{ margin: 0, maxWidth: 560 }}>{description}</p>
          )}
        </div>
      )}
    </>
  );
}
