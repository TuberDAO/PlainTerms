/**
 * PlainTerms Phase B canonical defaults.
 * Keep in sync with docs/phase-b-defaults.md.
 */

export const REPORT_SCHEMA_VERSION = "pt_report_v0";

export const PREVIEW_FINDINGS_COUNT = 2;

export const DEFAULT_PAID_RETENTION_DAYS = 90;

/** Not wired until guest persistence is implemented. */
export const DEFAULT_GUEST_RETENTION_HOURS = 24;

export const SUPPORTED_LOCALES = ["GB", "US", "CA", "AU"] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export type Severity = "info" | "low" | "medium" | "high" | "critical";

export const SEVERITY_ORDER: Record<Severity, number> = {
  info: 0,
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};
