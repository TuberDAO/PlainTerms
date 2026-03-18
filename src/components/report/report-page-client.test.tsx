import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ReportPageClient } from "./report-page-client";
import type { Report, Finding, ClauseCard, LetterTemplate } from "@/types/report";

vi.mock("@/lib/analytics/tracker", () => ({
  track: vi.fn(),
}));

function makeFinding(overrides: Partial<Finding> = {}): Finding {
  return {
    id: "f-1",
    title: "Test Finding",
    severity: "high",
    score: 40,
    tags: [],
    shortWhy: "This is a test finding.",
    relatedClauseIds: ["c-1"],
    impactType: "cost",
    actionTiming: "before-signing",
    decisionRelevance: "decision-critical",
    ...overrides,
  };
}

function makeClause(overrides: Partial<ClauseCard> = {}): ClauseCard {
  return {
    clauseId: "c-1",
    clauseLabel: "Test Clause",
    originalTextExcerpt: "Excerpt text here",
    atFirstGlance: "Looks fine at first.",
    whatItMeans: "But it really means this.",
    scenario: "You could lose money.",
    whatToDo: ["Check before signing"],
    ...overrides,
  };
}

function makeLetter(overrides: Partial<LetterTemplate> = {}): LetterTemplate {
  return {
    id: "lt-1",
    title: "Clarification Letter",
    body: "Dear provider, I have concerns about...",
    ...overrides,
  };
}

function makeReport(overrides: Partial<Report> = {}): Report {
  return {
    id: "test-report",
    locale: "GB",
    contractFamily: "insurance",
    createdAtISO: new Date().toISOString(),
    isPreview: false,
    verdict: {
      headline: "This policy has significant issues.",
      summary: "Several high-severity concerns found.",
      severityOverall: "high",
      scoreOverall: 35,
    },
    findings: [makeFinding()],
    paywalledFindingsCount: 0,
    clauseCards: [makeClause()],
    actions: {
      recommendedQuestions: ["What is the cancellation process?"],
      letterTemplates: [makeLetter()],
    },
    userQuestion: null,
    userAnswer: null,
    ...overrides,
  };
}

describe("ReportPageClient — render order", () => {
  it("renders action pack before detailed clause reference for full reports", () => {
    const { container } = render(<ReportPageClient report={makeReport()} />);
    const html = container.innerHTML;

    const actionPackPos = html.indexOf("What to do next");
    const clauseRefPos = html.indexOf("Detailed clause reference");

    expect(actionPackPos).toBeGreaterThan(-1);
    expect(clauseRefPos).toBeGreaterThan(-1);
    expect(actionPackPos).toBeLessThan(clauseRefPos);
  });

  it("renders questions to ask inside the action pack", () => {
    render(<ReportPageClient report={makeReport()} />);
    expect(screen.getByText("Questions to ask")).toBeInTheDocument();
    expect(screen.getByText("What is the cancellation process?")).toBeInTheDocument();
  });

  it("renders letter templates inside the action pack", () => {
    render(<ReportPageClient report={makeReport()} />);
    expect(screen.getByText("Ready-to-send letters")).toBeInTheDocument();
    expect(screen.getByText("Clarification Letter")).toBeInTheDocument();
  });

  it("renders verdict header at the top", () => {
    render(<ReportPageClient report={makeReport()} />);
    expect(screen.getByText("This policy has significant issues.")).toBeInTheDocument();
  });
});

describe("ReportPageClient — backward compatibility with old reports", () => {
  it("renders safely when topIssues and allIssuesBySection are absent", () => {
    const oldReport = makeReport({
      topIssues: undefined,
      allIssuesBySection: undefined,
    });
    render(<ReportPageClient report={oldReport} />);
    expect(screen.getByText("Test Finding")).toBeInTheDocument();
  });

  it("renders safely when coverageStatus is absent", () => {
    const oldReport = makeReport({ coverageStatus: undefined });
    render(<ReportPageClient report={oldReport} />);
    expect(screen.getByText("Test Finding")).toBeInTheDocument();
  });

  it("renders safely when actions have empty arrays", () => {
    const oldReport = makeReport({
      actions: { recommendedQuestions: [], letterTemplates: [] },
    });
    const { container } = render(<ReportPageClient report={oldReport} />);
    expect(container.innerHTML).not.toContain("What to do next");
  });
});

describe("ReportPageClient — preview mode unchanged", () => {
  it("does not show action pack in preview mode", () => {
    const preview = makeReport({ isPreview: true, paywalledFindingsCount: 3 });
    const { container } = render(<ReportPageClient report={preview} />);
    expect(container.innerHTML).not.toContain("What to do next");
  });

  it("shows clause cards fully expanded in preview mode", () => {
    const preview = makeReport({ isPreview: true });
    render(<ReportPageClient report={preview} />);
    expect(screen.getByText("Clause breakdown")).toBeInTheDocument();
    expect(screen.getByText("But it really means this.")).toBeInTheDocument();
  });
});

describe("ReportPageClient — detailed reference uses progressive disclosure", () => {
  it("clause cards in detailed reference start collapsed when many", () => {
    const clauses = Array.from({ length: 8 }, (_, i) =>
      makeClause({
        clauseId: `c-${i}`,
        clauseLabel: `Clause ${i}`,
        atFirstGlance: `Glance ${i}`,
        whatItMeans: `Catch ${i}`,
      }),
    );
    const report = makeReport({ clauseCards: clauses });
    render(<ReportPageClient report={report} />);

    expect(screen.getByText(/Show all 8 clause breakdowns/)).toBeInTheDocument();
  });

  it("shows 'Reveal the catch' on collapsed clause cards", () => {
    const clauses = Array.from({ length: 8 }, (_, i) =>
      makeClause({
        clauseId: `c-${i}`,
        clauseLabel: `Clause ${i}`,
        atFirstGlance: `Glance ${i}`,
        whatItMeans: `Catch ${i}`,
      }),
    );
    const report = makeReport({ clauseCards: clauses });
    render(<ReportPageClient report={report} />);

    const revealButtons = screen.getAllByText("Reveal the catch");
    expect(revealButtons.length).toBeGreaterThan(0);
  });
});

describe("ReportPageClient — full issue set preserved", () => {
  it("allIssuesBySection section view preserves all findings", () => {
    const findings = Array.from({ length: 15 }, (_, i) =>
      makeFinding({
        id: `f-${i}`,
        title: `Finding ${i}`,
        sectionLabel: i < 8 ? "Section A" : "Section B",
      }),
    );
    const topIssues = findings.slice(0, 5);
    const report = makeReport({
      findings,
      topIssues,
      allIssuesBySection: [
        { sectionLabel: "Section A", issues: findings.slice(0, 8) },
        { sectionLabel: "Section B", issues: findings.slice(8) },
      ],
    });
    const { container } = render(<ReportPageClient report={report} />);
    expect(container.innerHTML).toContain("All findings by section");
    expect(container.innerHTML).toContain("15");
  });
});
