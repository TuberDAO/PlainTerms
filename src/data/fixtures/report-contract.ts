import type { Report } from "@/types/report";

export const reportContract: Report = {
  id: "demo-contract",
  locale: "US",
  contractFamily: "contracts",
  createdAtISO: "2026-02-26T09:15:00Z",
  isPreview: true,
  verdict: {
    headline: "Watch out for auto-renew and data terms",
    summary:
      "This cloud storage service agreement has some standard terms, but the auto-renewal, pricing changes, and data rights clauses could cost you more than you expect. We found 5 areas to review.",
    severityOverall: "medium",
    scoreOverall: 48,
  },
  findings: [
    {
      id: "f-con-1",
      title: "Auto-renewal with price increases and no notification",
      severity: "high",
      score: 24,
      tags: ["AutoRenew", "SurpriseBilling", "TimeTrap"],
      shortWhy:
        "Your subscription renews automatically at whatever the current price is, with no obligation to notify you of changes.",
      relatedClauseIds: ["c-con-1"],
      impactType: "billing",
      actionTiming: "before-renewal",
      decisionRelevance: "decision-critical",
    },
    {
      id: "f-con-2",
      title: "Broad licence to use your uploaded content",
      severity: "high",
      score: 22,
      tags: ["DataGrab", "SilentWaiver"],
      shortWhy:
        "By uploading files, you grant them a wide licence to use your content for 'service improvement' and analytics.",
      relatedClauseIds: ["c-con-2"],
      impactType: "privacy",
      actionTiming: "before-signing",
      decisionRelevance: "decision-critical",
    },
    {
      id: "f-con-3",
      title: "Terms can change at any time without notice",
      severity: "medium",
      score: 16,
      tags: ["UnilateralChange"],
      shortWhy:
        "They can modify any terms and your continued use counts as acceptance.",
      relatedClauseIds: ["c-con-3"],
      impactType: "other",
      actionTiming: "ongoing",
      decisionRelevance: "important",
    },
    {
      id: "f-con-4",
      title: "Limited liability even for data loss",
      severity: "medium",
      score: 14,
      tags: ["LiabilityWaiver", "DamagesCap"],
      shortWhy:
        "If they lose your data, their maximum liability is your last monthly payment.",
      relatedClauseIds: ["c-con-4"],
      impactType: "weak-remedy",
      actionTiming: "if-problem-occurs",
      decisionRelevance: "important",
    },
    {
      id: "f-con-5",
      title: "Account deletion 30 days after cancellation",
      severity: "low",
      score: 10,
      tags: ["TimeTrap"],
      shortWhy:
        "All your data is permanently deleted 30 days after you cancel — no recovery possible.",
      relatedClauseIds: ["c-con-5"],
      impactType: "cancellation",
      actionTiming: "before-cancellation",
      decisionRelevance: "monitor",
    },
  ],
  paywalledFindingsCount: 2,
  clauseCards: [
    {
      clauseId: "c-con-1",
      clauseLabel: "Auto-Renewal & Pricing",
      originalTextExcerpt:
        '"Your subscription will automatically renew at the end of each billing cycle at the then-current rate. It is your responsibility to review pricing before each renewal period. Cancellation must be submitted at least thirty (30) days before the next billing date."',
      atFirstGlance:
        "Your subscription renews automatically. Just cancel if you don't want it anymore.",
      whatItMeans:
        "The price can increase between billing cycles and they don't have to tell you. You're expected to check their pricing page yourself before each renewal. Miss the 30-day cancellation window and you're charged for another full cycle at whatever the new price is.",
      scenario:
        "You signed up at $9.99/month. Six months later, the price quietly increases to $14.99. You don't notice until you see the charge on your credit card statement. You try to cancel but you're 3 days past the cutoff.",
      whatToDo: [
        "Set a recurring calendar reminder 35 days before your billing date.",
        "Check if your credit card offers subscription monitoring or price-change alerts.",
        "Ask customer support if they offer price-lock guarantees for annual plans.",
      ],
      risks: [
        "Unexpected charges at higher rates",
        "No obligation for the company to notify you of price changes",
      ],
    },
    {
      clauseId: "c-con-2",
      clauseLabel: "Content Licence",
      originalTextExcerpt:
        '"By uploading, storing, or transmitting content through the Service, you grant the Company a non-exclusive, worldwide, royalty-free licence to use, reproduce, modify, and analyse such content for the purposes of providing and improving the Service."',
      atFirstGlance:
        "They need some rights to your files so the service works. Normal for cloud storage.",
      whatItMeans:
        "The licence is extremely broad — 'modify and analyse' goes beyond what's needed to store your files. 'Improving the Service' could mean using your documents to train AI models, extract patterns, or inform product decisions without additional consent.",
      scenario:
        "You store confidential business proposals on the platform. The company uses aggregate content analysis to build a competing product feature, technically covered by this licence.",
      whatToDo: [
        "Check the privacy policy for specifics on how content is used for 'improvement'.",
        "Ask if there's an opt-out for content analysis and AI training.",
        "Consider encrypting sensitive files before uploading.",
      ],
    },
    {
      clauseId: "c-con-3",
      clauseLabel: "Terms Modification",
      originalTextExcerpt:
        '"We reserve the right to modify these Terms at any time. Changes will be effective upon posting to our website. Your continued use of the Service following any changes constitutes acceptance of the revised Terms."',
      atFirstGlance:
        "They might update the terms occasionally. That's how all websites work.",
      whatItMeans:
        "They can change any term — pricing, data usage, features, cancellation policy — without sending you a notification. Simply posting it on a webpage you'll never check counts as telling you. Using the service the next day means you 'agreed'.",
      scenario:
        "The company adds a clause allowing them to sell aggregated user data. They post the update on their terms page. You keep using the service and have unknowingly agreed to the new data practices.",
      whatToDo: [
        "Bookmark their terms page and check it periodically.",
        "Ask if they offer email notifications for terms changes.",
        "Consider tools or services that monitor website changes on important pages.",
      ],
    },
    {
      clauseId: "c-con-4",
      clauseLabel: "Liability Cap",
      originalTextExcerpt:
        '"In no event shall the Company be liable for any indirect, incidental, special, or consequential damages. The Company\'s total liability shall not exceed the fees paid by you in the month preceding the event giving rise to the claim."',
      atFirstGlance:
        "If something goes wrong, they'll make it right. There's a limit, but that's normal.",
      whatItMeans:
        "If they lose all your data, the most you could recover is one month's subscription fee. For a $9.99/month plan, that's $9.99 — regardless of whether the lost data was worth thousands. They're also not liable for any knock-on effects.",
      scenario:
        "A server failure permanently deletes your files, including irreplaceable family photos and important documents. The company's maximum liability: $9.99.",
      whatToDo: [
        "Always maintain local backups of important files — never rely solely on cloud storage.",
        "Check if they offer premium plans with higher liability guarantees or SLAs.",
      ],
    },
    {
      clauseId: "c-con-5",
      clauseLabel: "Post-Cancellation Data Retention",
      originalTextExcerpt:
        '"Upon cancellation of your account, all stored content will be permanently deleted thirty (30) calendar days following the effective cancellation date. The Company shall have no obligation to retain or provide access to content after this period."',
      atFirstGlance:
        "They keep your stuff for 30 days after you cancel. Enough time to download it.",
      whatItMeans:
        "Thirty days sounds reasonable, but the clock starts from 'effective cancellation date', which might not be when you clicked cancel. If cancellation takes effect at the end of a billing cycle, you may have less time than you think.",
      scenario:
        "You cancel on March 5th, but cancellation is effective March 31st (end of billing cycle). The 30-day window runs from March 31st. You assume you have until mid-May to download your files, but actually you only have until April 30th.",
      whatToDo: [
        "Download all your data before initiating cancellation.",
        "Ask customer support to confirm exactly when the 30-day window starts.",
      ],
    },
  ],
  actions: {
    recommendedQuestions: [
      "Do you notify customers before price changes take effect?",
      "Can I opt out of content analysis and AI training on my uploaded files?",
      "Do you send email notifications when terms of service change?",
      "What data recovery guarantees or SLAs do you offer?",
      "When exactly does the 30-day data retention window start after cancellation?",
    ],
    letterTemplates: [
      {
        id: "lt-con-1",
        title: "Opt-Out Request for Content Analysis",
        body: "Dear [Company Name],\n\nI am a subscriber to your [Plan Name] service. Having reviewed your terms of service, I am writing to request:\n\n1. Confirmation of whether my uploaded content is used for AI training, analytics, or 'service improvement' beyond storage.\n2. If so, I would like to opt out of all content analysis that is not strictly necessary for providing the storage service.\n3. Written confirmation that my content will not be used to train machine learning models.\n\nPlease respond within 14 business days.\n\nSincerely,\n[Your Name]\n[Account Email/ID]",
      },
    ],
  },
  userQuestion: null,
  userAnswer: null,
};
