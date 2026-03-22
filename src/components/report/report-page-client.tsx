"use client";

import { useEffect, useState } from "react";
import { VerdictHeader } from "@/components/report/verdict-header";
import { FindingsList } from "@/components/report/findings-list";
import { PaywallBlock } from "@/components/report/paywall-block";
import { ClauseCardFull } from "@/components/report/clause-card-full";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle, ChevronDown, ChevronRight, CheckCircle2 } from "lucide-react";
import { UserQuestionAnswer } from "@/components/report/user-question-answer";
import { PrioritySummary } from "@/components/report/priority-summary";
import { CoverageStatusBlock } from "@/components/report/coverage-status";
import { track } from "@/lib/analytics/tracker";
import {
  PREVIEW_FINDINGS_LIMIT,
  PREVIEW_CLAUSE_CARDS_LIMIT,
} from "@/lib/budget";
import Link from "next/link";
import type { Report, ClauseCard } from "@/types/report";
import { rankFindings } from "@/lib/report/rank-findings";

interface ReportPageClientProps {
  report: Report | null;
}

function clausesBySection(
  clauses: ClauseCard[],
  allIssuesBySection?: Report["allIssuesBySection"],
): { sectionLabel: string; clauses: ClauseCard[] }[] {
  if (!allIssuesBySection || allIssuesBySection.length === 0) {
    return [{ sectionLabel: "", clauses }];
  }

  const clauseIdToSection = new Map<string, string>();
  for (const sec of allIssuesBySection) {
    for (const issue of sec.issues) {
      for (const cid of issue.relatedClauseIds) {
        if (!clauseIdToSection.has(cid)) {
          clauseIdToSection.set(cid, sec.sectionLabel);
        }
      }
    }
  }

  const sectionOrder = allIssuesBySection.map((s) => s.sectionLabel);
  const grouped = new Map<string, ClauseCard[]>();
  for (const label of sectionOrder) grouped.set(label, []);

  const ungrouped: ClauseCard[] = [];
  for (const clause of clauses) {
    const sec = clauseIdToSection.get(clause.clauseId);
    if (sec && grouped.has(sec)) {
      grouped.get(sec)!.push(clause);
    } else {
      ungrouped.push(clause);
    }
  }

  const result: { sectionLabel: string; clauses: ClauseCard[] }[] = [];
  for (const label of sectionOrder) {
    const items = grouped.get(label)!;
    if (items.length > 0) result.push({ sectionLabel: label, clauses: items });
  }
  if (ungrouped.length > 0) result.push({ sectionLabel: "Other clauses", clauses: ungrouped });
  return result;
}

