import type { Report } from "@/types/report";

/**
 * Stable mock report returned by runReportAnalysis when
 * PLAINTERMS_LLM_MODE=mock.  Passes the Zod ReportSchema and
 * exercises the rendering path with realistic (but deterministic) data.
 */
export const MOCK_REPORT: Report = {
  id: "generated",
  locale: "US",
  contractFamily: "insurance",
  createdAtISO: "2026-01-01T00:00:00Z",
  isPreview: false,
  verdict: {
    headline: "This contract has a few clauses worth reviewing",
    summary:
      "The document contains standard terms overall, but three clauses may limit your rights or increase costs unexpectedly. We recommend reviewing the auto-renewal, liability cap, and data-sharing sections before signing.",
    severityOverall: "medium",
    scoreOverall: 68,
  },
  findings: [
    {
      id: "f-1",
      title: "Auto-renewal locks you in for another year",
      severity: "high",
      score: 30,
      tags: ["AutoRenew", "TimeTrap"],
      shortWhy:
        "The contract renews automatically and requires 60 days written notice to cancel.",
      relatedClauseIds: ["c-1"],
    },
    {
      id: "f-2",
      title: "Liability capped at fees paid in prior 12 months",
      severity: "medium",
      score: 20,
      tags: ["DamagesCap", "LiabilityWaiver"],
      shortWhy:
        "If something goes wrong, the most you can recover is what you paid last year.",
      relatedClauseIds: ["c-2"],
    },
    {
      id: "f-3",
      title: "Broad data sharing with unnamed partners",
      severity: "low",
      score: 10,
      tags: ["DataGrab"],
      shortWhy:
        "Your personal data may be shared with third-party partners for marketing purposes.",
      relatedClauseIds: ["c-3"],
    },
  ],
  paywalledFindingsCount: 0,
  clauseCards: [
    {
      clauseId: "c-1",
      clauseLabel: "Auto-Renewal & Cancellation",
      originalTextExcerpt:
        '"This agreement shall automatically renew for successive twelve-month periods unless the subscriber provides written notice of cancellation not fewer than sixty (60) days prior to the renewal date."',
      atFirstGlance:
        "The contract renews so you stay covered. Sounds convenient.",
      whatItMeans:
        "You must remember to cancel in writing at least two months before renewal, or you are locked in for another full year — even if pricing has changed.",
      scenario:
        "You decide to switch providers but your renewal is 45 days away. You are stuck paying for another 12 months.",
      whatToDo: [
        "Set a calendar reminder 90 days before the renewal date.",
        "Ask whether email counts as written notice.",
      ],
      risks: [
        "Locked into a full year if you miss the cancellation window",
        "Premium may increase at renewal without cap",
      ],
      negotiation: {
        suggestedEdit:
          "Reduce the cancellation notice period to 30 days and allow electronic notice.",
        fallbackAsk:
          "Can you confirm that email to support@provider.com counts as written notice?",
      },
    },
    {
      clauseId: "c-2",
      clauseLabel: "Limitation of Liability",
      originalTextExcerpt:
        '"In no event shall the Provider\'s aggregate liability exceed the total fees paid by the Subscriber during the twelve (12) months immediately preceding the claim."',
      atFirstGlance:
        "They limit how much they will pay if something goes wrong. Most contracts do this.",
      whatItMeans:
        "If the service causes significant damage — data loss, business interruption — the maximum you can recover is one year of fees, regardless of actual losses.",
      scenario:
        "A service outage costs your business $50,000 in lost revenue, but you only paid $1,200 in fees last year. The most you can claim is $1,200.",
      whatToDo: [
        "Negotiate a higher liability cap or carve-outs for gross negligence.",
        "Check whether your business insurance covers the gap.",
      ],
    },
    {
      clauseId: "c-3",
      clauseLabel: "Data Sharing",
      originalTextExcerpt:
        '"We may share your information with our affiliates and business partners for purposes including marketing, analytics, and service improvement."',
      atFirstGlance:
        "They share some data with partners. Most companies do this.",
      whatItMeans:
        "Your usage data and personal information can be shared with unnamed third parties. You have limited visibility into who receives your data or how they use it.",
      scenario:
        "You start receiving marketing emails from companies you have never heard of because the provider shared your contact details.",
      whatToDo: [
        "Ask for a list of partners who receive your data.",
        "Request an opt-out for marketing-related data sharing.",
      ],
    },
  ],
  actions: {
    recommendedQuestions: [
      "Can you reduce the cancellation notice period to 30 days?",
      "Is there a cap on annual price increases at renewal?",
      "Will you agree to a higher liability cap for gross negligence or data breaches?",
      "Can I opt out of data sharing with marketing partners?",
    ],
    letterTemplates: [
      {
        id: "lt-1",
        title: "Cancellation Terms Negotiation",
        body: "Dear [Provider],\n\nI am reviewing the agreement and would like to discuss the auto-renewal terms. Specifically, I would appreciate:\n1. A reduction of the cancellation notice period from 60 to 30 days.\n2. Confirmation that electronic notice via email is acceptable.\n\nPlease let me know if these adjustments are possible.\n\nSincerely,\n[Your Name]",
      },
    ],
  },
};
