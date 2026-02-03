import { useCallback, useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { getUnmappedSkus, type UserRole } from "../api";

type NavItem = { to: string; label: string };

const SIDEBAR_GROUPS_BASE: { label: string; items: NavItem[] }[] = [
  {
    label: "Insights",
    items: [
      { to: "/dashboard", label: "Dashboard" },
      { to: "/ads", label: "Ads" },
      { to: "/ads/attribution", label: "Attribution" },
      { to: "/forecasts", label: "Forecasts" },
      { to: "/restock", label: "Restock Actions" },
      { to: "/alerts", label: "Alerts" },
    ],
  },
  {
    label: "Inventory",
    items: [
      { to: "/inventory", label: "Inventory" },
      { to: "/restock/inventory", label: "Restock" },
      { to: "/restock/planner", label: "Restock Planner" },
    ],
  },
  {
    label: "Settings",
    items: [{ to: "/settings", label: "Settings" }],
  },
];

const SIDEBAR_OWNER_ITEMS: NavItem[] = [
  { to: "/settings/alerts", label: "Alert settings" },
];

/** Forecast overrides: owner and partner can edit; viewer cannot (link hidden for viewer). */
const SIDEBAR_FORECAST_OVERRIDES_ITEM: NavItem[] = [
  { to: "/forecast/overrides", label: "Forecast overrides" },
];

const SIDEBAR_ADMIN_ITEMS: NavItem[] = [
  { to: "/admin/audit-log", label: "Audit log" },
  { to: "/admin/amazon", label: "Amazon connection" },
  { to: "/admin/amazon-accounts", label: "Amazon accounts" },
  { to: "/admin/catalog-mapping", label: "Catalog Mapping" },
  { to: "/admin/data-health", label: "Data Health" },
  { to: "/admin/system-health", label: "System Health" },
  { to: "/admin/suppliers", label: "Suppliers" },
  { to: "/admin/restock-settings", label: "Restock settings" },
];

function buildSidebarGroups(userRole: UserRole | undefined): { label: string; items: NavItem[] }[] {
  const isOwner = userRole === "owner";
  const canEdit = userRole === "owner" || userRole === "partner";
  const base = SIDEBAR_GROUPS_BASE.map((g) => {
    if (g.label !== "Settings") return g;
    let items = [...g.items];
    if (canEdit) items = [...items, ...SIDEBAR_FORECAST_OVERRIDES_ITEM];
    if (isOwner) items = [...items, ...SIDEBAR_OWNER_ITEMS];
    return { label: g.label, items };
  });
  if (!isOwner) return base;
  return [...base, { label: "Admin", items: SIDEBAR_ADMIN_ITEMS }];
}

type Props = {
  open?: boolean;
  onClose?: () => void;
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  token?: string | null;
  userRole?: UserRole;
};

const CATALOG_MAPPING_UPDATED = "catalog-mapping-updated";

export default function Sidebar({
  open = false,
  onClose,
  collapsed = false,
  onCollapsedChange,
  token,
  userRole,
}: Props) {
  const { pathname } = useLocation();
  const [unmappedCount, setUnmappedCount] = useState<number | null>(null);

  const fetchUnmappedCount = useCallback(() => {
    if (!token || userRole !== "owner") return;
    getUnmappedSkus(token, { limit: 1, offset: 0 })
      .then((res) => setUnmappedCount(res.total))
      .catch(() => setUnmappedCount(null));
  }, [token, userRole]);

  useEffect(() => {
    fetchUnmappedCount();
  }, [fetchUnmappedCount, pathname]);

  useEffect(() => {
    window.addEventListener(CATALOG_MAPPING_UPDATED, fetchUnmappedCount);
    return () => window.removeEventListener(CATALOG_MAPPING_UPDATED, fetchUnmappedCount);
  }, [fetchUnmappedCount]);

  const sidebarGroups = buildSidebarGroups(userRole);
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
          {sidebarGroups.map((group) => (
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
              {!collapsed && group.label === "Admin" && unmappedCount !== null && unmappedCount > 0 && (
                <div
                  style={{
                    padding: "var(--space-2) var(--space-4)",
                    marginBottom: "var(--space-1)",
                    fontSize: "var(--text-xs)",
                    color: "var(--color-warning)",
                  }}
                >
                  <NavLink
                    to="/admin/catalog-mapping"
                    onClick={onClose}
                    style={{ color: "inherit", textDecoration: "none", fontWeight: "var(--font-medium)" }}
                  >
                    Unmapped SKUs: {unmappedCount}
                  </NavLink>
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
