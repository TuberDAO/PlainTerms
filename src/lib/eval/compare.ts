/**
 * Side-by-side comparison helpers for the dev eval harness.
 *
 * These functions are pure/synchronous — they just shape data.
 * The actual LLM calls happen in the route.
 */

import type { Report } from "@/types/report";
import type { DiagnosticSummary } from "@/lib/eval/diagnostic";
import type {
  AnalysisOptions,
  OpenAIReasoningEffort,
  OpenAIVerbosity,
} from "@/lib/llm/openai";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Broad category for a compare-side error, making it easy to triage failures
 * without reading raw API error strings.
 */
export type CompareErrorCategory =
  | "api_param"        // unsupported parameter (e.g. max_tokens on GPT-5)
  | "schema_validation" // Zod / schema validation failure
  | "json_parse"       // JSON parsing / truncation failure
  | "provider_access"  // API key / auth / model not found
  | "timeout"          // request timed out
  | "unknown";

/**
 * Classify an error message string into a `CompareErrorCategory`.
 * Exported so tests can verify the logic independently.
 */
export function categorizeError(message: string): CompareErrorCategory {
  const m = message.toLowerCase();
  if (
    m.includes("max_tokens") ||
    m.includes("unsupported parameter") ||
    m.includes("not supported with this model")
  )
    return "api_param";
  if (
    m.includes("zod") ||
    m.includes("schema") ||
    m.includes("invalid_type") ||
    m.includes("validation")
  )
    return "schema_validation";
  if (
    m.includes("json") ||
    m.includes("parse") ||
    m.includes("unexpected token") ||
    m.includes("truncated")
  )
    return "json_parse";
  if (
    m.includes("api_key") ||
    m.includes("authentication") ||
    m.includes("permission") ||
    m.includes("not found") ||
    m.includes("unauthorized") ||
    m.includes("model_not_found")
  )
    return "provider_access";
  if (m.includes("timeout") || m.includes("timed out"))
    return "timeout";
  return "unknown";
}

export interface CompareSideOptions {
  backend: "openai" | "anthropic";
  model?: string;
  maxOutputTokens?: number;
  temperature?: number;
  /** OpenAI-only. Passed as reasoning_effort to the API. Ignored for Anthropic. */
  openaiReasoningEffort?: OpenAIReasoningEffort;
  /** GPT-5.x output verbosity. Dev/eval only. Ignored for Anthropic. */
  openaiVerbosity?: OpenAIVerbosity;
  /** When true, GPT-5.x uses structured output (json_schema) instead of json_object. */
  openaiStructured?: boolean;
  /**
   * Quality-gate retry budget for this side.
   * Defaults to 1 in compare mode (was previously hardcoded to 0).
   * Set to 0 to disable retries (faster but more fragile for Anthropic first-pass issues).
   */
  maxRetries?: number;
}

