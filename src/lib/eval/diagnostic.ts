import type { Report } from "@/types/report";

// Phrases in atFirstGlance that suggest reassuring surface wording worth contrasting.
const FALSE_SAFETY_TRIGGERS = [
  "included",
  "covered",
  "eligible",
  "may cancel",
  "reasonable",
  "subject to",
  "we may",
  "you may",
];

export interface DiagnosticSummary {
  /** Total findings in the report. */
  findingsCount: number;
  /** Total clause cards in the report. */
  clauseCardsCount: number;
  /** Deduplicated list of taxonomy tags used across all findings. */
  distinctTags: string[];
  /** Count of findings per severity level, e.g. { high: 1, medium: 2 }. */
  severitiesBreakdown: Record<string, number>;
  /** Number of clause cards with empty negotiation fields (both suggestedEdit and fallbackAsk). */
  emptyNegotiationCount: number;
  /** Number of clause cards with at least one non-empty negotiation field. */
  populatedNegotiationCount: number;
  /** Number of recommended questions. */
  recommendedQuestionsCount: number;
  /** Number of letter templates. */
  letterTemplatesCount: number;
  /** Average number of whatToDo items per clause card (0 if no clause cards). */
  avgWhatToDoCount: number;
  /**
   * Heuristic: true when at least one clause card has reassuring "first glance"
   * phrasing (contains a false-safety trigger word) AND a substantial whatItMeans,
   * suggesting the model correctly surfaced an "X but actually Y" contrast.
   */
  hasFalseSenseOfSafetySignals: boolean;
  /** Character length of the serialised report JSON. */
  reportCharacterLength: number;
  /** Whether userQuestion is populated. */
  userQuestionPresent: boolean;
  /** Whether userAnswer is populated. */
  userAnswerPresent: boolean;
  /** Distribution of impactType values across findings, e.g. { cost: 2, renewal: 1 }. */
  impactTypeBreakdown: Record<string, number>;
  /** Distribution of actionTiming values across findings. */
  actionTimingBreakdown: Record<string, number>;
  /** Distribution of decisionRelevance values across findings. */
  decisionRelevanceBreakdown: Record<string, number>;
  /** Whether the document was truncated before being sent to the model. */
  truncated: boolean;
}

export function computeDiagnostic(
  report: Report,
  meta: { truncated: boolean },
): DiagnosticSummary {
  const distinctTags = [
    ...new Set(report.findings.flatMap((f) => f.tags ?? [])),
  ];

  const severitiesBreakdown: Record<string, number> = {};
  const impactTypeBreakdown: Record<string, number> = {};
  const actionTimingBreakdown: Record<string, number> = {};
  const decisionRelevanceBreakdown: Record<string, number> = {};
  for (const f of report.findings) {
    severitiesBreakdown[f.severity] =
      (severitiesBreakdown[f.severity] ?? 0) + 1;
    if (f.impactType)
      impactTypeBreakdown[f.impactType] = (impactTypeBreakdown[f.impactType] ?? 0) + 1;
    if (f.actionTiming)
      actionTimingBreakdown[f.actionTiming] = (actionTimingBreakdown[f.actionTiming] ?? 0) + 1;
    if (f.decisionRelevance)
      decisionRelevanceBreakdown[f.decisionRelevance] = (decisionRelevanceBreakdown[f.decisionRelevance] ?? 0) + 1;
  }

  let emptyNegotiationCount = 0;
  let populatedNegotiationCount = 0;
  let totalWhatToDo = 0;

  for (const c of report.clauseCards) {
    const neg = c.negotiation;
    const hasEdit = (neg?.suggestedEdit?.trim()?.length ?? 0) > 0;
    const hasFallback = (neg?.fallbackAsk?.trim()?.length ?? 0) > 0;
    if (hasEdit || hasFallback) {
      populatedNegotiationCount++;
    } else {
      emptyNegotiationCount++;
    }
    totalWhatToDo += Array.isArray(c.whatToDo) ? c.whatToDo.length : 0;
  }

  const avgWhatToDoCount =
    report.clauseCards.length > 0
      ? Math.round((totalWhatToDo / report.clauseCards.length) * 10) / 10
      : 0;

  const hasFalseSenseOfSafetySignals = report.clauseCards.some((c) => {
    const lower = c.atFirstGlance.toLowerCase();
    return (
      FALSE_SAFETY_TRIGGERS.some((t) => lower.includes(t)) &&
      c.whatItMeans.length > 60
    );
  });

  return {
    findingsCount: report.findings.length,
    clauseCardsCount: report.clauseCards.length,
    distinctTags,
    severitiesBreakdown,
    emptyNegotiationCount,
    populatedNegotiationCount,
    recommendedQuestionsCount: report.actions.recommendedQuestions?.length ?? 0,
    letterTemplatesCount: report.actions.letterTemplates.length,
    avgWhatToDoCount,
    hasFalseSenseOfSafetySignals,
    reportCharacterLength: JSON.stringify(report).length,
    userQuestionPresent: !!report.userQuestion,
    userAnswerPresent: !!report.userAnswer,
    impactTypeBreakdown,
    actionTimingBreakdown,
    decisionRelevanceBreakdown,
    truncated: meta.truncated,
  };
}
