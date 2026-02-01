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

/** Format a number with commas (e.g. 50700 → "50,700"). Totals use 0 decimals. */
export function formatCommas(value: number, decimals = 0): string {
  if (decimals === 0) return Math.round(value).toLocaleString("en-US");
  return value.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/** Compact format for large numbers (e.g. 3621 → "3.6k", 1500000 → "1.5M"). */
export function formatCompact(value: number): string {
  if (Math.abs(value) >= 1_000_000) {
    return (value / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  }
  if (Math.abs(value) >= 1_000) {
    return (value / 1_000).toFixed(1).replace(/\.0$/, "") + "k";
  }
  return String(Math.round(value));
}

/** Daily demand: 1 decimal, with "~" prefix for estimates. */
export function formatDailyDemand(value: number, asEstimate = true): string {
  const s = value.toLocaleString("en-US", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  return asEstimate ? `~${s}` : s;
}

/** Forecast totals: 0 decimals, optional "~" prefix. */
export function formatForecastTotal(value: number, asEstimate = false): string {
  const s = Math.round(value).toLocaleString("en-US");
  return asEstimate ? `~${s}` : s;
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
