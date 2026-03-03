import { SeverityBadge } from "@/components/shared/severity-badge";
import type { Finding } from "@/types/report";
import { TAXONOMY } from "@/lib/taxonomy";
import { Badge } from "@/components/ui/badge";

export function FindingsList({ findings }: { findings: Finding[] }) {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold sm:text-xl">Top findings</h2>
      {findings.map((finding) => (
        <div
          key={finding.id}
          className="rounded-xl border bg-card p-5 transition-shadow hover:shadow-sm sm:p-6"
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <h3 className="text-sm font-semibold sm:text-base">
              {finding.title}
            </h3>
            <SeverityBadge severity={finding.severity} />
          </div>
          <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted-foreground">
            {finding.shortWhy}
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {finding.tags.map((tag) => (
              <Badge
                key={tag}
                variant="secondary"
                className="text-xs font-normal"
              >
                {TAXONOMY[tag]?.label ?? tag}
              </Badge>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
