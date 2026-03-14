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

export type ImpactType =
  | "cost"
  | "service-loss"
  | "cancellation"
  | "renewal"
  | "coverage"
  | "billing"
  | "usage-restriction"
  | "privacy"
  | "weak-remedy"
  | "linked-agreement"
  | "admin-trap"
  | "other";

export type ActionTiming =
  | "before-signing"
  | "before-renewal"
  | "before-cancellation"
  | "before-claim"
  | "if-problem-occurs"
  | "ongoing"
  | "info-only";

export type DecisionRelevance =
  | "decision-critical"
  | "important"
  | "monitor"
  | "background";

export type MechanismType =
  | "arbitration"
  | "class_action_waiver"
  | "subrogation_reimbursement"
  | "coordination_of_benefits"
  | "prior_authorization"
  | "medical_necessity_discretion"
  | "network_limitation"
  | "step_therapy"
  | "appeal_deadline"
  | "termination_rescission"
  | "premium_rate_change"
  | "other";

export interface Finding {
  id: string;
  title: string;
  severity: Severity;
  score: number;
  tags: TaxonomyTag[];
  shortWhy: string;
  relatedClauseIds: string[];
  impactType: ImpactType;
  actionTiming: ActionTiming;
  decisionRelevance: DecisionRelevance;
  mechanismType?: MechanismType;
  sectionLabel?: string;
}

export interface SectionIssues {
  sectionLabel: string;
  issues: Finding[];
}

export interface CoverageStatus {
  mode: "full" | "selected-sections";
  analyzedSections: string[];
  skippedSections: string[];
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
  userQuestion: string | null;
  userAnswer: string | null;
  coverageStatus?: CoverageStatus | null;
  topIssues?: Finding[];
  allIssuesBySection?: SectionIssues[];
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
