"use client";

import type { CoverageStatus } from "@/types/report";
import { CheckCircle2, Info } from "lucide-react";

interface CoverageStatusBlockProps {
  coverageStatus: CoverageStatus;
}

export function CoverageStatusBlock({
  coverageStatus,
}: CoverageStatusBlockProps) {
  if (coverageStatus.mode === "full") {
    return (
      <div className="mt-4 flex items-start gap-2.5 rounded-lg border border-green-200 bg-green-50/60 px-4 py-3">
        <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-600" />
        <div>
          <p className="text-sm font-medium text-green-900">
            Full document analysed
          </p>
          {coverageStatus.analyzedSections.length > 0 && (
            <p className="mt-1 text-xs text-green-700/80">
              Sections covered:{" "}
              {coverageStatus.analyzedSections.join(", ")}
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="mt-4 flex items-start gap-2.5 rounded-lg border border-blue-200 bg-blue-50/60 px-4 py-3">
      <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-600" />
      <div>
        <p className="text-sm font-medium text-blue-900">
          Selected sections analysed only
        </p>
        <p className="mt-1 text-xs text-blue-700/80">
          Covered:{" "}
          {coverageStatus.analyzedSections.join(", ")}
        </p>
        {coverageStatus.skippedSections.length > 0 && (
          <p className="mt-0.5 text-xs text-blue-600/70">
            Not included:{" "}
            {coverageStatus.skippedSections.join(", ")}
          </p>
        )}
      </div>
    </div>
  );
}
