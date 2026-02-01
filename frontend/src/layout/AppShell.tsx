import { useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { getRouteMeta } from "../config/routes";
import Sidebar from "./Sidebar";
import Header from "./Header";

type Props = {
  userEmail?: string;
  onLogout?: () => void;
};

export default function AppShell({ userEmail, onLogout }: Props) {
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
      </div>
    </div>
  );
}
