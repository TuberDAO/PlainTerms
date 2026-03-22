"use client";

import { SeverityBadge } from "@/components/shared/severity-badge";
import type { Report } from "@/types/report";

export function VerdictHeader({ verdict }: { verdict: Report["verdict"] }) {
  return (
    <div className="rounded-xl border bg-card p-6 shadow-sm sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
            {verdict.headline}
          </h1>
          <div className="mt-3 flex items-center gap-3">
            <SeverityBadge severity={verdict.severityOverall} />
            <span className="text-sm text-muted-foreground">
              Risk score: {verdict.scoreOverall}/100
            </span>
          </div>
        </div>
      </div>
      <p className="mt-5 max-w-prose text-base leading-relaxed text-muted-foreground">
        {verdict.summary}
      </p>
    </div>
  );
}
