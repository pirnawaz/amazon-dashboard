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
  "/forecasts": {
    title: "Forecasts",
    description: "Demand forecasts and model accuracy metrics.",
    breadcrumbs: [{ label: "Forecasts", path: "/forecasts" }],
  },
  "/restock": {
    title: "Restock",
    description: "Inventory restock recommendations by risk level.",
    breadcrumbs: [{ label: "Restock", path: "/restock" }],
  },
  "/restock/planner": {
    title: "Restock Planner",
    description: "Generate a reorder plan for a single SKU.",
    breadcrumbs: [
      { label: "Restock", path: "/restock" },
      { label: "Planner", path: "/restock/planner" },
    ],
  },
  "/settings": {
    title: "Settings",
    description: "Account and application preferences.",
    breadcrumbs: [{ label: "Settings", path: "/settings" }],
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
