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

describe("ReportPageClient — render order: summary > action pack > detailed reference", () => {
  it("renders action pack before detailed reference for full reports", () => {
    const { container } = render(<ReportPageClient report={makeReport()} />);
    const html = container.innerHTML;

    const actionPackPos = html.indexOf("What to do next");
    const detailedRefPos = html.indexOf("Detailed reference");

    expect(actionPackPos).toBeGreaterThan(-1);
    expect(detailedRefPos).toBeGreaterThan(-1);
    expect(actionPackPos).toBeLessThan(detailedRefPos);
  });

  it("renders verdict header at the top", () => {
    render(<ReportPageClient report={makeReport()} />);
    expect(screen.getByText("This policy has significant issues.")).toBeInTheDocument();
  });
});

describe("ReportPageClient — action pack structure", () => {
  it("renders questions inside the action pack", () => {
    render(<ReportPageClient report={makeReport()} />);
    expect(screen.getByText("Questions to ask")).toBeInTheDocument();
    expect(screen.getByText("What is the cancellation process?")).toBeInTheDocument();
  });

  it("renders combined letter first and expanded", () => {
    const report = makeReport({
      actions: {
        recommendedQuestions: [],
        letterTemplates: [
          { id: "lt-combined", title: "Combined clarification letter", body: "Dear Sir, multiple issues..." },
          { id: "lt-1", title: "Targeted letter", body: "Dear Sir, specific issue..." },
        ],
      },
    });
    render(<ReportPageClient report={report} />);

    expect(screen.getByTestId("combined-letter")).toBeInTheDocument();
    expect(screen.getByText("Combined clarification letter")).toBeInTheDocument();
    expect(screen.getByText(/Dear Sir, multiple issues/)).toBeInTheDocument();
  });

  it("renders targeted letters collapsed behind disclosure", () => {
    const report = makeReport({
      actions: {
        recommendedQuestions: [],
        letterTemplates: [
          { id: "lt-combined", title: "Combined clarification letter", body: "Combined body" },
          { id: "lt-1", title: "Targeted letter A", body: "Body A" },
          { id: "lt-2", title: "Targeted letter B", body: "Body B" },
        ],
      },
    });
    const { container } = render(<ReportPageClient report={report} />);

    expect(screen.getByTestId("targeted-letters")).toBeInTheDocument();
    expect(screen.getByText(/2 targeted letters/)).toBeInTheDocument();
    expect(container.innerHTML).not.toContain("Targeted letter A");
  });
});

describe("ReportPageClient — no simplify UI on report page", () => {
  it("does not render any simplify controls", () => {
    const report = makeReport();
    const { container } = render(<ReportPageClient report={report} />);
    expect(container.innerHTML).not.toContain("Explain this more simply");
    expect(container.innerHTML).not.toContain("Simpler version");
    expect(container.innerHTML).not.toContain("Simplifying");
  });

  it("clause card does not render simplify block", () => {
    const report = makeReport();
    const { container } = render(<ReportPageClient report={report} />);
    expect(container.innerHTML).not.toContain("/api/simplify");
  });
});

describe("ReportPageClient — single detailed-reference layer", () => {
  it("has only one detailed reference section heading", () => {
    const report = makeReport({
      clauseCards: [
        makeClause({ clauseId: "c-1" }),
        makeClause({ clauseId: "c-2", clauseLabel: "Clause 2" }),
      ],
    });
    const { container } = render(<ReportPageClient report={report} />);
    const matches = container.innerHTML.match(/Detailed reference/g);
    expect(matches).toHaveLength(1);
  });

  it("does NOT have a separate All findings by section header alongside clause breakdown", () => {
    const findings = Array.from({ length: 10 }, (_, i) =>
      makeFinding({
        id: `f-${i}`,
        title: `Finding ${i}`,
        sectionLabel: i < 5 ? "Section A" : "Section B",
        relatedClauseIds: [`c-${i}`],
      }),
    );
    const clauses = Array.from({ length: 10 }, (_, i) =>
      makeClause({ clauseId: `c-${i}`, clauseLabel: `Clause ${i}` }),
    );
    const report = makeReport({
      findings,
      topIssues: findings.slice(0, 3),
      clauseCards: clauses,
      allIssuesBySection: [
        { sectionLabel: "Section A", issues: findings.slice(0, 5) },
        { sectionLabel: "Section B", issues: findings.slice(5) },
      ],
    });
    const { container } = render(<ReportPageClient report={report} />);

    expect(container.innerHTML).not.toContain("All findings by section");
    expect(container.innerHTML).toContain("Section A");
    expect(container.innerHTML).toContain("Section B");
  });
});

