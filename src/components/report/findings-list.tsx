import { SeverityBadge } from "@/components/shared/severity-badge";
import type { Finding } from "@/types/report";
import { TAXONOMY } from "@/lib/taxonomy";
import { Badge } from "@/components/ui/badge";
import { isMetadataLowConfidence } from "@/lib/report/rank-findings";

const IMPACT_LABELS: Record<string, string> = {
  cost: "Cost",
  "service-loss": "Service loss",
  cancellation: "Cancellation",
  renewal: "Renewal",
  coverage: "Coverage",
  billing: "Billing",
  "usage-restriction": "Usage",
  privacy: "Privacy",
  "weak-remedy": "Weak remedy",
  "linked-agreement": "Linked",
  "admin-trap": "Admin trap",
  other: "Other",
};

const TIMING_LABELS: Record<string, string> = {
  "before-signing": "Before signing",
  "before-renewal": "Before renewal",
  "before-cancellation": "Before cancelling",
  "before-claim": "Before a claim",
  "if-problem-occurs": "If problem occurs",
  ongoing: "Ongoing",
  "info-only": "Info only",
};

const RELEVANCE_STYLES: Record<string, string> = {
  "decision-critical": "border-red-200 bg-red-50 text-red-700",
  important: "border-amber-200 bg-amber-50 text-amber-700",
  monitor: "border-sky-200 bg-sky-50 text-sky-700",
  background: "border-muted bg-muted/50 text-muted-foreground",
};

const RELEVANCE_LABELS: Record<string, string> = {
  "decision-critical": "Decision-critical",
  important: "Important",
  monitor: "Monitor",
  background: "Background",
};

// Card-level visual weight by decisionRelevance.
// background/monitor cards get slightly reduced opacity so urgent issues read first.
const CARD_STYLES: Record<string, string> = {
  "decision-critical": "rounded-xl border border-amber-200 bg-amber-50/30 p-5 transition-shadow hover:shadow-sm sm:p-6",
  important: "rounded-xl border bg-card p-5 transition-shadow hover:shadow-sm sm:p-6",
  monitor: "rounded-xl border bg-card p-5 opacity-80 transition-shadow hover:shadow-sm hover:opacity-100 sm:p-6",
  background: "rounded-xl border bg-muted/30 p-5 opacity-70 transition-shadow hover:shadow-sm hover:opacity-100 sm:p-6",
};

export function FindingsList({ findings }: { findings: Finding[] }) {
  // Only apply metadata-based card styling when metadata is high-confidence.
  const lowConfidence = isMetadataLowConfidence(findings);

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold sm:text-xl">Findings</h2>
      {findings.map((finding) => {
        const cardClass =
          !lowConfidence && finding.decisionRelevance
            ? (CARD_STYLES[finding.decisionRelevance] ?? CARD_STYLES.important)
            : "rounded-xl border bg-card p-5 transition-shadow hover:shadow-sm sm:p-6";

        // Only show action timing badge when metadata is meaningful and timing
        // adds information (i.e., not the default "before-signing").
        const showTimingBadge =
          !lowConfidence &&
          finding.actionTiming &&
          finding.actionTiming !== "before-signing" &&
          finding.actionTiming !== "info-only";

        // Only show relevance pill when metadata is meaningful.
        const showRelevancePill = !lowConfidence && finding.decisionRelevance;

        return (
          <div key={finding.id} className={cardClass}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <h3 className="text-sm font-semibold sm:text-base">
                {finding.title}
              </h3>
              <SeverityBadge severity={finding.severity} />
            </div>
            <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted-foreground">
              {finding.shortWhy}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              {finding.tags.map((tag) => (
                <Badge
                  key={tag}
                  variant="secondary"
                  className="text-xs font-normal"
                >
                  {TAXONOMY[tag]?.label ?? tag}
                </Badge>
              ))}
              {finding.impactType && finding.impactType !== "other" && (
                <Badge variant="outline" className="text-[11px] font-normal">
                  {IMPACT_LABELS[finding.impactType] ?? finding.impactType}
                </Badge>
              )}
              {showTimingBadge && (
                <Badge variant="outline" className="text-[11px] font-normal">
                  {TIMING_LABELS[finding.actionTiming] ?? finding.actionTiming}
                </Badge>
              )}
              {showRelevancePill && (
                <span
                  className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium leading-none ${RELEVANCE_STYLES[finding.decisionRelevance] ?? RELEVANCE_STYLES.background}`}
                >
                  {RELEVANCE_LABELS[finding.decisionRelevance] ??
                    finding.decisionRelevance}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
