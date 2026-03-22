import type { TaxonomyTag } from "@/types/report";

interface TagMeta {
  label: string;
  description: string;
}

export const TAXONOMY: Record<TaxonomyTag, TagMeta> = {
  TimeTrap: {
    label: "Strict deadline",
    description:
      "Deadlines or windows that are easy to miss, locking you in or forfeiting rights.",
  },
  EscapeHatch: {
    label: "Hard to leave",
    description:
      "Cancellation or exit terms that are harder than they first appear.",
  },
  PenaltyDisguise: {
    label: "Hidden fee",
    description:
      "Fees or penalties buried in complex language that most people overlook.",
  },
  SoleDiscretion: {
    label: "They decide",
    description:
      "The other party can make decisions unilaterally, without your input.",
  },
  SilentWaiver: {
    label: "Rights at risk",
    description:
      "You may unknowingly give up rights simply by using the service.",
  },
  BurdenShift: {
    label: "Cost shifts to you",
    description:
      "Responsibilities or costs that shift to you in ways you wouldn't expect.",
  },
  SurpriseBilling: {
    label: "Extra cost risk",
    description:
      "Charges that can appear unexpectedly or increase without clear notice.",
  },
  DataGrab: {
    label: "Data sharing",
    description:
      "Broad permissions to collect, share, or sell your personal data.",
  },
  AutoRenew: {
    label: "Auto-renews",
    description:
      "Automatic renewal terms with narrow cancellation windows.",
  },
  LiabilityWaiver: {
    label: "May avoid paying",
    description:
      "Clauses that limit or eliminate the other party's responsibility to you.",
  },
  ForcedArbitration: {
    label: "No court option",
    description:
      "You must resolve disputes privately instead of going to court.",
  },
  DamagesCap: {
    label: "Payout limited",
    description:
      "Limits on how much compensation you can receive if something goes wrong.",
  },
  ShortenedLimitations: {
    label: "Less time to act",
    description:
      "Reduced time periods for you to take legal action.",
  },
  UncappedFees: {
    label: "Fees can grow",
    description:
      "Fees that have no upper limit and can grow without restriction.",
  },
  UnilateralChange: {
    label: "Terms can change",
    description:
      "The other party can change terms at any time without your agreement.",
  },
};
