import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { ConsentBanner } from "@/components/analytics/consent-banner";
import { AnalyticsProvider } from "@/components/analytics/analytics-provider";
import { LocaleProvider } from "@/lib/locale/context";
import { cookies } from "next/headers";
import type { Locale } from "@/types/report";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "PlainTerms — Understand Your Contracts Before You Sign",
  description:
    "AI-powered contract analysis that explains what the fine print really means, in plain language anyone can understand. Not legal advice.",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const locale = (cookieStore.get("locale")?.value ?? "US") as Locale;

  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen bg-background font-sans antialiased">
        <LocaleProvider initialLocale={locale}>
          <AnalyticsProvider>
            <div className="flex min-h-screen flex-col">
              <Navbar />
              <main className="flex-1">{children}</main>
              <Footer />
            </div>
            <ConsentBanner />
          </AnalyticsProvider>
        </LocaleProvider>
      </body>
    </html>
  );
}
