export type Locale = "GB" | "US" | "CA" | "AU";

export type Severity = "info" | "low" | "medium" | "high" | "critical";

export type TaxonomyTag =
  | "TimeTrap"
  | "EscapeHatch"
  | "PenaltyDisguise"
  | "SoleDiscretion"
  | "SilentWaiver"
  | "BurdenShift"
  | "SurpriseBilling"
  | "DataGrab"
  | "AutoRenew"
  | "LiabilityWaiver"
  | "ForcedArbitration"
  | "DamagesCap"
  | "ShortenedLimitations"
  | "UncappedFees"
  | "UnilateralChange";

export type ContractFamily =
  | "insurance"
  | "leases"
  | "contracts"
  | "finance"
  | "employment"
  | "telecom"
  | "gym"
  | "cloud-services";

export interface LetterTemplate {
  id: string;
  title: string;
  body: string;
}

export interface CrossClauseCombo {
  title: string;
  whyItMatters: string;
  clausesInvolved: string[];
  severity: "medium" | "high" | "critical";
  whatToDo: string[];
}

export interface ClauseCard {
  clauseId: string;
  clauseLabel: string;
  originalTextExcerpt: string;
  atFirstGlance: string;
  whatItMeans: string;
  scenario: string;
  whatToDo: string[];
  goDeeper?: string;
  risks?: string[];
  negotiation?: {
    suggestedEdit?: string;
    fallbackAsk?: string;
  };
  crossClauseCombos?: CrossClauseCombo[];
}

export interface Finding {
  id: string;
  title: string;
  severity: Severity;
  score: number;
  tags: TaxonomyTag[];
  shortWhy: string;
  relatedClauseIds: string[];
}

export interface Report {
  id: string;
  locale: Locale;
  contractFamily: ContractFamily;
  createdAtISO: string;
  isPreview: boolean;
  verdict: {
    headline: string;
    summary: string;
    severityOverall: Severity;
    scoreOverall: number;
  };
  findings: Finding[];
  paywalledFindingsCount: number;
  clauseCards: ClauseCard[];
  actions: {
    recommendedQuestions: string[];
    letterTemplates: LetterTemplate[];
  };
}

export interface HeroExample {
  vertical: ContractFamily;
  clauseLabel: string;
  originalTextExcerpt: string;
  atFirstGlance: string;
  whatItMeans: string;
  scenario: string;
  whatToDo: string[];
}
