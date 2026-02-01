import { useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { getRouteMeta } from "../config/routes";
import { APP_VERSION } from "../config/version";
import type { UserRole } from "../api";
import Sidebar from "./Sidebar";
import Header from "./Header";

type Props = {
  userEmail?: string;
  userRole?: UserRole;
  onLogout?: () => void;
};

export default function AppShell({ userEmail, userRole, onLogout }: Props) {
  const { pathname } = useLocation();
  const { title, description, breadcrumbs } = getRouteMeta(pathname);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const mainMargin = sidebarCollapsed ? "var(--sidebar-collapsed-width)" : "var(--sidebar-width)";

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
      }}
    >
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        collapsed={sidebarCollapsed}
        onCollapsedChange={setSidebarCollapsed}
        userRole={userRole}
      />
      <div
        className="app-main"
        style={{
          flex: 1,
          marginLeft: mainMargin,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          transition: "margin-left 0.2s ease",
        }}
      >
        <Header
          title={title}
          description={description}
          breadcrumbs={breadcrumbs}
          userEmail={userEmail}
          userRole={userRole}
          onLogout={onLogout}
          onMenuClick={() => setSidebarOpen(true)}
        />
        <main
          style={{
            flex: 1,
            padding: "var(--space-6)",
            overflow: "auto",
          }}
        >
          <Outlet />
        </main>
        <footer
          style={{
            padding: "var(--space-3) var(--space-6)",
            borderTop: "1px solid var(--color-border)",
            fontSize: "var(--text-xs)",
            color: "var(--color-text-muted)",
            backgroundColor: "var(--color-bg-muted)",
          }}
        >
          Seller Hub · v{APP_VERSION}
        </footer>
      </div>
    </div>
  );
}
