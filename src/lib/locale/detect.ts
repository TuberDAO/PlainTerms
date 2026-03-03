import type { Locale } from "@/types/report";

const SUPPORTED_LOCALES: Locale[] = ["GB", "US", "CA", "AU"];
const DEFAULT_LOCALE: Locale = "US";

const LANGUAGE_TO_LOCALE: Record<string, Locale> = {
  "en-gb": "GB",
  "en-us": "US",
  "en-ca": "CA",
  "en-au": "AU",
};

export function resolveLocaleFromHeaders(
  acceptLanguage: string | null,
  countryHeader: string | null
): Locale {
  if (countryHeader) {
    const upper = countryHeader.toUpperCase() as Locale;
    if (SUPPORTED_LOCALES.includes(upper)) return upper;
  }

  if (acceptLanguage) {
    const languages = acceptLanguage
      .split(",")
      .map((part) => {
        const [lang, q] = part.trim().split(";q=");
        return { lang: lang.toLowerCase().trim(), q: q ? parseFloat(q) : 1 };
      })
      .sort((a, b) => b.q - a.q);

    for (const { lang } of languages) {
      if (LANGUAGE_TO_LOCALE[lang]) return LANGUAGE_TO_LOCALE[lang];
      const prefix = lang.split("-")[0];
      if (prefix === "en") return DEFAULT_LOCALE;
    }
  }

  return DEFAULT_LOCALE;
}

export function parseLocaleCookie(cookieValue: string | undefined): Locale {
  if (!cookieValue) return DEFAULT_LOCALE;
  const upper = cookieValue.toUpperCase() as Locale;
  return SUPPORTED_LOCALES.includes(upper) ? upper : DEFAULT_LOCALE;
}

export { SUPPORTED_LOCALES, DEFAULT_LOCALE };
