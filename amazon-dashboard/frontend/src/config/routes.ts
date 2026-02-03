/**
 * Route metadata for page context: title, description, breadcrumbs.
 */

export type RouteMeta = {
  title: string;
  description?: string;
  breadcrumbs?: { label: string; path: string }[];
};

export const ROUTE_META: Record<string, RouteMeta> = {
  "/dashboard": {
    title: "Dashboard",
    description: "Overview of revenue, units, and top products for your selected period.",
    breadcrumbs: [{ label: "Dashboard", path: "/dashboard" }],
  },
  "/ads": {
    title: "Ads",
    description: "Amazon Ads: spend, sales, ACOS, ROAS by marketplace and date.",
    breadcrumbs: [{ label: "Ads", path: "/ads" }],
  },
  "/ads/attribution": {
    title: "Ads Attribution",
    description: "SKU profitability: revenue, ad spend, attributed sales, COGS, net profit, ACOS/ROAS.",
    breadcrumbs: [
      { label: "Ads", path: "/ads" },
      { label: "Attribution", path: "/ads/attribution" },
    ],
  },
  "/forecasts": {
    title: "Forecasts",
    description: "Demand forecasts and model accuracy metrics.",
    breadcrumbs: [{ label: "Forecasts", path: "/forecasts" }],
  },
  "/forecast/overrides": {
    title: "Forecast overrides",
    description: "Owner-only manual overrides (absolute or multiplier) for forecast output.",
    breadcrumbs: [
      { label: "Forecasts", path: "/forecasts" },
      { label: "Overrides", path: "/forecast/overrides" },
    ],
  },
  "/restock": {
    title: "Restock Actions",
    description: "Restock actions from forecast intelligence: order-by date, reorder quantities, and recommendations.",
    breadcrumbs: [{ label: "Restock Actions", path: "/restock" }],
  },
  "/alerts": {
    title: "Alerts",
    description: "In-app alerts and email notifications from inventory and restock logic.",
    breadcrumbs: [{ label: "Alerts", path: "/alerts" }],
  },
  "/inventory": {
    title: "Inventory",
    description: "Inventory levels per SKU and marketplace; freshness and stale warnings.",
    breadcrumbs: [{ label: "Inventory", path: "/inventory" }],
  },
  "/restock/inventory": {
    title: "Restock",
    description: "Inventory restock recommendations by risk level.",
    breadcrumbs: [
      { label: "Restock Actions", path: "/restock" },
      { label: "Restock", path: "/restock/inventory" },
    ],
  },
  "/restock/planner": {
    title: "Restock Planner",
    description: "Generate a reorder plan for a single SKU.",
    breadcrumbs: [
      { label: "Restock Actions", path: "/restock" },
      { label: "Planner", path: "/restock/planner" },
    ],
  },
  "/restock/advanced": {
    title: "Restock recommendations",
    description: "Supplier-aware restock recommendations, what-if scenarios, and PO CSV export.",
    breadcrumbs: [
      { label: "Restock Actions", path: "/restock" },
      { label: "Recommendations", path: "/restock/advanced" },
    ],
  },
  "/admin/suppliers": {
    title: "Suppliers",
    description: "Manage suppliers (owner only).",
    breadcrumbs: [
      { label: "Admin", path: "/admin/audit-log" },
      { label: "Suppliers", path: "/admin/suppliers" },
    ],
  },
  "/admin/restock-settings": {
    title: "SKU Supplier Settings",
    description: "Manage SKU supplier settings: lead time, MOQ, pack size, service level (owner only).",
    breadcrumbs: [
      { label: "Admin", path: "/admin/audit-log" },
      { label: "Restock settings", path: "/admin/restock-settings" },
    ],
  },
  "/settings": {
    title: "Settings",
    description: "Account and application preferences.",
    breadcrumbs: [{ label: "Settings", path: "/settings" }],
  },
  "/settings/alerts": {
    title: "Alert settings",
    description: "Email notifications and alert thresholds (owner only).",
    breadcrumbs: [
      { label: "Settings", path: "/settings" },
      { label: "Alert settings", path: "/settings/alerts" },
    ],
  },
  "/admin/audit-log": {
    title: "Audit log",
    description: "Audit entries for owner-only actions.",
    breadcrumbs: [
      { label: "Admin", path: "/admin/audit-log" },
      { label: "Audit log", path: "/admin/audit-log" },
    ],
  },
  "/admin/amazon": {
    title: "Amazon connection",
    description: "SP-API connection and LWA credential (owner only).",
    breadcrumbs: [
      { label: "Admin", path: "/admin/audit-log" },
      { label: "Amazon connection", path: "/admin/amazon" },
    ],
  },
  "/admin/amazon-accounts": {
    title: "Amazon accounts",
    description: "Manage Amazon account labels for multi-account context (owner only).",
    breadcrumbs: [
      { label: "Admin", path: "/admin/audit-log" },
      { label: "Amazon accounts", path: "/admin/amazon-accounts" },
    ],
  },
  "/admin/catalog-mapping": {
    title: "Catalog Mapping",
    description: "Map SKUs from orders and inventory to internal products (owner only).",
    breadcrumbs: [
      { label: "Admin", path: "/admin/audit-log" },
      { label: "Catalog Mapping", path: "/admin/catalog-mapping" },
    ],
  },
  "/admin/data-health": {
    title: "Data Health",
    description: "Unmapped SKUs and units, data health summary (owner only).",
    breadcrumbs: [
      { label: "Admin", path: "/admin/audit-log" },
      { label: "Data Health", path: "/admin/data-health" },
    ],
  },
  "/admin/system-health": {
    title: "System Health",
    description: "Ops health: sync status, job runs, notification delivery (owner only).",
    breadcrumbs: [
      { label: "Admin", path: "/admin/audit-log" },
      { label: "System Health", path: "/admin/system-health" },
    ],
  },
};

export function getRouteMeta(pathname: string): RouteMeta {
  return (
    ROUTE_META[pathname] ?? {
      title: "Dashboard",
      description: "",
      breadcrumbs: [],
    }
  );
}
