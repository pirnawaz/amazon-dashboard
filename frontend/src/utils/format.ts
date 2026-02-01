/**
 * Centralized number and unit formatting for the dashboard.
 * Use these helpers for currency, percent, and units across tables and charts.
 */

const CURRENCY_FORMAT = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Format a number as USD (e.g. $1,234.56). */
export function formatCurrency(value: number): string {
  return CURRENCY_FORMAT.format(value);
}

/** Format a decimal as a percentage (e.g. 0.15 → "15.00%"). */
export function formatPercent(value: number, decimals = 2): string {
  return `${(value * 100).toFixed(decimals)}%`;
}

/** Format an integer with thousands separators (e.g. 12345 → "12,345"). */
export function formatInteger(value: number): string {
  return value.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

/** Format a number with optional decimals and thousands separators. */
export function formatDecimal(value: number, decimals = 2): string {
  if (decimals === 0) return Math.round(value).toLocaleString("en-US");
  return value.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/** Format a short date for chart labels (e.g. "Jan 15"). */
export function formatShortDate(isoDate: string): string {
  const d = new Date(isoDate);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
