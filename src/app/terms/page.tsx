import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service — PlainTerms",
};

export default function TermsPage() {
  return (
    <div className="py-14 sm:py-20">
      <article className="container prose prose-slate mx-auto max-w-2xl px-4 sm:px-6">
        <h1>Terms of Service</h1>
        <p className="lead">
          By using PlainTerms, you agree to the following terms.
        </p>

        <h2>Service description</h2>
        <p>
          PlainTerms provides AI-powered contract analysis for educational
          purposes. The service analyses contract text and provides
          plain-language explanations, risk assessments, and suggested actions.
        </p>

        <h2>Not legal advice</h2>
        <p>
          <strong>
            PlainTerms does not provide legal advice. The analysis, scores,
            and recommendations are for informational and educational purposes
            only.
          </strong>{" "}
          You should always consult a qualified solicitor, attorney, or legal
          professional before making decisions based on contract analysis.
        </p>

        <h2>User responsibilities</h2>
        <ul>
          <li>
            You are responsible for ensuring you have the right to share any
            contract text you submit for analysis.
          </li>
          <li>
            You agree not to use the service for any unlawful purpose.
          </li>
          <li>
            You understand that AI analysis may not catch every issue in a
            contract.
          </li>
        </ul>

        <h2>Intellectual property</h2>
        <p>
          The PlainTerms service, including its design, code, and content, is
          our intellectual property. Your contract text remains yours — we
          claim no ownership over content you submit.
        </p>

        <h2>Limitation of liability</h2>
        <p>
          To the maximum extent permitted by law, PlainTerms shall not be
          liable for any damages arising from your use of or inability to use
          the service, including any decisions made based on contract analysis
          results.
        </p>

        <h2>Changes to terms</h2>
        <p>
          We may update these terms from time to time. Continued use of the
          service after changes constitutes acceptance of the new terms.
        </p>

        <h2>Contact</h2>
        <p>
          Questions about these terms? Email{" "}
          <a href="mailto:legal@plainterms.io">legal@plainterms.io</a>.
        </p>

        <p className="text-sm text-muted-foreground">
          Last updated: February 2026
        </p>
      </article>
    </div>
  );
}
