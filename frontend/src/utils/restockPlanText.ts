import type { RestockActionItem } from "../api";

/**
 * Build a one-line plain-English reorder plan for pasting into WhatsApp/email.
 */
export function buildRestockPlanText(item: RestockActionItem): string {
  const name = item.sku ? `SKU ${item.sku}` : "TOTAL";
  const status = item.status.toUpperCase();
  const orderBy = item.order_by_date ?? "N/A";
  const reorderExpected = Math.round(item.suggested_reorder_qty_expected);
  const reorderHigh = Math.round(item.suggested_reorder_qty_high);
  const reorderPart = `Reorder: ${reorderExpected} units (high: ${reorderHigh})`;
  const daysOfCover =
    item.days_of_cover_expected != null
      ? item.days_of_cover_expected.toFixed(1)
      : "N/A";
  const reason =
    item.reasoning.length > 0 ? item.reasoning[0] : "";
  const reasonPart = reason ? ` — Reason: ${reason}` : "";
  return `${name} — Status: ${status} — Order by ${orderBy} — ${reorderPart} — Days of cover: ${daysOfCover}${reasonPart}`;
}
