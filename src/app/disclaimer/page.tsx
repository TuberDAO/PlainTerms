import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Disclaimer — PlainTerms",
};

export default function DisclaimerPage() {
  return (
    <div className="py-14 sm:py-20">
      <article className="container prose prose-slate mx-auto max-w-2xl px-4 sm:px-6">
        <h1>Disclaimer</h1>

        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <p className="font-semibold text-amber-900">
            PlainTerms is not a law firm and does not provide legal advice.
          </p>
        </div>

        <h2>Educational use only</h2>
        <p>
          All contract analyses, risk scores, findings, recommendations, and
          letter templates provided by PlainTerms are for{" "}
          <strong>educational and informational purposes only</strong>. They
          should not be relied upon as a substitute for professional legal
          advice.
        </p>

        <h2>No solicitor-client relationship</h2>
        <p>
          Using PlainTerms does not create a solicitor-client, attorney-client,
          or any other professional relationship between you and PlainTerms or
          its operators.
        </p>

        <h2>Accuracy limitations</h2>
        <p>
          While we strive to provide accurate and helpful analysis, our AI
          technology may:
        </p>
        <ul>
          <li>Miss nuances specific to your jurisdiction or circumstances</li>
          <li>Misinterpret unusual or highly technical contract language</li>
          <li>
            Provide general guidance that may not apply to your specific
            situation
          </li>
        </ul>

        <h2>Always seek professional advice</h2>
        <p>
          For any contract that involves significant financial commitment,
          legal rights, or personal obligations, we strongly recommend
          consulting a qualified legal professional in your jurisdiction
          before signing.
        </p>

        <h2>Jurisdiction</h2>
        <p>
          Contract law varies significantly between jurisdictions. Our analysis
          provides general guidance but may not reflect the specific laws and
          regulations applicable in your area.
        </p>

        <h2>Contact</h2>
        <p>
          If you have questions about this disclaimer, contact us at{" "}
          <a href="mailto:legal@plainterms.io">legal@plainterms.io</a>.
        </p>

        <p className="text-sm text-muted-foreground">
          Last updated: February 2026
        </p>
      </article>
    </div>
  );
}
