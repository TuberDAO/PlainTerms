import { describe, it, expect } from "vitest";
import { parseReportJson } from "./report-schema";
import { MOCK_REPORT } from "./mock-report";

function makeMinimalReport(overrides: Record<string, unknown> = {}) {
  return { ...JSON.parse(JSON.stringify(MOCK_REPORT)), ...overrides };
}

describe("parseReportJson preserves userQuestion/userAnswer", () => {
  it("parses a report with both fields present", () => {
    const input = makeMinimalReport({
      userQuestion: "Can I cancel online?",
      userAnswer: "No, you must cancel in person.",
    });
    const report = parseReportJson(JSON.stringify(input));
    expect(report.userQuestion).toBe("Can I cancel online?");
    expect(report.userAnswer).toBe("No, you must cancel in person.");
  });

  it("defaults missing fields to null (old report format)", () => {
    const input = makeMinimalReport();
    delete (input as Record<string, unknown>).userQuestion;
    delete (input as Record<string, unknown>).userAnswer;
    const report = parseReportJson(JSON.stringify(input));
    expect(report.userQuestion).toBeNull();
    expect(report.userAnswer).toBeNull();
  });

  it("accepts explicit null values", () => {
    const input = makeMinimalReport({
      userQuestion: null,
      userAnswer: null,
    });
    const report = parseReportJson(JSON.stringify(input));
    expect(report.userQuestion).toBeNull();
    expect(report.userAnswer).toBeNull();
  });
});

describe("parseReportJson — impactType / actionTiming / decisionRelevance", () => {
  it("parses findings with all three new fields present", () => {
    const input = makeMinimalReport();
    input.findings[0].impactType = "cost";
    input.findings[0].actionTiming = "before-renewal";
    input.findings[0].decisionRelevance = "decision-critical";
    const report = parseReportJson(JSON.stringify(input));
    expect(report.findings[0].impactType).toBe("cost");
    expect(report.findings[0].actionTiming).toBe("before-renewal");
    expect(report.findings[0].decisionRelevance).toBe("decision-critical");
  });

  it("defaults missing fields for old reports (backward compatibility)", () => {
    const input = makeMinimalReport();
    for (const f of input.findings) {
      delete f.impactType;
      delete f.actionTiming;
      delete f.decisionRelevance;
    }
    const report = parseReportJson(JSON.stringify(input));
    for (const f of report.findings) {
      expect(f.impactType).toBe("other");
      expect(f.actionTiming).toBe("before-signing");
      expect(f.decisionRelevance).toBe("important");
    }
  });

  it("accepts all valid enum values", () => {
    const input = makeMinimalReport();
    input.findings[0].impactType = "linked-agreement";
    input.findings[0].actionTiming = "if-problem-occurs";
    input.findings[0].decisionRelevance = "background";
    const report = parseReportJson(JSON.stringify(input));
    expect(report.findings[0].impactType).toBe("linked-agreement");
    expect(report.findings[0].actionTiming).toBe("if-problem-occurs");
    expect(report.findings[0].decisionRelevance).toBe("background");
  });

  it("rejects invalid enum values via Zod", () => {
    const input = makeMinimalReport();
    input.findings[0].impactType = "totally-invalid";
    expect(() => parseReportJson(JSON.stringify(input))).toThrow();
  });
});
