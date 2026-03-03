import type { TaxonomyTag } from "@/types/report";

interface TagMeta {
  label: string;
  description: string;
}

export const TAXONOMY: Record<TaxonomyTag, TagMeta> = {
  TimeTrap: {
    label: "Time Trap",
    description:
      "Deadlines or windows that are easy to miss, locking you in or forfeiting rights.",
  },
  EscapeHatch: {
    label: "Escape Hatch",
    description:
      "Cancellation or exit terms that are harder than they first appear.",
  },
  PenaltyDisguise: {
    label: "Hidden Penalty",
    description:
      "Fees or penalties buried in complex language that most people overlook.",
  },
  SoleDiscretion: {
    label: "Sole Discretion",
    description:
      "The other party can make decisions unilaterally, without your input.",
  },
  SilentWaiver: {
    label: "Silent Waiver",
    description:
      "You may unknowingly give up rights simply by using the service.",
  },
  BurdenShift: {
    label: "Burden Shift",
    description:
      "Responsibilities or costs that shift to you in ways you wouldn't expect.",
  },
  SurpriseBilling: {
    label: "Surprise Billing",
    description:
      "Charges that can appear unexpectedly or increase without clear notice.",
  },
  DataGrab: {
    label: "Data Grab",
    description:
      "Broad permissions to collect, share, or sell your personal data.",
  },
  AutoRenew: {
    label: "Auto-Renew",
    description:
      "Automatic renewal terms with narrow cancellation windows.",
  },
  LiabilityWaiver: {
    label: "Liability Waiver",
    description:
      "Clauses that limit or eliminate the other party's responsibility to you.",
  },
  ForcedArbitration: {
    label: "Forced Arbitration",
    description:
      "You must resolve disputes privately instead of going to court.",
  },
  DamagesCap: {
    label: "Damages Cap",
    description:
      "Limits on how much compensation you can receive if something goes wrong.",
  },
  ShortenedLimitations: {
    label: "Shortened Limitations",
    description:
      "Reduced time periods for you to take legal action.",
  },
  UncappedFees: {
    label: "Uncapped Fees",
    description:
      "Fees that have no upper limit and can grow without restriction.",
  },
  UnilateralChange: {
    label: "Unilateral Change",
    description:
      "The other party can change terms at any time without your agreement.",
  },
};