describe("ReportPageClient — backward compatibility", () => {
  it("renders safely when topIssues and allIssuesBySection are absent", () => {
    const report = makeReport({
      topIssues: undefined,
      allIssuesBySection: undefined,
    });
    render(<ReportPageClient report={report} />);
    expect(screen.getByText("Test Finding")).toBeInTheDocument();
  });

  it("renders safely when coverageStatus is absent", () => {
    const report = makeReport({ coverageStatus: undefined });
    render(<ReportPageClient report={report} />);
    expect(screen.getByText("Test Finding")).toBeInTheDocument();
  });

  it("renders safely when actions have empty arrays", () => {
    const report = makeReport({
      actions: { recommendedQuestions: [], letterTemplates: [] },
    });
    const { container } = render(<ReportPageClient report={report} />);
    expect(container.innerHTML).not.toContain("What to do next");
  });

  it("handles old reports without lt-combined by showing all letters", () => {
    const report = makeReport({
      actions: {
        recommendedQuestions: [],
        letterTemplates: [
          { id: "lt-1", title: "Old letter", body: "Old body" },
        ],
      },
    });
    render(<ReportPageClient report={report} />);
    expect(screen.getByText(/1 targeted letter/)).toBeInTheDocument();
  });
});

describe("ReportPageClient — preview mode unchanged", () => {
  it("does not show action pack in preview mode", () => {
    const preview = makeReport({ isPreview: true, paywalledFindingsCount: 3 });
    const { container } = render(<ReportPageClient report={preview} />);
    expect(container.innerHTML).not.toContain("What to do next");
  });

  it("shows clause cards expanded in preview mode", () => {
    const preview = makeReport({ isPreview: true });
    render(<ReportPageClient report={preview} />);
    expect(screen.getByText("Clause breakdown")).toBeInTheDocument();
    expect(screen.getByText("But it really means this.")).toBeInTheDocument();
  });
});

