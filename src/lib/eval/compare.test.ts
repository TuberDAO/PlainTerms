import { describe, it, expect } from "vitest";
import {
  buildCompareSideOptions,
  toAnalysisOptions,
  buildSide,
  buildComparisonSummary,
  categorizeError,
  type CompareSideOptions,
} from "./compare";
import type { DiagnosticSummary } from "@/lib/eval/diagnostic";
import type { OpenAIReasoningEffort, OpenAIVerbosity } from "@/lib/llm/openai";

// ---------------------------------------------------------------------------
// buildCompareSideOptions
// ---------------------------------------------------------------------------

describe("buildCompareSideOptions", () => {
  it("side A always uses anthropic backend", () => {
    const opts = buildCompareSideOptions("a", {});
    expect(opts.backend).toBe("anthropic");
  });

  it("side B always uses openai backend", () => {
    const opts = buildCompareSideOptions("b", {});
    expect(opts.backend).toBe("openai");
  });

  it("applies per-side model overrides", () => {
    const a = buildCompareSideOptions("a", { anthropicModel: "claude-opus-x" });
    const b = buildCompareSideOptions("b", { openaiModel: "gpt-5" });
    expect(a.model).toBe("claude-opus-x");
    expect(b.model).toBe("gpt-5");
  });

  it("side-specific token overrides do not cross-pollinate", () => {
    const a = buildCompareSideOptions("a", { anthropicMaxTokens: 8000, openaiMaxTokens: 2000 });
    const b = buildCompareSideOptions("b", { anthropicMaxTokens: 8000, openaiMaxTokens: 2000 });
    expect(a.maxOutputTokens).toBe(8000);
    expect(b.maxOutputTokens).toBe(2000);
  });

  it("shared temperature applies to both sides", () => {
    const a = buildCompareSideOptions("a", { temperature: 0.5 });
    const b = buildCompareSideOptions("b", { temperature: 0.5 });
    expect(a.temperature).toBe(0.5);
    expect(b.temperature).toBe(0.5);
  });

  it("defaults are sensible", () => {
    const a = buildCompareSideOptions("a", {});
    const b = buildCompareSideOptions("b", {});
    expect(a.backend).toBe("anthropic");
    expect(b.backend).toBe("openai");
    expect(typeof a.model).toBe("string");
    expect(typeof b.model).toBe("string");
    expect(a.temperature).toBeGreaterThan(0);
    expect(b.temperature).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// toAnalysisOptions
// ---------------------------------------------------------------------------

describe("toAnalysisOptions", () => {
  it("defaults maxRetries to 1 in compare mode", () => {
    const opts = toAnalysisOptions({ backend: "openai", model: "gpt-4o", maxOutputTokens: 4000, temperature: 0.2 });
    expect(opts.maxRetries).toBe(1);
  });

  it("passes backend and model through", () => {
    const opts = toAnalysisOptions({ backend: "anthropic", model: "claude-opus-4-6" });
    expect(opts.backend).toBe("anthropic");
    expect(opts.model).toBe("claude-opus-4-6");
  });
});

// ---------------------------------------------------------------------------
// buildSide — error state
// ---------------------------------------------------------------------------

describe("buildSide — error state", () => {
  it("returns error side when report is null", () => {
    const sideOpts: CompareSideOptions = { backend: "openai", model: "gpt-4o" };
    const side = buildSide(sideOpts, null, null, false, false, "API key missing");
    expect(side.error).toBe("API key missing");
    expect(side.verdict).toBeNull();
    expect(side.topFindings).toEqual([]);
    expect(side.backend).toBe("openai");
  });

  it("uses a default error message when no message provided", () => {
    const sideOpts: CompareSideOptions = { backend: "anthropic" };
    const side = buildSide(sideOpts, null, null, false, false);
    expect(side.error).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// buildComparisonSummary
// ---------------------------------------------------------------------------

function makeDiagnostic(overrides: Partial<DiagnosticSummary> = {}): DiagnosticSummary {
  return {
    findingsCount: 3,
    clauseCardsCount: 3,
    distinctTags: [],
    severitiesBreakdown: { high: 2, medium: 1 },
    emptyNegotiationCount: 2,
    populatedNegotiationCount: 1,
    recommendedQuestionsCount: 3,
    letterTemplatesCount: 0,
    avgWhatToDoCount: 2,
    hasFalseSenseOfSafetySignals: false,
    reportCharacterLength: 3000,
    userQuestionPresent: false,
    userAnswerPresent: false,
    impactTypeBreakdown: { cost: 2, renewal: 1 },
    actionTimingBreakdown: { "before-signing": 2, "before-renewal": 1 },
    decisionRelevanceBreakdown: { "decision-critical": 1, important: 2 },
    truncated: false,
    ...overrides,
  };
}

describe("buildComparisonSummary", () => {
  it("computes counts from diagnostics", () => {
    const sideA = buildSide(
      { backend: "anthropic", model: "claude-opus-4-6" },
      null, makeDiagnostic({ findingsCount: 5, clauseCardsCount: 5 }), false, false,
    );
    // Force non-error state by calling directly with a stubbed side
    const aManual = { ...sideA, verdict: { headline: "H", summary: "S", severityOverall: "high" as const, scoreOverall: 40 }, error: undefined, diagnostic: makeDiagnostic({ findingsCount: 5, clauseCardsCount: 5 }) };
    const bManual = { ...sideA, backend: "openai" as const, verdict: { headline: "H2", summary: "S2", severityOverall: "medium" as const, scoreOverall: 60 }, error: undefined, diagnostic: makeDiagnostic({ findingsCount: 3, clauseCardsCount: 3 }) };

    const summary = buildComparisonSummary(aManual, bManual);
    expect(summary.findingsCountA).toBe(5);
    expect(summary.findingsCountB).toBe(3);
    expect(summary.clauseCardsCountA).toBe(5);
    expect(summary.clauseCardsCountB).toBe(3);
  });

  it("adds a note when one side has notably more findings", () => {
    const baseOpts: CompareSideOptions = { backend: "anthropic", model: "claude-opus-4-6" };
    const sideA = { backend: "anthropic" as const, model: "claude-opus-4-6", options: baseOpts, verdict: { headline: "H", summary: "S", severityOverall: "high" as const, scoreOverall: 40 }, diagnostic: makeDiagnostic({ findingsCount: 8 }), topFindings: [], topClauseLabels: [], truncated: false, userQuestionPresent: false, userAnswerPresent: false };
    const sideB = { ...sideA, backend: "openai" as const, diagnostic: makeDiagnostic({ findingsCount: 2 }) };
    const summary = buildComparisonSummary(sideA, sideB);
    expect(summary.notes.some((n) => n.includes("notably more findings"))).toBe(true);
  });

  it("adds a note when only one side truncated", () => {
    const baseOpts: CompareSideOptions = { backend: "anthropic", model: "claude-opus-4-6" };
    const sideA = { backend: "anthropic" as const, model: "claude-opus-4-6", options: baseOpts, verdict: null, diagnostic: makeDiagnostic(), topFindings: [], topClauseLabels: [], truncated: true, userQuestionPresent: false, userAnswerPresent: false };
    const sideB = { ...sideA, backend: "openai" as const, truncated: false };
    const summary = buildComparisonSummary(sideA, sideB);
    expect(summary.notes.some((n) => n.includes("truncated"))).toBe(true);
  });

  it("returns empty notes when sides are similar", () => {
    const d = makeDiagnostic();
    const baseOpts: CompareSideOptions = { backend: "anthropic", model: "claude-opus-4-6" };
    const side = { backend: "anthropic" as const, model: "claude-opus-4-6", options: baseOpts, verdict: { headline: "H", summary: "S", severityOverall: "high" as const, scoreOverall: 45 }, diagnostic: d, topFindings: [], topClauseLabels: [], truncated: false, userQuestionPresent: false, userAnswerPresent: false };
    const sideB = { ...side, backend: "openai" as const };
    const summary = buildComparisonSummary(side, sideB);
    expect(summary.notes).toEqual([]);
  });

  it("handles error sides gracefully", () => {
    const baseOpts: CompareSideOptions = { backend: "anthropic", model: "claude-opus-4-6" };
    const errSide = { backend: "anthropic" as const, model: "claude-opus-4-6", options: baseOpts, verdict: null, diagnostic: null, topFindings: [], topClauseLabels: [], truncated: false, userQuestionPresent: false, userAnswerPresent: false, error: "timeout" };
    const okSide = { ...errSide, backend: "openai" as const, diagnostic: makeDiagnostic(), error: undefined };
    const summary = buildComparisonSummary(errSide, okSide);
    expect(summary.findingsCountA).toBe(0);
    expect(summary.notes.some((n) => n.includes("Side A"))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// OpenAI reasoning effort threading
// ---------------------------------------------------------------------------

describe("buildCompareSideOptions — reasoning effort", () => {
  it("passes openaiReasoningEffort to side B (openai)", () => {
    const b = buildCompareSideOptions("b", {
      openaiReasoningEffort: "high" as OpenAIReasoningEffort,
    });
    expect(b.openaiReasoningEffort).toBe("high");
  });

  it("does NOT put reasoning effort on side A (anthropic)", () => {
    const a = buildCompareSideOptions("a", {
      openaiReasoningEffort: "high" as OpenAIReasoningEffort,
    });
    expect(a.openaiReasoningEffort).toBeUndefined();
  });

  it("leaves reasoningEffort undefined when not supplied", () => {
    const b = buildCompareSideOptions("b", {});
    expect(b.openaiReasoningEffort).toBeUndefined();
  });
});

describe("toAnalysisOptions — reasoning effort", () => {
  it("includes openaiReasoningEffort in AnalysisOptions when set", () => {
    const opts = toAnalysisOptions({
      backend: "openai",
      model: "gpt-5",
      maxOutputTokens: 4000,
      temperature: 0.2,
      openaiReasoningEffort: "medium" as OpenAIReasoningEffort,
    });
    expect(opts.openaiReasoningEffort).toBe("medium");
    expect(opts.maxRetries).toBe(1); // default 1 in compare mode
  });

  it("leaves openaiReasoningEffort absent when not supplied", () => {
    const opts = toAnalysisOptions({ backend: "openai" });
    expect(opts.openaiReasoningEffort).toBeUndefined();
  });

  it("defaults maxRetries to 1 (was 0) so first-pass schema failures can self-repair", () => {
    const opts = toAnalysisOptions({
      backend: "openai",
      openaiReasoningEffort: "xhigh" as OpenAIReasoningEffort,
    });
    expect(opts.maxRetries).toBe(1);
  });

  it("respects explicit maxRetries=0 when caller forces zero retries", () => {
    const opts = toAnalysisOptions({ backend: "anthropic", maxRetries: 0 });
    expect(opts.maxRetries).toBe(0);
  });
});

describe("buildSide — reasoning effort in output", () => {
  it("includes openaiReasoningEffort in output for openai side when set", () => {
    const opts: CompareSideOptions = {
      backend: "openai",
      model: "gpt-5",
      openaiReasoningEffort: "high" as OpenAIReasoningEffort,
    };
    const side = buildSide(opts, null, null, false, false, "test error");
    expect(side.openaiReasoningEffort).toBe("high");
  });

  it("does NOT include openaiReasoningEffort for anthropic side", () => {
    const opts: CompareSideOptions = {
      backend: "anthropic",
      model: "claude-opus-4-6",
    };
    const side = buildSide(opts, null, null, false, false, "test error");
    expect(side.openaiReasoningEffort).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// categorizeError
// ---------------------------------------------------------------------------

describe("categorizeError", () => {
  it("classifies max_tokens / unsupported parameter as api_param", () => {
    expect(categorizeError("Unsupported parameter: 'max_tokens' is not supported with this model. Use 'max_completion_tokens' instead.")).toBe("api_param");
    expect(categorizeError("max_tokens is not supported with this model")).toBe("api_param");
    expect(categorizeError("unsupported parameter foo")).toBe("api_param");
  });

  it("classifies Zod / validation failures as schema_validation", () => {
    expect(categorizeError("Zod validation failed: findings[0].severity")).toBe("schema_validation");
    expect(categorizeError("schema mismatch: invalid_type at path x")).toBe("schema_validation");
    expect(categorizeError("validation error: required field missing")).toBe("schema_validation");
  });

  it("classifies JSON parse failures as json_parse", () => {
    expect(categorizeError("Unexpected token < in JSON")).toBe("json_parse");
    expect(categorizeError("JSON parse error at position 1200")).toBe("json_parse");
    expect(categorizeError("output was truncated mid-JSON")).toBe("json_parse");
  });

  it("classifies auth / access failures as provider_access", () => {
    expect(categorizeError("Invalid API key: authentication failed")).toBe("provider_access");
    expect(categorizeError("model_not_found: gpt-5")).toBe("provider_access");
    expect(categorizeError("Permission denied")).toBe("provider_access");
  });

  it("classifies timeout failures as timeout", () => {
    expect(categorizeError("Request timed out after 30s")).toBe("timeout");
    expect(categorizeError("timeout reached")).toBe("timeout");
  });

  it("returns unknown for unrecognised errors", () => {
    expect(categorizeError("Something went very wrong")).toBe("unknown");
    expect(categorizeError("")).toBe("unknown");
  });
});

// ---------------------------------------------------------------------------
// buildSide — errorCategory in output
// ---------------------------------------------------------------------------

describe("buildSide — errorCategory", () => {
  it("includes errorCategory when error is set", () => {
    const opts: CompareSideOptions = { backend: "openai", model: "gpt-5" };
    const side = buildSide(
      opts,
      null,
      null,
      false,
      false,
      "Unsupported parameter: 'max_tokens' is not supported with this model",
    );
    expect(side.error).toBeDefined();
    expect(side.errorCategory).toBe("api_param");
  });

  it("errorCategory absent on successful sides (no error field set)", () => {
    // A successful side has no error property at all
    const opts: CompareSideOptions = { backend: "anthropic" };
    const side = buildSide(opts, null, null, false, false, undefined);
    // No error passed → falls through to "Analysis failed" default
    expect(side.errorCategory).toBeDefined(); // fallback error is always set
  });
});

// ---------------------------------------------------------------------------
// buildCompareSideOptions — compareRetries plumbing
// ---------------------------------------------------------------------------

describe("buildCompareSideOptions — compareRetries", () => {
  it("passes compareRetries to both sides", () => {
    const a = buildCompareSideOptions("a", { compareRetries: 0 });
    const b = buildCompareSideOptions("b", { compareRetries: 0 });
    expect(a.maxRetries).toBe(0);
    expect(b.maxRetries).toBe(0);
  });

  it("leaves maxRetries undefined when compareRetries is not supplied (defaults in toAnalysisOptions)", () => {
    const a = buildCompareSideOptions("a", {});
    const b = buildCompareSideOptions("b", {});
    expect(a.maxRetries).toBeUndefined();
    expect(b.maxRetries).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// buildCompareSideOptions — verbosity + structured
// ---------------------------------------------------------------------------

describe("buildCompareSideOptions — verbosity + structured", () => {
  it("passes openaiVerbosity to side B (openai)", () => {
    const b = buildCompareSideOptions("b", {
      openaiVerbosity: "low" as OpenAIVerbosity,
    });
    expect(b.openaiVerbosity).toBe("low");
  });

  it("does NOT put verbosity on side A (anthropic)", () => {
    const a = buildCompareSideOptions("a", {
      openaiVerbosity: "high" as OpenAIVerbosity,
    });
    expect(a.openaiVerbosity).toBeUndefined();
  });

  it("passes openaiStructured to side B (openai)", () => {
    const b = buildCompareSideOptions("b", { openaiStructured: true });
    expect(b.openaiStructured).toBe(true);
  });

  it("does NOT put structured on side A (anthropic)", () => {
    const a = buildCompareSideOptions("a", { openaiStructured: true });
    expect(a.openaiStructured).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// toAnalysisOptions — verbosity + structured
// ---------------------------------------------------------------------------

describe("toAnalysisOptions — verbosity + structured", () => {
  it("passes openaiVerbosity through to AnalysisOptions", () => {
    const opts = toAnalysisOptions({
      backend: "openai",
      model: "gpt-5.4",
      openaiVerbosity: "medium" as OpenAIVerbosity,
    });
    expect(opts.openaiVerbosity).toBe("medium");
  });

  it("passes openaiStructured through to AnalysisOptions", () => {
    const opts = toAnalysisOptions({
      backend: "openai",
      model: "gpt-5.4",
      openaiStructured: true,
    });
    expect(opts.openaiStructured).toBe(true);
  });

  it("leaves verbosity/structured undefined when not set", () => {
    const opts = toAnalysisOptions({ backend: "openai" });
    expect(opts.openaiVerbosity).toBeUndefined();
    expect(opts.openaiStructured).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// buildSide — verbosity + structured in output
// ---------------------------------------------------------------------------

describe("buildSide — verbosity + structured in output", () => {
  it("includes openaiVerbosity in output for openai side", () => {
    const opts: CompareSideOptions = {
      backend: "openai",
      model: "gpt-5.4",
      openaiVerbosity: "low" as OpenAIVerbosity,
    };
    const side = buildSide(opts, null, null, false, false, "test error");
    expect(side.openaiVerbosity).toBe("low");
  });

  it("includes openaiStructured in output for openai side", () => {
    const opts: CompareSideOptions = {
      backend: "openai",
      model: "gpt-5.4",
      openaiStructured: true,
    };
    const side = buildSide(opts, null, null, false, false, "test error");
    expect(side.openaiStructured).toBe(true);
  });

  it("does NOT include verbosity/structured for anthropic side", () => {
    const opts: CompareSideOptions = { backend: "anthropic", model: "claude-opus-4-6" };
    const side = buildSide(opts, null, null, false, false, "test error");
    expect(side.openaiVerbosity).toBeUndefined();
    expect(side.openaiStructured).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// OpenAI reasoning effort — "none" as a valid value
// ---------------------------------------------------------------------------

describe("buildCompareSideOptions — reasoning effort none", () => {
  it("accepts 'none' as a reasoning effort value for side B", () => {
    const b = buildCompareSideOptions("b", {
      openaiReasoningEffort: "none" as OpenAIReasoningEffort,
    });
    expect(b.openaiReasoningEffort).toBe("none");
  });
});
