import { SeverityBadge } from "@/components/shared/severity-badge";
import type { Finding } from "@/types/report";
import { TAXONOMY } from "@/lib/taxonomy";
import { Badge } from "@/components/ui/badge";
import { isMetadataLowConfidence } from "@/lib/report/rank-findings";

const IMPACT_LABELS: Record<string, string> = {
  cost: "Extra cost risk",
  "service-loss": "Service at risk",
  cancellation: "Hard to cancel",
  renewal: "Renewal risk",
  coverage: "Coverage limit",
  billing: "Billing issue",
  "usage-restriction": "Usage limit",
  privacy: "Privacy concern",
  "weak-remedy": "Weak protection",
  "linked-agreement": "Linked contract",
  "admin-trap": "Paperwork trap",
  other: "Other",
};

const TIMING_LABELS: Record<string, string> = {
  "before-signing": "Check before buying",
  "before-renewal": "Check before renewal",
  "before-cancellation": "Check before cancelling",
  "before-claim": "Know before a claim",
  "if-problem-occurs": "If something goes wrong",
  ongoing: "Keep checking",
  "info-only": "Good to know",
};

const RELEVANCE_STYLES: Record<string, string> = {
  "decision-critical": "border-red-200 bg-red-50 text-red-700",
  important: "border-amber-200 bg-amber-50 text-amber-700",
  monitor: "border-sky-200 bg-sky-50 text-sky-700",
  background: "border-muted bg-muted/50 text-muted-foreground",
};

const RELEVANCE_LABELS: Record<string, string> = {
  "decision-critical": "Check before buying",
  important: "Worth knowing",
  monitor: "Keep an eye on",
  background: "For reference",
};

const CARD_STYLES: Record<string, string> = {
  "decision-critical": "rounded-xl border border-amber-200 bg-amber-50/30 p-5 transition-shadow hover:shadow-sm sm:p-6",
  important: "rounded-xl border bg-card p-5 transition-shadow hover:shadow-sm sm:p-6",
  monitor: "rounded-xl border bg-card p-5 opacity-80 transition-shadow hover:shadow-sm hover:opacity-100 sm:p-6",
  background: "rounded-xl border bg-muted/30 p-5 opacity-70 transition-shadow hover:shadow-sm hover:opacity-100 sm:p-6",
};

const MAX_TAGS_SHOWN = 2;

export function FindingsList({ findings, heading }: { findings: Finding[]; heading?: string }) {
  const lowConfidence = isMetadataLowConfidence(findings);

  return (
    <div className="space-y-4">
      {heading !== undefined && (
        <h2 className="text-lg font-semibold sm:text-xl">{heading}</h2>
      )}
      {findings.map((finding, findingIdx) => {
        const cardClass =
          !lowConfidence && finding.decisionRelevance
            ? (CARD_STYLES[finding.decisionRelevance] ?? CARD_STYLES.important)
            : "rounded-xl border bg-card p-5 transition-shadow hover:shadow-sm sm:p-6";

        const showTimingBadge =
          !lowConfidence &&
          finding.actionTiming &&
          finding.actionTiming !== "before-signing" &&
          finding.actionTiming !== "info-only";

        const showRelevancePill = !lowConfidence && finding.decisionRelevance;

        const visibleTags = finding.tags.slice(0, MAX_TAGS_SHOWN);

        return (
          <div key={`finding-${findingIdx}-${finding.id}`} className={cardClass}>
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
              {visibleTags.map((tag) => (
                <Badge
                  key={`${finding.id}-tag-${tag}`}
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
