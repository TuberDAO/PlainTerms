"use client";

type AnalyticsEvent =
  | "page_view"
  | "cta_try_free_scan"
  | "example_flip_toggle"
  | "lead_captured"
  | "analysis_started"
  | "report_viewed"
  | "paywall_viewed"
  | "pricing_viewed"
  | "see_difference_what_to_do_open"
  | "example_report_viewed";

type EventProps = Record<string, string | number | boolean | undefined>;

function hasConsent(): boolean {
  if (typeof document === "undefined") return false;
  return document.cookie.includes("analytics_consent=true");
}

function getUtmParams(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const stored = localStorage.getItem("utm_params");
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

export function captureUtmParams() {
  if (typeof window === "undefined") return;
  const params = new URLSearchParams(window.location.search);
  const utmKeys = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"];
  const utm: Record<string, string> = {};

  for (const key of utmKeys) {
    const value = params.get(key);
    if (value) utm[key] = value;
  }

  if (Object.keys(utm).length > 0) {
    localStorage.setItem("utm_params", JSON.stringify(utm));
  }
}

export function track(event: AnalyticsEvent, props?: EventProps) {
  if (!hasConsent()) return;

  const enrichedProps = {
    ...props,
    ...getUtmParams(),
  };

  // PostHog
  if (
    typeof window !== "undefined" &&
    process.env.NEXT_PUBLIC_POSTHOG_KEY &&
    "posthog" in window
  ) {
    const ph = (window as Record<string, unknown>).posthog as
      | { capture: (e: string, p: EventProps) => void }
      | undefined;
    ph?.capture(event, enrichedProps);
  }

  // GA4
  if (
    typeof window !== "undefined" &&
    process.env.NEXT_PUBLIC_GA4_ID &&
    "gtag" in window
  ) {
    (
      window as unknown as {
        gtag: (cmd: string, event: string, params: EventProps) => void;
      }
    ).gtag("event", event, enrichedProps);
  }

  if (process.env.NODE_ENV === "development") {
    console.log(`[analytics] ${event}`, enrichedProps);
  }
}

export function setConsent(granted: boolean) {
  const value = granted ? "true" : "false";
  const expires = new Date(Date.now() + 365 * 864e5).toUTCString();
  document.cookie = `analytics_consent=${value};expires=${expires};path=/;SameSite=Lax`;
}
