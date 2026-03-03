import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { resolveLocaleFromHeaders } from "@/lib/locale/detect";

export async function middleware(request: NextRequest) {
  // 1. Refresh Supabase auth session (sets auth cookies on the response)
  const response = await updateSession(request);

  // 2. Locale detection — apply on top of the same response
  const existingLocale = request.cookies.get("locale")?.value;

  if (existingLocale) {
    response.headers.set("x-locale", existingLocale);
    return response;
  }

  const acceptLanguage = request.headers.get("accept-language");
  const countryHeader =
    request.headers.get("x-vercel-ip-country") ??
    request.headers.get("cf-ipcountry");

  const locale = resolveLocaleFromHeaders(acceptLanguage, countryHeader);

  response.cookies.set("locale", locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
  response.headers.set("x-locale", locale);

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/).*)"],
};