describe("ReportPageClient — clause cards progressive disclosure", () => {
  it("clause cards in detailed reference start collapsed", () => {
    const clauses = Array.from({ length: 5 }, (_, i) =>
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
  it("section groups preserve all clauses", () => {
    const findings = Array.from({ length: 10 }, (_, i) =>
      makeFinding({
        id: `f-${i}`,
        title: `Finding ${i}`,
        sectionLabel: i < 5 ? "Section A" : "Section B",
        relatedClauseIds: [`c-${i}`],
      }),
    );
    const clauses = Array.from({ length: 10 }, (_, i) =>
      makeClause({ clauseId: `c-${i}`, clauseLabel: `Clause ${i}` }),
    );
    const report = makeReport({
      findings,
      topIssues: findings.slice(0, 3),
      clauseCards: clauses,
      allIssuesBySection: [
        { sectionLabel: "Section A", issues: findings.slice(0, 5) },
        { sectionLabel: "Section B", issues: findings.slice(5) },
      ],
    });
    const { container } = render(<ReportPageClient report={report} />);

    expect(container.innerHTML).toContain("5 clause");
    expect(container.innerHTML).toContain("Section A");
    expect(container.innerHTML).toContain("Section B");
  });
});

describe("ReportPageClient — no ghosted export controls", () => {
  it("does not render disabled Export PDF button", () => {
    const { container } = render(<ReportPageClient report={makeReport()} />);
    expect(container.innerHTML).not.toContain("Export PDF");
  });

  it("does not render disabled Share button", () => {
    const { container } = render(<ReportPageClient report={makeReport()} />);
    expect(container.innerHTML).not.toContain(">Share<");
  });
});

describe("ReportPageClient — save status", () => {
  it("shows save status for non-preview reports", () => {
    render(<ReportPageClient report={makeReport()} />);
    expect(screen.getByTestId("save-status")).toBeInTheDocument();
    expect(screen.getByText(/report saved/i)).toBeInTheDocument();
  });

  it("includes sign-in link for permanence", () => {
    render(<ReportPageClient report={makeReport()} />);
    const saveStatus = screen.getByTestId("save-status");
    expect(saveStatus.textContent).toContain("Sign in");
    expect(saveStatus.textContent).toContain("permanently");
  });

  it("does not show save status for preview reports", () => {
    const preview = makeReport({ isPreview: true });
    render(<ReportPageClient report={preview} />);
    expect(screen.queryByTestId("save-status")).not.toBeInTheDocument();
  });
});

describe("ReportPageClient — questions helper wording", () => {
  it("recommends written contact first", () => {
    render(<ReportPageClient report={makeReport()} />);
    const helper = screen.getByTestId("questions-helper");
    expect(helper.textContent).toContain("in writing");
    expect(helper.textContent).not.toContain("by phone, email, or in person");
  });
});

describe("ReportPageClient — duplicate finding keys across micro-batches", () => {
  it("does not produce duplicate React keys when finding IDs repeat", () => {
    const findings = [
      makeFinding({ id: "f-1", title: "Finding batch 1" }),
      makeFinding({ id: "f-2", title: "Finding batch 1b" }),
      makeFinding({ id: "f-1", title: "Finding batch 2" }),
      makeFinding({ id: "f-2", title: "Finding batch 2b" }),
    ];
    const report = makeReport({ findings });

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    render(<ReportPageClient report={report} />);
    const keyWarnings = consoleSpy.mock.calls.filter(
      (args) => typeof args[0] === "string" && args[0].includes("same key"),
    );
    expect(keyWarnings).toHaveLength(0);
    consoleSpy.mockRestore();
  });
});

describe("ReportPageClient — duplicate clauseId keys across sections", () => {
  it("does not produce duplicate React keys when clauseIds repeat across sections", () => {
    const findings = [
      makeFinding({ id: "f-a1", sectionLabel: "Section A", relatedClauseIds: ["c-1"] }),
      makeFinding({ id: "f-a2", sectionLabel: "Section A", relatedClauseIds: ["c-2"] }),
      makeFinding({ id: "f-b1", sectionLabel: "Section B", relatedClauseIds: ["c-1"] }),
      makeFinding({ id: "f-b2", sectionLabel: "Section B", relatedClauseIds: ["c-2"] }),
    ];
    const clauses = [
      makeClause({ clauseId: "c-1", clauseLabel: "Clause A1" }),
      makeClause({ clauseId: "c-2", clauseLabel: "Clause A2" }),
      makeClause({ clauseId: "c-1", clauseLabel: "Clause B1" }),
      makeClause({ clauseId: "c-2", clauseLabel: "Clause B2" }),
    ];
    const report = makeReport({
      findings,
      clauseCards: clauses,
      allIssuesBySection: [
        { sectionLabel: "Section A", issues: findings.slice(0, 2) },
        { sectionLabel: "Section B", issues: findings.slice(2) },
      ],
    });

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    render(<ReportPageClient report={report} />);
    const keyWarnings = consoleSpy.mock.calls.filter(
      (args) => typeof args[0] === "string" && args[0].includes("same key"),
    );
    expect(keyWarnings).toHaveLength(0);
    consoleSpy.mockRestore();
  });
});
