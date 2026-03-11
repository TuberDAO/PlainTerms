import { describe, it, expect } from "vitest";
import { computeDiagnostic } from "./diagnostic";
import type { Report } from "@/types/report";

function makeReport(overrides: Partial<Report> = {}): Report {
  return {
    id: "test",
    locale: "GB",
    contractFamily: "contracts",
    createdAtISO: new Date().toISOString(),
    isPreview: false,
    paywalledFindingsCount: 0,
    userQuestion: null,
    userAnswer: null,
    verdict: {
      headline: "Test headline",
      summary: "Test summary",
      severityOverall: "medium",
      scoreOverall: 60,
    },
    findings: [
      {
        id: "f-1",
        title: "Auto-renewal trap",
        severity: "high",
        score: 30,
        tags: ["AutoRenew", "TimeTrap"],
        shortWhy: "Renews automatically without clear notice.",
        relatedClauseIds: ["c-1"],
        impactType: "renewal",
        actionTiming: "before-renewal",
        decisionRelevance: "decision-critical",
      },
      {
        id: "f-2",
        title: "Cancellation fee",
        severity: "medium",
        score: 20,
        tags: ["PenaltyDisguise"],
        shortWhy: "A £50 fee applies on cancellation.",
        relatedClauseIds: ["c-2"],
        impactType: "cost",
        actionTiming: "before-cancellation",
        decisionRelevance: "important",
      },
    ],
    clauseCards: [
      {
        clauseId: "c-1",
        clauseLabel: "Auto-Renewal",
        originalTextExcerpt: "Your membership will automatically renew.",
        atFirstGlance: "Your subscription is covered and flexible.",
        whatItMeans: "It renews automatically without your active consent and charges your card without warning.",
        scenario: "You forget to cancel; card is charged again.",
        whatToDo: ["Set a calendar reminder 30 days before renewal."],
        negotiation: {},
      },
      {
        clauseId: "c-2",
        clauseLabel: "Cancellation Fee",
        originalTextExcerpt: "A fee of £50 is payable on cancellation.",
        atFirstGlance: "You may cancel at any time.",
        whatItMeans: "Cancellation triggers an immediate £50 charge.",
        scenario: "You cancel in month 3; you owe £50.",
        whatToDo: ["Factor the fee into your decision to sign.", "Ask if waivable."],
        negotiation: { fallbackAsk: "Can the fee be waived if I give 30 days notice?" },
      },
    ],
    actions: {
      recommendedQuestions: [
        "What is the exact renewal date?",
        "Can the cancellation fee be waived?",
      ],
      letterTemplates: [],
    },
    ...overrides,
  };
}

describe("computeDiagnostic", () => {
  it("returns correct counts", () => {
    const report = makeReport();
    const result = computeDiagnostic(report, { truncated: false });
    expect(result.findingsCount).toBe(2);
    expect(result.clauseCardsCount).toBe(2);
    expect(result.recommendedQuestionsCount).toBe(2);
    expect(result.letterTemplatesCount).toBe(0);
  });

  it("deduplicates tags and computes severitiesBreakdown", () => {
    const report = makeReport();
    const result = computeDiagnostic(report, { truncated: false });
    expect(result.distinctTags).toContain("AutoRenew");
    expect(result.distinctTags).toContain("TimeTrap");
    expect(result.distinctTags).toContain("PenaltyDisguise");
    expect(result.distinctTags.length).toBe(3);
    expect(result.severitiesBreakdown.high).toBe(1);
    expect(result.severitiesBreakdown.medium).toBe(1);
  });

  it("counts negotiation correctly", () => {
    const report = makeReport();
    const result = computeDiagnostic(report, { truncated: false });
    expect(result.emptyNegotiationCount).toBe(1);
    expect(result.populatedNegotiationCount).toBe(1);
  });

  it("computes avgWhatToDoCount", () => {
    const report = makeReport();
    const result = computeDiagnostic(report, { truncated: false });
    // clause c-1 has 1, c-2 has 2 → avg 1.5
    expect(result.avgWhatToDoCount).toBe(1.5);
  });

  it("detects false sense of safety signal", () => {
    const report = makeReport();
    const result = computeDiagnostic(report, { truncated: false });
    // c-1 atFirstGlance contains "covered", whatItMeans is > 60 chars
    expect(result.hasFalseSenseOfSafetySignals).toBe(true);
  });

  it("does not flag false safety when atFirstGlance has no trigger words", () => {
    const report = makeReport({
      clauseCards: [
        {
          clauseId: "c-1",
          clauseLabel: "Test",
          originalTextExcerpt: "Some text.",
          atFirstGlance: "This looks straightforward.",
          whatItMeans: "There is actually a complex set of conditions that apply here and will affect you.",
          scenario: "You discover extra charges.",
          whatToDo: [],
          negotiation: {},
        },
      ],
    });
    const result = computeDiagnostic(report, { truncated: false });
    expect(result.hasFalseSenseOfSafetySignals).toBe(false);
  });

  it("reflects truncation flag", () => {
    const report = makeReport();
    expect(computeDiagnostic(report, { truncated: true }).truncated).toBe(true);
    expect(computeDiagnostic(report, { truncated: false }).truncated).toBe(false);
  });

  it("reflects userQuestion/userAnswer presence", () => {
    const withQ = makeReport({ userQuestion: "Can I cancel online?", userAnswer: "No." });
    const result = computeDiagnostic(withQ, { truncated: false });
    expect(result.userQuestionPresent).toBe(true);
    expect(result.userAnswerPresent).toBe(true);

    const withoutQ = makeReport();
    const result2 = computeDiagnostic(withoutQ, { truncated: false });
    expect(result2.userQuestionPresent).toBe(false);
  });

  it("handles empty report gracefully", () => {
    const report = makeReport({ findings: [], clauseCards: [] });
    const result = computeDiagnostic(report, { truncated: false });
    expect(result.findingsCount).toBe(0);
    expect(result.avgWhatToDoCount).toBe(0);
    expect(result.distinctTags).toEqual([]);
    expect(result.severitiesBreakdown).toEqual({});
    expect(result.hasFalseSenseOfSafetySignals).toBe(false);
    expect(result.impactTypeBreakdown).toEqual({});
    expect(result.actionTimingBreakdown).toEqual({});
    expect(result.decisionRelevanceBreakdown).toEqual({});
  });

  it("computes impactType / actionTiming / decisionRelevance breakdowns", () => {
    const report = makeReport();
    const result = computeDiagnostic(report, { truncated: false });
    expect(result.impactTypeBreakdown).toEqual({ renewal: 1, cost: 1 });
    expect(result.actionTimingBreakdown).toEqual({ "before-renewal": 1, "before-cancellation": 1 });
    expect(result.decisionRelevanceBreakdown).toEqual({ "decision-critical": 1, important: 1 });
  });
});
