import { Badge } from "@/components/ui/badge";
import type { Severity } from "@/types/report";
import { cn } from "@/lib/utils";

const SEVERITY_STYLES: Record<Severity, string> = {
  info: "bg-blue-50 text-blue-700 border-blue-200",
  low: "bg-green-50 text-green-700 border-green-200",
  medium: "bg-amber-50 text-amber-700 border-amber-200",
  high: "bg-orange-50 text-orange-700 border-orange-200",
  critical: "bg-red-50 text-red-700 border-red-200",
};

const SEVERITY_LABELS: Record<Severity, string> = {
  info: "Info",
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
};

export function SeverityBadge({
  severity,
  className,
}: {
  severity: Severity;
  className?: string;
}) {
  return (
    <Badge
      variant="outline"
      className={cn(SEVERITY_STYLES[severity], className)}
    >
      {SEVERITY_LABELS[severity]}
    </Badge>
  );
}
