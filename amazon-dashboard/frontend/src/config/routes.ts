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
      { label: "Admin", path: "/admin/amazon" },
      { label: "Amazon connection", path: "/admin/amazon" },
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
