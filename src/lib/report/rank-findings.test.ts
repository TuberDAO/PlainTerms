import { describe, it, expect } from "vitest";
import {
  isMetadataLowConfidence,
  rankFindings,
  getPrioritySummaryItems,
} from "./rank-findings";
import type { Finding } from "@/types/report";

function makeFinding(overrides: Partial<Finding> = {}): Finding {
  return {
    id: "f-1",
    title: "Test finding",
    severity: "medium",
    score: 20,
    tags: [],
    shortWhy: "A test finding.",
    relatedClauseIds: [],
    impactType: "cost",
    actionTiming: "before-renewal",
    decisionRelevance: "important",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// isMetadataLowConfidence
// ---------------------------------------------------------------------------

describe("isMetadataLowConfidence", () => {
  it("returns true when all fields are defaults", () => {
    const findings = [
      makeFinding({ decisionRelevance: "important", actionTiming: "before-signing", impactType: "other" }),
      makeFinding({ decisionRelevance: "important", actionTiming: "before-signing", impactType: "other" }),
      makeFinding({ decisionRelevance: "important", actionTiming: "before-signing", impactType: "cost" }),
    ];
    // majority impactType "other" = 2/3 > 0.5 → low confidence
    expect(isMetadataLowConfidence(findings)).toBe(true);
  });

  it("returns false when decisionRelevance varies", () => {
    const findings = [
      makeFinding({ decisionRelevance: "decision-critical", actionTiming: "before-signing", impactType: "other" }),
      makeFinding({ decisionRelevance: "important", actionTiming: "before-signing", impactType: "other" }),
    ];
    expect(isMetadataLowConfidence(findings)).toBe(false);
  });

  it("returns false when actionTiming varies", () => {
    const findings = [
      makeFinding({ decisionRelevance: "important", actionTiming: "before-renewal", impactType: "other" }),
      makeFinding({ decisionRelevance: "important", actionTiming: "before-signing", impactType: "other" }),
    ];
    expect(isMetadataLowConfidence(findings)).toBe(false);
  });

  it("returns false when impactType is not majority 'other'", () => {
    const findings = [
      makeFinding({ decisionRelevance: "important", actionTiming: "before-signing", impactType: "cost" }),
      makeFinding({ decisionRelevance: "important", actionTiming: "before-signing", impactType: "coverage" }),
      makeFinding({ decisionRelevance: "important", actionTiming: "before-signing", impactType: "other" }),
    ];
    // only 1/3 are "other" — not majority
    expect(isMetadataLowConfidence(findings)).toBe(false);
  });

  it("returns true for empty array", () => {
    expect(isMetadataLowConfidence([])).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// rankFindings
// ---------------------------------------------------------------------------

describe("rankFindings", () => {
  it("returns single finding unchanged", () => {
    const f = makeFinding({ id: "f-1" });
    expect(rankFindings([f])).toEqual([f]);
  });

  it("sorts by decisionRelevance when metadata is confident", () => {
    const findings = [
      makeFinding({ id: "f-monitor", severity: "high", decisionRelevance: "monitor", actionTiming: "ongoing", impactType: "cost" }),
      makeFinding({ id: "f-critical", severity: "medium", decisionRelevance: "decision-critical", actionTiming: "before-renewal", impactType: "cost" }),
      makeFinding({ id: "f-important", severity: "medium", decisionRelevance: "important", actionTiming: "before-renewal", impactType: "cost" }),
    ];
    const ranked = rankFindings(findings);
    expect(ranked[0].id).toBe("f-critical");
    expect(ranked[1].id).toBe("f-important");
    expect(ranked[2].id).toBe("f-monitor");
  });

  it("sorts by severity only when metadata is all defaults (low confidence)", () => {
    const findings = [
      makeFinding({ id: "f-low",    severity: "low",    decisionRelevance: "important", actionTiming: "before-signing", impactType: "other" }),
      makeFinding({ id: "f-high",   severity: "high",   decisionRelevance: "important", actionTiming: "before-signing", impactType: "other" }),
      makeFinding({ id: "f-medium", severity: "medium", decisionRelevance: "important", actionTiming: "before-signing", impactType: "other" }),
    ];
    const ranked = rankFindings(findings);
    expect(ranked[0].id).toBe("f-high");
    expect(ranked[1].id).toBe("f-medium");
    expect(ranked[2].id).toBe("f-low");
  });

  it("uses decisionRelevance over severity when metadata is high-confidence", () => {
    // decisionRelevance varies ("important" vs "background") → metadata IS confident.
    // important (medium severity) should rank above background (high severity)
    // because decisionRelevance is the primary sort key.
    const findings = [
      makeFinding({ id: "f-bg",  severity: "high",   decisionRelevance: "background", actionTiming: "before-signing", impactType: "other" }),
      makeFinding({ id: "f-imp", severity: "medium", decisionRelevance: "important",  actionTiming: "before-signing", impactType: "other" }),
    ];
    const ranked = rankFindings(findings);
    expect(ranked[0].id).toBe("f-imp"); // important beats background despite lower severity
    expect(ranked[1].id).toBe("f-bg");
  });

  it("preserves original order for equal-priority findings (stable sort)", () => {
    const findings = [
      makeFinding({ id: "f-a", severity: "medium", decisionRelevance: "important", actionTiming: "before-renewal", impactType: "cost" }),
      makeFinding({ id: "f-b", severity: "medium", decisionRelevance: "important", actionTiming: "before-renewal", impactType: "cost" }),
      makeFinding({ id: "f-c", severity: "medium", decisionRelevance: "important", actionTiming: "before-renewal", impactType: "cost" }),
    ];
    const ranked = rankFindings(findings);
    expect(ranked.map((f) => f.id)).toEqual(["f-a", "f-b", "f-c"]);
  });

  it("uses actionTiming as tiebreaker within same relevance and severity", () => {
    const findings = [
      makeFinding({ id: "f-ongoing",  severity: "high", decisionRelevance: "important", actionTiming: "ongoing",         impactType: "cost" }),
      makeFinding({ id: "f-renewal",  severity: "high", decisionRelevance: "important", actionTiming: "before-renewal",  impactType: "cost" }),
      makeFinding({ id: "f-signing",  severity: "high", decisionRelevance: "important", actionTiming: "before-signing",  impactType: "cost" }),
    ];
    const ranked = rankFindings(findings);
    expect(ranked[0].id).toBe("f-signing");
    expect(ranked[1].id).toBe("f-renewal");
    expect(ranked[2].id).toBe("f-ongoing");
  });
});

// ---------------------------------------------------------------------------
// getPrioritySummaryItems
// ---------------------------------------------------------------------------

describe("getPrioritySummaryItems", () => {
  it("returns empty for empty findings", () => {
    expect(getPrioritySummaryItems([])).toEqual([]);
  });

  it("returns decision-critical findings first when metadata is confident", () => {
    const findings = [
      makeFinding({ id: "f-dc",  severity: "medium", decisionRelevance: "decision-critical", actionTiming: "before-signing",  impactType: "cost" }),
      makeFinding({ id: "f-imp", severity: "high",   decisionRelevance: "important",         actionTiming: "ongoing",         impactType: "cost" }),
    ];
    const items = getPrioritySummaryItems(findings);
    expect(items[0].id).toBe("f-dc");
  });

  it("respects the limit", () => {
    const findings = Array.from({ length: 6 }, (_, i) =>
      makeFinding({ id: `f-${i}`, decisionRelevance: "decision-critical", actionTiming: "before-renewal", impactType: "cost" }),
    );
    expect(getPrioritySummaryItems(findings, 3)).toHaveLength(3);
  });

  it("falls back to severity when metadata is low-confidence", () => {
    const findings = [
      makeFinding({ id: "f-low",  severity: "low",  decisionRelevance: "important", actionTiming: "before-signing", impactType: "other" }),
      makeFinding({ id: "f-high", severity: "high", decisionRelevance: "important", actionTiming: "before-signing", impactType: "other" }),
    ];
    const items = getPrioritySummaryItems(findings);
    expect(items[0].id).toBe("f-high");
  });

  it("returns empty when all findings are low-severity and metadata is low-confidence", () => {
    const findings = [
      makeFinding({ id: "f-1", severity: "low",  decisionRelevance: "important", actionTiming: "before-signing", impactType: "other" }),
      makeFinding({ id: "f-2", severity: "info", decisionRelevance: "important", actionTiming: "before-signing", impactType: "other" }),
    ];
    // low confidence + nothing critical/high → empty
    expect(getPrioritySummaryItems(findings)).toHaveLength(0);
  });

  it("uniform metadata with all-important defaults does not produce misleading summary", () => {
    // This is the key regression test: old reports where all fields are defaults
    // should produce a severity-based summary (or nothing), not an artificial one.
    const findings = [
      makeFinding({ id: "f-a", severity: "medium", decisionRelevance: "important", actionTiming: "before-signing", impactType: "other" }),
      makeFinding({ id: "f-b", severity: "medium", decisionRelevance: "important", actionTiming: "before-signing", impactType: "other" }),
    ];
    // All defaults + medium severity → nothing qualifies for summary (not critical/high)
    expect(getPrioritySummaryItems(findings)).toHaveLength(0);
  });
});
