import type { Finding } from "@/types/report";

// ---------------------------------------------------------------------------
// Sort-score tables — lower number = higher priority
// ---------------------------------------------------------------------------

const RELEVANCE_ORDER: Record<string, number> = {
  "decision-critical": 0,
  important: 1,
  monitor: 2,
  background: 3,
};

const SEVERITY_ORDER: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  info: 4,
};

const TIMING_URGENCY: Record<string, number> = {
  "before-signing": 0,
  "before-renewal": 1,
  "before-cancellation": 1,
  "before-claim": 1,
  "if-problem-occurs": 2,
  ongoing: 3,
  "info-only": 4,
};

// ---------------------------------------------------------------------------
// Default-value sentinels (must match patchReportDefaults in openai.ts)
// ---------------------------------------------------------------------------

const DEFAULT_RELEVANCE = "important";
const DEFAULT_TIMING = "before-signing";
const DEFAULT_IMPACT = "other";

/**
 * Returns true when the finding metadata across a list looks like it consists
 * mostly of backward-compatible Zod defaults rather than model-assigned values.
 *
 * When true, ordering should fall back to severity + original order to avoid
 * old reports being artificially reordered by uninformative default values.
 *
 * Heuristics (all must hold):
 *  1. Every finding has decisionRelevance === "important" (the Zod default)
 *  2. Every finding has actionTiming === "before-signing" (the Zod default)
 *  3. More than half of findings have impactType === "other" (the Zod default)
 */
export function isMetadataLowConfidence(findings: Finding[]): boolean {
  if (findings.length === 0) return true;

  const allRelevanceDefault = findings.every(
    (f) => f.decisionRelevance === DEFAULT_RELEVANCE,
  );
  const allTimingDefault = findings.every(
    (f) => f.actionTiming === DEFAULT_TIMING,
  );
  const otherImpactCount = findings.filter(
    (f) => f.impactType === DEFAULT_IMPACT,
  ).length;
  const majorityOtherImpact = otherImpactCount / findings.length > 0.5;

  return allRelevanceDefault && allTimingDefault && majorityOtherImpact;
}

/**
 * Returns a stable ranked copy of the findings array.
 *
 * When metadata is low-confidence (likely all defaults), falls back to
 * severity-only ordering to avoid misleading reordering by default values.
 *
 * When metadata is meaningful, ranks by:
 *  1. decisionRelevance (decision-critical → background)
 *  2. severity (critical → info)
 *  3. actionTiming urgency (before-signing → info-only)
 *  4. original index (stable tiebreak)
 */
export function rankFindings(findings: Finding[]): Finding[] {
  if (findings.length <= 1) return [...findings];

  const lowConfidence = isMetadataLowConfidence(findings);

  return findings
    .map((f, i) => ({ f, i }))
    .sort(({ f: a, i: ai }, { f: b, i: bi }) => {
      if (lowConfidence) {
        const sDiff =
          (SEVERITY_ORDER[a.severity] ?? 5) -
          (SEVERITY_ORDER[b.severity] ?? 5);
        if (sDiff !== 0) return sDiff;
        return ai - bi; // preserve original order for equal severity
      }

      const relDiff =
        (RELEVANCE_ORDER[a.decisionRelevance] ?? 1) -
        (RELEVANCE_ORDER[b.decisionRelevance] ?? 1);
      if (relDiff !== 0) return relDiff;

      const sevDiff =
        (SEVERITY_ORDER[a.severity] ?? 5) -
        (SEVERITY_ORDER[b.severity] ?? 5);
      if (sevDiff !== 0) return sevDiff;

      const timDiff =
        (TIMING_URGENCY[a.actionTiming] ?? 2) -
        (TIMING_URGENCY[b.actionTiming] ?? 2);
      if (timDiff !== 0) return timDiff;

      return ai - bi; // preserve original order as final tiebreak
    })
    .map(({ f }) => f);
}

/**
 * Returns up to `limit` findings suitable for a "most important right now"
 * summary surface at the top of the report.
 *
 * When metadata is high-confidence:
 *   - Prefer decision-critical findings.
 *   - Also include important findings with urgent action timing.
 * When metadata is low-confidence:
 *   - Fall back to critical/high severity findings only.
 *
 * Returns an empty array if nothing meaningful is found (caller should hide
 * the summary block in that case).
 */
export function getPrioritySummaryItems(
  findings: Finding[],
  limit = 4,
): Finding[] {
  if (findings.length === 0) return [];

  const ranked = rankFindings(findings);
  const lowConfidence = isMetadataLowConfidence(findings);

  if (lowConfidence) {
    return ranked
      .filter((f) => f.severity === "critical" || f.severity === "high")
      .slice(0, limit);
  }

  const urgent = ranked.filter(
    (f) =>
      f.decisionRelevance === "decision-critical" ||
      (f.decisionRelevance === "important" &&
        (f.actionTiming === "before-signing" ||
          f.actionTiming === "before-renewal" ||
          f.actionTiming === "before-cancellation" ||
          f.actionTiming === "before-claim")),
  );

  if (urgent.length > 0) return urgent.slice(0, limit);

  // Fallback: top findings by severity if nothing urgent surfaced
  return ranked
    .filter((f) => f.severity === "critical" || f.severity === "high")
    .slice(0, Math.min(3, limit));
}
