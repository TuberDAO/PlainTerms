"use client";

import type { Finding } from "@/types/report";
import {
  getPrioritySummaryItems,
  isMetadataLowConfidence,
} from "@/lib/report/rank-findings";

const TIMING_SUMMARY_LABELS: Record<string, string> = {
  "before-renewal": "check before renewal",
  "before-cancellation": "check before cancelling",
  "before-claim": "know before making a claim",
  "if-problem-occurs": "relevant if a problem arises",
  ongoing: "monitor on an ongoing basis",
};

interface PrioritySummaryProps {
  findings: Finding[];
}

/**
 * A compact, calm summary block showing the 2–4 most important findings.
 * Renders nothing if there is nothing meaningful to surface.
 */
export function PrioritySummary({ findings }: PrioritySummaryProps) {
  const items = getPrioritySummaryItems(findings);
  if (items.length === 0) return null;

  const lowConfidence = isMetadataLowConfidence(findings);

  return (
    <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50/50 p-5">
      <p className="text-xs font-semibold uppercase tracking-wider text-amber-700">
        Most important right now
      </p>
      <ul className="mt-3 space-y-2.5">
        {items.map((finding, pIdx) => {
          // Only show timing note when metadata is high-confidence and timing
          // adds information beyond the default "before-signing".
          const timingNote =
            !lowConfidence &&
            finding.actionTiming &&
            finding.actionTiming !== "before-signing" &&
            finding.actionTiming !== "info-only"
              ? TIMING_SUMMARY_LABELS[finding.actionTiming]
              : null;

          return (
            <li
              key={`priority-${pIdx}-${finding.id}`}
              className="flex items-start gap-2.5 text-sm leading-relaxed"
            >
              <span className="mt-1.5 block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-amber-500" />
              <span className="text-amber-900">
                <span className="font-medium">{finding.title}.</span>{" "}
                <span className="text-amber-800/80">{finding.shortWhy}</span>
                {timingNote && (
                  <span className="ml-1 text-[11px] font-medium uppercase tracking-wide text-amber-600">
                    {" "}
                    ({timingNote})
                  </span>
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
