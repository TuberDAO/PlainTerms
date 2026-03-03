import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — PlainTerms",
};

export default function PrivacyPage() {
  return (
    <div className="py-14 sm:py-20">
      <article className="container prose prose-slate mx-auto max-w-2xl px-4 sm:px-6">
        <h1>Privacy Policy</h1>
        <p className="lead">
          Your privacy matters. This policy explains what data we collect and
          how we use it.
        </p>

        <h2>What we collect</h2>
        <ul>
          <li>
            <strong>Email address</strong> — only if you voluntarily subscribe
            to updates or create an account.
          </li>
          <li>
            <strong>Contract text</strong> — processed in real-time for
            analysis. We do not store your contract text on our servers.
          </li>
          <li>
            <strong>Usage analytics</strong> — anonymous page views and
            interaction events, only with your consent.
          </li>
          <li>
            <strong>Locale and language preference</strong> — detected
            automatically and stored in a cookie.
          </li>
        </ul>

        <h2>How we use your data</h2>
        <ul>
          <li>To provide contract analysis results.</li>
          <li>To send product updates (email subscribers only, opt-in).</li>
          <li>To improve our service through anonymous analytics.</li>
        </ul>

        <h2>Cookies</h2>
        <p>
          We use essential cookies for locale preferences and optional
          analytics cookies (only with your consent). You can change your
          preferences at any time.
        </p>

        <h2>Third parties</h2>
        <p>
          We may use PostHog for analytics (with consent), Supabase for data
          storage, and Vercel for hosting. We do not sell your data to third
          parties.
        </p>

        <h2>Your rights</h2>
        <p>
          You can request deletion of your data at any time by contacting us
          at{" "}
          <a href="mailto:privacy@plainterms.io">privacy@plainterms.io</a>.
        </p>

        <h2>Contact</h2>
        <p>
          For privacy concerns, email{" "}
          <a href="mailto:privacy@plainterms.io">privacy@plainterms.io</a>.
        </p>

        <p className="text-sm text-muted-foreground">
          Last updated: February 2026
        </p>
      </article>
    </div>
  );
}
