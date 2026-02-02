/**
 * Insight utilities: compare time ranges (e.g. last 7 days vs previous 7 days)
 * for "What changed?" metrics. Defensive against missing/partial data.
 */

export type DailyPoint = {
  date: string;
  units: number;
  revenue?: number;
};

/**
 * Sum a numeric field over points within [start, end] (inclusive).
 * Dates are ISO date strings; start/end are inclusive.
 */
export function sumRange(
  points: { date: string; [k: string]: unknown }[],
  start: string,
  end: string,
  field: "units" | "revenue" = "units"
): number {
  if (!Array.isArray(points) || points.length === 0) return 0;
  let sum = 0;
  for (const p of points) {
    const d = p.date;
    if (typeof d !== "string") continue;
    if (d < start || d > end) continue;
    const v = p[field];
    if (typeof v === "number" && !Number.isNaN(v)) sum += v;
  }
  return sum;
}

/**
 * Percentage change from previous to current: ((current - previous) / previous) * 100.
 * Returns null if previous is 0 or invalid.
 */
export function pctChange(current: number, previous: number): number | null {
  if (previous === 0 || !Number.isFinite(previous) || !Number.isFinite(current)) return null;
  return ((current - previous) / previous) * 100;
}

/**
 * Compare last 7 days vs previous 7 days for units (and revenue if present).
 * points must be sorted by date ascending (oldest first).
 */
export function rolling7dComparison(points: DailyPoint[]): {
  last7Units: number;
  prev7Units: number;
  last7Revenue: number;
  prev7Revenue: number;
  unitsPctChange: number | null;
  revenuePctChange: number | null;
} {
  const result = {
    last7Units: 0,
    prev7Units: 0,
    last7Revenue: 0,
    prev7Revenue: 0,
    unitsPctChange: null as number | null,
    revenuePctChange: null as number | null,
  };

  if (!Array.isArray(points) || points.length < 2) return result;

  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date));
  const lastDate = sorted[sorted.length - 1].date;

  const lastDateObj = new Date(lastDate);
  const endLast7 = lastDate;
  const startLast7 = new Date(lastDateObj);
  startLast7.setDate(startLast7.getDate() - 6);
  const startLast7Str = startLast7.toISOString().slice(0, 10);

  const startPrev7 = new Date(startLast7);
  startPrev7.setDate(startPrev7.getDate() - 7);
  const startPrev7Str = startPrev7.toISOString().slice(0, 10);
  const endPrev7 = new Date(startLast7);
  endPrev7.setDate(endPrev7.getDate() - 1);
  const endPrev7Str = endPrev7.toISOString().slice(0, 10);

  result.last7Units = sumRange(sorted, startLast7Str, endLast7, "units");
  result.prev7Units = sumRange(sorted, startPrev7Str, endPrev7Str, "units");
  result.last7Revenue = sumRange(sorted, startLast7Str, endLast7, "revenue");
  result.prev7Revenue = sumRange(sorted, startPrev7Str, endPrev7Str, "revenue");

  result.unitsPctChange = pctChange(result.last7Units, result.prev7Units);
  result.revenuePctChange =
    result.prev7Revenue > 0 ? pctChange(result.last7Revenue, result.prev7Revenue) : null;

  return result;
}
