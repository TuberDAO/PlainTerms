"use client";

import { useEffect } from "react";
import { VerdictHeader } from "@/components/report/verdict-header";
import { FindingsList } from "@/components/report/findings-list";
import { PaywallBlock } from "@/components/report/paywall-block";
import { ClauseCardFull } from "@/components/report/clause-card-full";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Download, Share2, AlertTriangle } from "lucide-react";
import { UserQuestionAnswer } from "@/components/report/user-question-answer";
import { PrioritySummary } from "@/components/report/priority-summary";
import { CoverageStatusBlock } from "@/components/report/coverage-status";
import { track } from "@/lib/analytics/tracker";
import {
  PREVIEW_FINDINGS_LIMIT,
  PREVIEW_CLAUSE_CARDS_LIMIT,
} from "@/lib/budget";
import Link from "next/link";
import type { Report } from "@/types/report";
import { rankFindings } from "@/lib/report/rank-findings";

interface ReportPageClientProps {
  report: Report | null;
}

export function ReportPageClient({ report }: ReportPageClientProps) {
  useEffect(() => {
    if (report) {
      track("report_viewed", { isPreview: report.isPreview });
    }
  }, [report]);

  if (!report) {
    return (
      <div className="py-20 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">
          Report not found
        </h1>
        <p className="mt-2 text-muted-foreground">
          The report you&apos;re looking for doesn&apos;t exist.
        </p>
        <Button className="mt-6 rounded-lg font-semibold shadow-sm" asChild>
          <Link href="/analyze">Analyse a contract</Link>
        </Button>
      </div>
    );
  }

  const rankedFindings = rankFindings(report.findings);
  const hasTopIssues = !report.isPreview && Array.isArray(report.topIssues) && report.topIssues.length > 0;
  const hasAllBySection = !report.isPreview && Array.isArray(report.allIssuesBySection) && report.allIssuesBySection.length > 0;
  const totalSectionIssues = hasAllBySection
    ? report.allIssuesBySection!.reduce((s, sec) => s + sec.issues.length, 0)
    : 0;
  const showSectionView = hasAllBySection && totalSectionIssues > (report.topIssues?.length ?? 0);

  const visibleFindings = report.isPreview
    ? rankedFindings.slice(0, PREVIEW_FINDINGS_LIMIT)
    : hasTopIssues
      ? report.topIssues!
      : rankedFindings;

  const visibleClauses = report.isPreview
    ? report.clauseCards.slice(0, PREVIEW_CLAUSE_CARDS_LIMIT)
    : report.clauseCards;

  return (
    <div className="py-10 md:py-16">
      <div className="mx-auto max-w-4xl px-6">
        {/* Disclaimer */}
        <div className="mb-8 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600" />
          <p className="max-w-prose text-sm leading-relaxed text-amber-800">
            This analysis is for educational purposes only and does not
            constitute legal advice. Always consult a qualified legal
            professional for specific legal matters.
          </p>
        </div>

        <VerdictHeader verdict={report.verdict} />

        {/* Coverage status — shows what was analysed */}
        {report.coverageStatus && (
          <CoverageStatusBlock coverageStatus={report.coverageStatus} />
        )}

        {/* Priority summary — most important issues right now */}
        <PrioritySummary findings={report.findings} />

        {/* User Q&A */}
        {report.userQuestion && report.userAnswer && (
          <div className="mt-6">
            <UserQuestionAnswer
              userQuestion={report.userQuestion}
              userAnswer={report.userAnswer}
            />
          </div>
        )}

        {/* Export buttons */}
        <div className="mt-5 flex gap-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  disabled
                  className="gap-2 rounded-lg"
                >
                  <Download className="h-4 w-4" />
                  Export PDF
                </Button>
              </TooltipTrigger>
              <TooltipContent>Coming soon</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  disabled
                  className="gap-2 rounded-lg"
                >
                  <Share2 className="h-4 w-4" />
                  Share
                </Button>
              </TooltipTrigger>
              <TooltipContent>Coming soon</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        {/* Findings — topIssues when available, full list otherwise */}
        <div className="mt-10">
          <FindingsList
            findings={visibleFindings}
            heading={hasTopIssues ? "Key findings" : "Findings"}
          />
        </div>

        {/* Paywall block */}
        {report.isPreview && report.paywalledFindingsCount > 0 && (
          <div className="mt-6">
            <PaywallBlock count={report.paywalledFindingsCount} />
          </div>
        )}

        {/* All findings by section — full coverage for non-preview large-doc reports */}
        {showSectionView && (
          <div className="mt-12">
            <h2 className="text-lg font-semibold sm:text-xl">
              All findings by section
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Complete issue coverage across {report.allIssuesBySection!.length}{" "}
              section{report.allIssuesBySection!.length !== 1 ? "s" : ""} ({totalSectionIssues}{" "}
              total)
            </p>
            {report.allIssuesBySection!.map((section) => (
              <div key={section.sectionLabel} className="mt-6">
                <h3 className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  {section.sectionLabel}
                </h3>
                <FindingsList findings={section.issues} />
              </div>
            ))}
          </div>
        )}

        {/* Clause cards */}
        <div className="mt-12">
          <h2 className="text-lg font-semibold sm:text-xl">
            Clause breakdown
          </h2>
          <div className="mt-6 space-y-6">
            {visibleClauses.map((clause) => (
              <ClauseCardFull key={clause.clauseId} clause={clause} />
            ))}
          </div>
        </div>

        {/* Paywalled clause cards */}
        {report.isPreview &&
          report.clauseCards.length > PREVIEW_CLAUSE_CARDS_LIMIT && (
            <div className="mt-6">
              <PaywallBlock
                count={
                  report.clauseCards.length - PREVIEW_CLAUSE_CARDS_LIMIT
                }
              />
            </div>
          )}

        {/* Actions section */}
        {!report.isPreview && (
          <div className="mt-12 space-y-8">
            {/* Recommended questions */}
            <Card className="rounded-xl">
              <CardContent className="p-6">
                <h2 className="text-lg font-semibold">Questions to ask</h2>
                <ul className="mt-4 space-y-2.5">
                  {report.actions.recommendedQuestions.map((q, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-2.5 text-sm leading-relaxed text-muted-foreground"
                    >
                      <span className="mt-2 block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary" />
                      {q}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            {/* Letter templates */}
            {report.actions.letterTemplates.map((letter) => (
              <Card key={letter.id} className="rounded-xl">
                <CardContent className="p-6">
                  <h3 className="text-sm font-semibold sm:text-base">
                    {letter.title}
                  </h3>
                  <pre className="mt-4 whitespace-pre-wrap rounded-xl bg-muted/30 p-5 text-xs leading-relaxed text-muted-foreground sm:text-sm">
                    {letter.body}
                  </pre>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
