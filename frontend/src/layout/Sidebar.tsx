import { NavLink } from "react-router-dom";

type NavItem = { to: string; label: string };

const SIDEBAR_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: "Insights",
    items: [
      { to: "/dashboard", label: "Dashboard" },
      { to: "/forecasts", label: "Forecasts" },
    ],
  },
  {
    label: "Inventory",
    items: [
      { to: "/restock", label: "Restock" },
      { to: "/restock/planner", label: "Restock Planner" },
    ],
  },
  {
    label: "Settings",
    items: [{ to: "/settings", label: "Settings" }],
  },
];

type Props = {
  open?: boolean;
  onClose?: () => void;
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
};

export default function Sidebar({
  open = false,
  onClose,
  collapsed = false,
  onCollapsedChange,
}: Props) {
  return (
    <>
      <aside
        className={`sidebar ${collapsed ? "sidebar--collapsed" : ""} ${open ? "sidebar--open" : ""}`}
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: collapsed ? "var(--sidebar-collapsed-width)" : "var(--sidebar-width)",
          height: "100vh",
          backgroundColor: "var(--color-sidebar-bg)",
          color: "var(--color-sidebar-text)",
          display: "flex",
          flexDirection: "column",
          zIndex: 100,
          transition: "width 0.2s ease",
        }}
      >
        <div
          style={{
            padding: "var(--space-4)",
            borderBottom: "1px solid rgba(255,255,255,0.08)",
            minHeight: "var(--header-height)",
            display: "flex",
            alignItems: "center",
            justifyContent: collapsed ? "center" : "flex-start",
          }}
        >
          {!collapsed && (
            <span
              style={{
                fontWeight: "var(--font-bold)",
                fontSize: "var(--text-lg)",
              }}
            >
              Seller Hub
            </span>
          )}
        </div>
        <nav
          style={{
            flex: 1,
            padding: "var(--space-2)",
            overflowY: "auto",
          }}
          aria-label="Main navigation"
        >
          {SIDEBAR_GROUPS.map((group) => (
            <div key={group.label} style={{ marginBottom: "var(--space-4)" }}>
              {!collapsed && (
                <div
                  style={{
                    padding: "var(--space-2) var(--space-4)",
                    fontSize: "var(--text-xs)",
                    fontWeight: "var(--font-semibold)",
                    color: "var(--color-sidebar-text-muted)",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  {group.label}
                </div>
              )}
              <ul
                style={{
                  listStyle: "none",
                  margin: 0,
                  padding: 0,
                }}
              >
                {group.items.map(({ to, label }) => (
                  <li key={to} style={{ marginBottom: "var(--space-1)" }}>
                    <NavLink
                      to={to}
                      onClick={onClose}
                      end={true}
                      className={({ isActive }) =>
                        `sidebar-link ${isActive ? "sidebar-link--active" : ""}`
                      }
                      style={({ isActive }) => ({
                        display: "flex",
                        alignItems: "center",
                        gap: "var(--space-3)",
                        padding: "var(--space-3) var(--space-4)",
                        color: isActive
                          ? "var(--color-sidebar-text)"
                          : "var(--color-sidebar-text-muted)",
                        textDecoration: "none",
                        borderRadius: "var(--radius-md)",
                        backgroundColor: isActive ? "var(--color-sidebar-active)" : "transparent",
                        fontSize: "var(--text-sm)",
                        fontWeight: isActive ? "var(--font-medium)" : "var(--font-normal)",
                      })}
                    >
                      <span>{label}</span>
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
        <button
          type="button"
          onClick={() => onCollapsedChange?.(!collapsed)}
          style={{
            margin: "var(--space-2)",
            padding: "var(--space-2)",
            backgroundColor: "transparent",
            border: "1px solid rgba(255,255,255,0.2)",
            color: "var(--color-sidebar-text-muted)",
            borderRadius: "var(--radius-sm)",
            fontSize: "var(--text-xs)",
          }}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? "→" : "←"}
        </button>
      </aside>
      <div
        className={`sidebar-overlay ${open ? "sidebar-overlay--visible" : ""}`}
        style={{
          display: "none",
          position: "fixed",
          inset: 0,
          backgroundColor: "rgba(0,0,0,0.5)",
          zIndex: 99,
        }}
        role="presentation"
        onClick={onClose}
        aria-hidden="true"
      />
    </>
  );
}
