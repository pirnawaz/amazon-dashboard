/**
 * User preferences persisted to localStorage (namespaced seller-hub-*).
 * Use getPref/setPref with type guards for type-safe reads.
 */

const PREFIX = "seller-hub-";

export const PREF_KEYS = {
  DEFAULT_MARKETPLACE: `${PREFIX}default-marketplace`,
  DEFAULT_FORECAST_HORIZON: `${PREFIX}default-forecast-horizon`,
  DEFAULT_LEAD_TIME_DAYS: `${PREFIX}default-lead-time-days`,
  DEFAULT_SERVICE_LEVEL: `${PREFIX}default-service-level`,
  /** Set to "true" when user has completed onboarding or dismissed the welcome card. */
  ONBOARDED: `${PREFIX}onboarded`,
  /** Set to "true" when user has loaded sample/demo data. */
  DEMO: `${PREFIX}demo`,
} as const;

export type PrefKey = (typeof PREF_KEYS)[keyof typeof PREF_KEYS];

function storageKey(key: string): string {
  return key.startsWith(PREFIX) ? key : `${PREFIX}${key}`;
}

/**
 * Get a preference value. Returns default if missing or invalid.
 */
export function getPref<K extends PrefKey>(key: K, defaultVal: string): string;
export function getPref<K extends PrefKey>(key: K, defaultVal: number): number;
export function getPref(key: string, defaultVal: string | number): string | number {
  try {
    const raw = localStorage.getItem(storageKey(key));
    if (raw == null || raw === "") return defaultVal;
    if (typeof defaultVal === "number") {
      const n = Number(raw);
      return Number.isNaN(n) ? defaultVal : n;
    }
    return raw;
  } catch {
    return defaultVal;
  }
}

/**
 * Set a preference value.
 */
export function setPref(key: string, value: string | number): void {
  try {
    localStorage.setItem(storageKey(key), String(value));
  } catch {
    // ignore quota or disabled storage
  }
}

/** Type guard: string preference. */
export function isStringPref(val: unknown): val is string {
  return typeof val === "string";
}

/** Type guard: number preference. */
export function isNumberPref(val: unknown): val is number {
  return typeof val === "number" && !Number.isNaN(val);
}

/** Default marketplace: e.g. "US", "ALL". */
export const DEFAULT_MARKETPLACE_DEFAULT = "ALL";

/** Default forecast horizon in days: 30 or 60 (backend max 60). */
export const DEFAULT_FORECAST_HORIZON_DEFAULT = 30;

/** Default lead time in days (1–365). */
export const DEFAULT_LEAD_TIME_DAYS_DEFAULT = 14;

/** Default service level (0.85–0.99). */
export const DEFAULT_SERVICE_LEVEL_DEFAULT = 0.95;

/** Whether the user has completed onboarding (dismissed welcome or loaded demo). */
export function isOnboarded(): boolean {
  return getPref(PREF_KEYS.ONBOARDED, "false") === "true";
}

/** Mark onboarding as complete. */
export function setOnboarded(): void {
  setPref(PREF_KEYS.ONBOARDED, "true");
}

/** Whether demo/sample data mode is active. */
export function isDemoMode(): boolean {
  return getPref(PREF_KEYS.DEMO, "false") === "true";
}

/** Enable demo mode (load sample data). */
export function setDemoMode(): void {
  setPref(PREF_KEYS.DEMO, "true");
}

/** Clear demo mode and remove sample data flag. */
export function clearDemoMode(): void {
  setPref(PREF_KEYS.DEMO, "false");
}
