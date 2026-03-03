/**
 * Budget / access control constants.
 * Determines what free (preview) vs paid users can see.
 */

export const PREVIEW_FINDINGS_LIMIT = 3;

export const PREVIEW_CLAUSE_CARDS_LIMIT = 3;

export const FREE_SCANS_PER_GUEST = 1;

export const PAID_TIER = {
  oneOff: {
    priceDisplay: "$4.99",
    priceCents: 499,
    label: "Single Report",
    features: [
      "Full analysis of one contract",
      "All clause breakdowns",
      "Action items and letter templates",
      "Download report (coming soon)",
    ],
  },
  subscription: {
    priceDisplay: "$9.99/mo",
    priceCents: 999,
    label: "Unlimited",
    features: [
      "Unlimited contract analyses",
      "Priority processing",
      "Report history",
      "Email alerts for renewals",
      "Download & share reports (coming soon)",
    ],
  },
} as const;