/** Summary for one side of the comparison (safe to return by default). */
export interface CompareSide {
  backend: "openai" | "anthropic";
  model: string;
  /** Effective reasoning effort for this side (OpenAI only; absent for Anthropic). */
  openaiReasoningEffort?: OpenAIReasoningEffort;
  /** GPT-5.x verbosity (OpenAI only; absent when not set). */
  openaiVerbosity?: OpenAIVerbosity;
  /** Whether structured output (json_schema) was used (OpenAI GPT-5.x only). */
  openaiStructured?: boolean;
  options: CompareSideOptions;
  /** Null when the analysis failed. */
  verdict: {
    headline: string;
    summary: string;
    severityOverall: string;
    scoreOverall: number;
  } | null;
  diagnostic: DiagnosticSummary | null;
  topFindings: { severity: string; title: string; shortWhy: string; impactType?: string; actionTiming?: string; decisionRelevance?: string }[];
  topClauseLabels: string[];
  truncated: boolean;
  userQuestionPresent: boolean;
  userAnswerPresent: boolean;
  error?: string;
  /** Structured failure category — present only when error is set. */
  errorCategory?: CompareErrorCategory;
  /** Only present when debug=true. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fullReport?: any;
}

/** Top-level comparison summary — descriptive, not opinionated. */
export interface ComparisonSummary {
  findingsCountA: number;
  findingsCountB: number;
  clauseCardsCountA: number;
  clauseCardsCountB: number;
  highSeverityCountA: number;
  highSeverityCountB: number;
  populatedNegotiationCountA: number;
  populatedNegotiationCountB: number;
  decisionCriticalCountA: number;
  decisionCriticalCountB: number;
  topDecisionCriticalTitlesA: string[];
  topDecisionCriticalTitlesB: string[];
  scoreOverallA: number | null;
  scoreOverallB: number | null;
  notes: string[];
}

export interface CompareResponse {
  ranAt: string;
  compareMode: true;
  inputId: string;
  sides: { a: CompareSide; b: CompareSide };
  summary: ComparisonSummary;
}

// ---------------------------------------------------------------------------
// Analysis options helpers
// ---------------------------------------------------------------------------

const DEFAULT_ANTHROPIC_MODEL = "claude-opus-4-6";
const DEFAULT_OPENAI_MODEL = "gpt-4o-mini";
const DEFAULT_COMPARE_MAX_TOKENS = 4000;
const DEFAULT_COMPARE_TEMPERATURE = 0.2;

/**
 * Build per-side AnalysisOptions from compare query params.
 * All per-side overrides are dev-only and never affect production.
 */
export function buildCompareSideOptions(
  side: "a" | "b",
  params: {
    anthropicModel?: string;
    openaiModel?: string;
    anthropicMaxTokens?: number;
    openaiMaxTokens?: number;
    temperature?: number;
    openaiReasoningEffort?: OpenAIReasoningEffort;
    openaiVerbosity?: OpenAIVerbosity;
    openaiStructured?: boolean;
    /** Shared retry budget for both sides. Defaults to 1. */
    compareRetries?: number;
  },
): CompareSideOptions {
  if (side === "a") {
    return {
      backend: "anthropic",
      model: params.anthropicModel ?? DEFAULT_ANTHROPIC_MODEL,
      maxOutputTokens: params.anthropicMaxTokens ?? DEFAULT_COMPARE_MAX_TOKENS,
      temperature: params.temperature ?? DEFAULT_COMPARE_TEMPERATURE,
      maxRetries: params.compareRetries,
    };
  }
  return {
    backend: "openai",
    model: params.openaiModel ?? DEFAULT_OPENAI_MODEL,
    maxOutputTokens: params.openaiMaxTokens ?? DEFAULT_COMPARE_MAX_TOKENS,
    temperature: params.temperature ?? DEFAULT_COMPARE_TEMPERATURE,
    openaiReasoningEffort: params.openaiReasoningEffort,
    openaiVerbosity: params.openaiVerbosity,
    openaiStructured: params.openaiStructured,
    maxRetries: params.compareRetries,
  };
}

export function toAnalysisOptions(opts: CompareSideOptions): AnalysisOptions {
  return {
    backend: opts.backend,
    model: opts.model,
    maxOutputTokens: opts.maxOutputTokens,
    temperature: opts.temperature,
    maxRetries: opts.maxRetries ?? 1,
    openaiReasoningEffort: opts.openaiReasoningEffort,
    openaiVerbosity: opts.openaiVerbosity,
    openaiStructured: opts.openaiStructured,
  };
}

// ---------------------------------------------------------------------------
// Side builder
// ---------------------------------------------------------------------------

/**
 * Shape raw analysis results into a `CompareSide` object.
 * If the analysis threw an error, returns an error-state side.
 */
export function buildSide(
  opts: CompareSideOptions,
  report: Report | null,
  diagnostic: DiagnosticSummary | null,
  truncated: boolean,
  debug: boolean,
  error?: string,
): CompareSide {
  const resolvedModel = opts.model ?? (opts.backend === "anthropic" ? DEFAULT_ANTHROPIC_MODEL : DEFAULT_OPENAI_MODEL);

  const openaiFields: Partial<CompareSide> = {};
  if (opts.backend === "openai") {
    if (opts.openaiReasoningEffort)
      openaiFields.openaiReasoningEffort = opts.openaiReasoningEffort;
    if (opts.openaiVerbosity)
      openaiFields.openaiVerbosity = opts.openaiVerbosity;
    if (opts.openaiStructured)
      openaiFields.openaiStructured = opts.openaiStructured;
  }

  if (!report || error) {
    const errMsg = error ?? "Analysis failed";
    return {
      backend: opts.backend,
      model: resolvedModel,
      ...openaiFields,
      options: opts,
      verdict: null,
      diagnostic: null,
      topFindings: [],
      topClauseLabels: [],
      truncated,
      userQuestionPresent: false,
      userAnswerPresent: false,
      error: errMsg,
      errorCategory: categorizeError(errMsg),
    };
  }

  return {
    backend: opts.backend,
    model: resolvedModel,
    ...openaiFields,
    options: opts,
    verdict: {
      headline: report.verdict.headline,
      summary: report.verdict.summary,
      severityOverall: report.verdict.severityOverall,
      scoreOverall: report.verdict.scoreOverall,
    },
    diagnostic,
    topFindings: report.findings.slice(0, 6).map((f) => ({
      severity: f.severity,
      title: f.title,
      shortWhy: f.shortWhy,
      impactType: f.impactType,
      actionTiming: f.actionTiming,
      decisionRelevance: f.decisionRelevance,
    })),
    topClauseLabels: report.clauseCards.slice(0, 8).map((c) => c.clauseLabel),
    truncated,
    userQuestionPresent: !!report.userQuestion,
    userAnswerPresent: !!report.userAnswer,
    ...(debug ? { fullReport: report } : {}),
  };
}

// ---------------------------------------------------------------------------
// Comparison summary
// ---------------------------------------------------------------------------

/**
 * Builds the descriptive ComparisonSummary from two completed sides.
 * Does NOT pick a winner. Surfaces objective differences.
 */
export function buildComparisonSummary(
  a: CompareSide,
  b: CompareSide,
): ComparisonSummary {
  const dA = a.diagnostic;
  const dB = b.diagnostic;

  const findingsA = dA?.findingsCount ?? 0;
  const findingsB = dB?.findingsCount ?? 0;
  const clauseA = dA?.clauseCardsCount ?? 0;
  const clauseB = dB?.clauseCardsCount ?? 0;

  const highSevA = (dA?.severitiesBreakdown.critical ?? 0) + (dA?.severitiesBreakdown.high ?? 0);
  const highSevB = (dB?.severitiesBreakdown.critical ?? 0) + (dB?.severitiesBreakdown.high ?? 0);
  const negA = dA?.populatedNegotiationCount ?? 0;
  const negB = dB?.populatedNegotiationCount ?? 0;
  const dcA = dA?.decisionRelevanceBreakdown["decision-critical"] ?? 0;
  const dcB = dB?.decisionRelevanceBreakdown["decision-critical"] ?? 0;

  const dcTitlesA = a.topFindings
    .filter((f) => f.decisionRelevance === "decision-critical")
    .map((f) => f.title)
    .slice(0, 4);
  const dcTitlesB = b.topFindings
    .filter((f) => f.decisionRelevance === "decision-critical")
    .map((f) => f.title)
    .slice(0, 4);

  const notes: string[] = [];

  if (a.error) notes.push(`Side A (${a.backend}) failed: ${a.error}`);
  if (b.error) notes.push(`Side B (${b.backend}) failed: ${b.error}`);

  const findingsDiff = Math.abs(findingsA - findingsB);
  if (findingsDiff >= 3) {
    const more = findingsA > findingsB ? "A" : "B";
    notes.push(`Side ${more} returned notably more findings (${Math.max(findingsA, findingsB)} vs ${Math.min(findingsA, findingsB)}).`);
  }

  if (highSevA === 0 && highSevB > 0) {
    notes.push("Side B surfaced high/critical severity findings; side A did not.");
  } else if (highSevB === 0 && highSevA > 0) {
    notes.push("Side A surfaced high/critical severity findings; side B did not.");
  }

  if (a.truncated && !b.truncated) {
    notes.push("Side A (Anthropic) truncated the input; side B did not.");
  } else if (b.truncated && !a.truncated) {
    notes.push("Side B (OpenAI) truncated the input; side A did not.");
  }

  if (negA > 0 && negB === 0) {
    notes.push("Side A populated negotiation fields; side B left them empty.");
  } else if (negB > 0 && negA === 0) {
    notes.push("Side B populated negotiation fields; side A left them empty.");
  }

  if (dcA > dcB + 1) {
    notes.push(`Side A produced more decision-critical findings (${dcA} vs ${dcB}).`);
  } else if (dcB > dcA + 1) {
    notes.push(`Side B produced more decision-critical findings (${dcB} vs ${dcA}).`);
  }

  return {
    findingsCountA: findingsA,
    findingsCountB: findingsB,
    clauseCardsCountA: clauseA,
    clauseCardsCountB: clauseB,
    highSeverityCountA: highSevA,
    highSeverityCountB: highSevB,
    populatedNegotiationCountA: negA,
    populatedNegotiationCountB: negB,
    decisionCriticalCountA: dcA,
    decisionCriticalCountB: dcB,
    topDecisionCriticalTitlesA: dcTitlesA,
    topDecisionCriticalTitlesB: dcTitlesB,
    scoreOverallA: a.verdict?.scoreOverall ?? null,
    scoreOverallB: b.verdict?.scoreOverall ?? null,
    notes,
  };
}