export function ReportPageClient({ report }: ReportPageClientProps) {
  useEffect(() => {
    if (report) {
      track("report_viewed", { isPreview: report.isPreview });
    }
  }, [report]);

  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [targetedLettersOpen, setTargetedLettersOpen] = useState(false);

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

  const visibleFindings = report.isPreview
    ? rankedFindings.slice(0, PREVIEW_FINDINGS_LIMIT)
    : hasTopIssues
      ? report.topIssues!
      : rankedFindings;

  const visibleClauses = report.isPreview
    ? report.clauseCards.slice(0, PREVIEW_CLAUSE_CARDS_LIMIT)
    : report.clauseCards;

  const hasQuestions = !report.isPreview && report.actions.recommendedQuestions.length > 0;
  const hasLetters = !report.isPreview && report.actions.letterTemplates.length > 0;
  const hasActions = hasQuestions || hasLetters;

  const combinedLetter = report.actions.letterTemplates.find((l) => l.id === "lt-combined");
  const targetedLetters = report.actions.letterTemplates.filter((l) => l.id !== "lt-combined");

  const sectionGroups = !report.isPreview
    ? clausesBySection(visibleClauses, report.allIssuesBySection)
    : [];

  function toggleSection(label: string) {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  }

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

        {/* ═══════════════════════════════════════════════════════════
            LAYER 1 — Buyer-first summary
            ═══════════════════════════════════════════════════════════ */}

        <VerdictHeader verdict={report.verdict} />

        {report.coverageStatus && (
          <CoverageStatusBlock coverageStatus={report.coverageStatus} />
        )}

        <PrioritySummary findings={report.findings} />

        {report.userQuestion && report.userAnswer && (
          <div className="mt-6">
            <UserQuestionAnswer
              userQuestion={report.userQuestion}
              userAnswer={report.userAnswer}
            />
          </div>
        )}

        {/* Key findings */}
        <div className="mt-10">
          <FindingsList
            findings={visibleFindings}
            heading={hasTopIssues ? "Key findings" : "Findings"}
          />
        </div>

        {report.isPreview && report.paywalledFindingsCount > 0 && (
          <div className="mt-6">
            <PaywallBlock count={report.paywalledFindingsCount} />
          </div>
        )}

        {/* Save status */}
        {!report.isPreview && (
          <div className="mt-5 flex items-center gap-2 text-sm text-muted-foreground" data-testid="save-status">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <span>
              Report saved.{" "}
              <Link href="/account" className="font-medium text-primary hover:underline">
                Sign in
              </Link>{" "}
              to keep it permanently.
            </span>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════
            LAYER 2 — Action pack
            ═══════════════════════════════════════════════════════════ */}

        {hasActions && (
          <div className="mt-12 space-y-6" data-testid="action-pack">
            <div>
              <h2 className="text-lg font-semibold sm:text-xl">What to do next</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Practical steps you can take right now.
              </p>
            </div>

            {/* Questions */}
            {hasQuestions && (
              <Card className="rounded-xl">
                <CardContent className="p-6">
                  <h3 className="text-base font-semibold">Questions to ask</h3>
                  <p className="mt-1 text-sm text-muted-foreground" data-testid="questions-helper">
                    Ask these in writing where possible, so you have a record. Use phone only if something is urgent.
                  </p>
                  <ul className="mt-4 space-y-2.5">
                    {report.actions.recommendedQuestions.map((q, i) => (
                      <li
                        key={`q-${i}-${q.slice(0, 20)}`}
                        className="flex items-start gap-2.5 text-sm leading-relaxed text-muted-foreground"
                      >
                        <span className="mt-2 block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary" />
                        {q}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {/* Combined letter — shown first and expanded */}
            {combinedLetter && (
              <Card className="rounded-xl border-primary/20" data-testid="combined-letter">
                <CardContent className="p-6">
                  <h3 className="text-base font-semibold">{combinedLetter.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Covers all the main concerns in one message. Copy, personalise, and send.
                  </p>
                  <pre className="mt-4 whitespace-pre-wrap rounded-xl bg-muted/30 p-5 text-xs leading-relaxed text-muted-foreground sm:text-sm">
                    {combinedLetter.body}
                  </pre>
                </CardContent>
              </Card>
            )}

            {/* Targeted letters — collapsed behind disclosure */}
            {targetedLetters.length > 0 && (
              <div data-testid="targeted-letters">
                <button
                  onClick={() => setTargetedLettersOpen(!targetedLettersOpen)}
                  className="flex items-center gap-2 text-sm font-medium text-primary transition-colors hover:text-primary/80"
                >
                  {targetedLettersOpen ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                  {targetedLetters.length} targeted letter{targetedLetters.length !== 1 ? "s" : ""} for specific issues
                </button>
                {targetedLettersOpen && (
                  <div className="mt-4 space-y-4">
                    {targetedLetters.map((letter) => (
                      <Card key={`letter-${letter.id}`} className="rounded-xl">
                        <CardContent className="p-6">
                          <h4 className="text-sm font-semibold sm:text-base">
                            {letter.title}
                          </h4>
                          <pre className="mt-4 whitespace-pre-wrap rounded-xl bg-muted/30 p-5 text-xs leading-relaxed text-muted-foreground sm:text-sm">
                            {letter.body}
                          </pre>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Fallback: if there's no combined letter, show all letters flat */}
            {!combinedLetter && hasLetters && targetedLetters.length === 0 && (
              <div className="space-y-4">
                {report.actions.letterTemplates.map((letter) => (
                  <Card key={`letter-${letter.id}`} className="rounded-xl">
                    <CardContent className="p-6">
                      <h4 className="text-sm font-semibold sm:text-base">{letter.title}</h4>
                      <pre className="mt-4 whitespace-pre-wrap rounded-xl bg-muted/30 p-5 text-xs leading-relaxed text-muted-foreground sm:text-sm">
                        {letter.body}
                      </pre>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════
            LAYER 3 — Detailed reference (single entry point)
            ═══════════════════════════════════════════════════════════ */}

        {!report.isPreview && visibleClauses.length > 0 && (
          <div className="mt-16 border-t pt-10" data-testid="detailed-reference">
            <h2 className="text-lg font-semibold sm:text-xl">
              Detailed reference
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Full clause-by-clause breakdown, grouped by section. Use this to understand exactly what each clause says and means.
            </p>

            {sectionGroups.length > 1 ? (
              <div className="mt-8 space-y-6">
                {sectionGroups.map((group) => {
                  const isOpen = expandedSections.has(group.sectionLabel);
                  return (
                    <div key={`sec-${group.sectionLabel}`}>
                      <button
                        onClick={() => toggleSection(group.sectionLabel)}
                        className="flex w-full items-center gap-2 rounded-lg px-1 py-2 text-left text-sm font-semibold uppercase tracking-wide text-muted-foreground transition-colors hover:text-foreground"
                      >
                        {isOpen ? (
                          <ChevronDown className="h-4 w-4 flex-shrink-0" />
                        ) : (
                          <ChevronRight className="h-4 w-4 flex-shrink-0" />
                        )}
                        {group.sectionLabel}
                        <span className="ml-auto text-xs font-normal">
                          {group.clauses.length} clause{group.clauses.length !== 1 ? "s" : ""}
                        </span>
                      </button>
                      {isOpen && (
                        <div className="mt-3 space-y-5 pl-1">
                          {group.clauses.map((clause, idx) => (
                            <ClauseCardFull
                              key={`ref-${group.sectionLabel}-${idx}-${clause.clauseId}`}
                              clause={clause}
                              startCollapsed
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="mt-8 space-y-5">
                {visibleClauses.map((clause, idx) => (
                  <ClauseCardFull
                    key={`ref-${idx}-${clause.clauseId}`}
                    clause={clause}
                    startCollapsed
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Preview clause cards — shown expanded */}
        {report.isPreview && (
          <div className="mt-12">
            <h2 className="text-lg font-semibold sm:text-xl">
              Clause breakdown
            </h2>
            <div className="mt-6 space-y-6">
              {visibleClauses.map((clause) => (
                <ClauseCardFull key={`preview-${clause.clauseId}`} clause={clause} />
              ))}
            </div>
          </div>
        )}

        {report.isPreview &&
          report.clauseCards.length > PREVIEW_CLAUSE_CARDS_LIMIT && (
            <div className="mt-6">
              <PaywallBlock
                count={report.clauseCards.length - PREVIEW_CLAUSE_CARDS_LIMIT}
              />
            </div>
          )}
      </div>
    </div>
  );
}
