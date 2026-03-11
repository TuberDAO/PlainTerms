import { z } from "zod";
import type { Report } from "@/types/report";

const LocaleSchema = z.enum(["GB", "US", "CA", "AU"]);

const SeveritySchema = z.enum(["info", "low", "medium", "high", "critical"]);

const TaxonomyTagSchema = z.enum([
  "TimeTrap",
  "EscapeHatch",
  "PenaltyDisguise",
  "SoleDiscretion",
  "SilentWaiver",
  "BurdenShift",
  "SurpriseBilling",
  "DataGrab",
  "AutoRenew",
  "LiabilityWaiver",
  "ForcedArbitration",
  "DamagesCap",
  "ShortenedLimitations",
  "UncappedFees",
  "UnilateralChange",
]);

const ContractFamilySchema = z.enum([
  "insurance",
  "leases",
  "contracts",
  "finance",
  "employment",
  "telecom",
  "gym",
  "cloud-services",
]);

const LetterTemplateSchema = z.object({
  id: z.string(),
  title: z.string(),
  body: z.string(),
});

const CrossClauseComboSchema = z.object({
  title: z.string(),
  whyItMatters: z.string(),
  clausesInvolved: z.array(z.string()),
  severity: z.enum(["medium", "high", "critical"]),
  whatToDo: z.array(z.string()),
});

const ClauseCardSchema = z.object({
  clauseId: z.string(),
  clauseLabel: z.string(),
  originalTextExcerpt: z.string(),
  atFirstGlance: z.string(),
  whatItMeans: z.string(),
  scenario: z.string(),
  whatToDo: z.array(z.string()),
  goDeeper: z.string().optional(),
  risks: z.array(z.string()).optional(),
  negotiation: z
    .object({
      suggestedEdit: z.string().optional(),
      fallbackAsk: z.string().optional(),
    })
    .optional(),
  crossClauseCombos: z.array(CrossClauseComboSchema).optional(),
});

const ImpactTypeSchema = z.enum([
  "cost",
  "service-loss",
  "cancellation",
  "renewal",
  "coverage",
  "billing",
  "usage-restriction",
  "privacy",
  "weak-remedy",
  "linked-agreement",
  "admin-trap",
  "other",
]);

const ActionTimingSchema = z.enum([
  "before-signing",
  "before-renewal",
  "before-cancellation",
  "before-claim",
  "if-problem-occurs",
  "ongoing",
  "info-only",
]);

const DecisionRelevanceSchema = z.enum([
  "decision-critical",
  "important",
  "monitor",
  "background",
]);

const FindingSchema = z.object({
  id: z.string(),
  title: z.string(),
  severity: SeveritySchema,
  score: z.number(),
  tags: z.array(TaxonomyTagSchema),
  shortWhy: z.string(),
  relatedClauseIds: z.array(z.string()),
  impactType: ImpactTypeSchema.optional().default("other"),
  actionTiming: ActionTimingSchema.optional().default("before-signing"),
  decisionRelevance: DecisionRelevanceSchema.optional().default("important"),
});

export const ReportSchema = z.object({
  id: z.string(),
  locale: LocaleSchema,
  contractFamily: ContractFamilySchema,
  createdAtISO: z.string(),
  isPreview: z.boolean(),
  verdict: z.object({
    headline: z.string(),
    summary: z.string(),
    severityOverall: SeveritySchema,
    scoreOverall: z.number().min(0).max(100),
  }),
  findings: z.array(FindingSchema),
  paywalledFindingsCount: z.number(),
  clauseCards: z.array(ClauseCardSchema),
  actions: z.object({
    recommendedQuestions: z.array(z.string()),
    letterTemplates: z.array(LetterTemplateSchema),
  }),
  userQuestion: z.string().nullable().optional().default(null),
  userAnswer: z.string().nullable().optional().default(null),
});

export function parseReportJson(raw: string): Report {
  const parsed = JSON.parse(raw);
  return ReportSchema.parse(parsed) as Report;
}
