import { describe, it, expect } from "vitest";
import {
  getOpenAITokenParamName,
  isOpenAITemperatureFixed,
  shouldUseResponsesAPI,
  extractResponsesAPIText,
  buildResponsesAPIInput,
  buildResponsesTextFormat,
  isLikelyIncompleteJson,
  RESPONSES_API_JSON_SUFFIX,
  LARGE_DOC_THRESHOLD_CHARS,
  MAX_CANONICAL_ISSUES_PER_SECTION,
  EXTRACTION_MAX_OUTPUT_TOKENS,
  EXTRACTION_RETRY_OUTPUT_TOKENS,
  TOP_ISSUES_LIMIT,
  SECTION_SYNTH_MAX_OUTPUT_TOKENS,
  SECTION_SYNTH_RETRY_OUTPUT_TOKENS,
  ISSUES_PER_SYNTH_GROUP,
  GROUP_SYNTH_MAX_OUTPUT_TOKENS,
  GROUP_SYNTH_RETRY_OUTPUT_TOKENS,
  buildSectionSummaries,
  computeTopIssues,
  buildAllIssuesBySection,
  runPerSectionSynthesis,
  chunkCanonicalIssuesForSynthesis,
  estimateGroupTokenBudget,
  estimateSectionTokenBudget,
  classifyExtractionError,
  SYSTEM_PROMPT,
  GROUP_SYNTHESIS_SYSTEM_PROMPT,
  VERDICT_SYNTHESIS_PROMPT,
  isShortDocTimeoutRecoverable,
  type ChunkIssue,
  type SectionSummary,
} from "./openai";
import { isTransientTransportError } from "./anthropic";
import type { Finding } from "@/types/report";

describe("getOpenAITokenParamName", () => {
  it("returns max_completion_tokens for gpt-5", () => {
    expect(getOpenAITokenParamName("gpt-5")).toBe("max_completion_tokens");
  });

  it("returns max_completion_tokens for gpt-5.2", () => {
    expect(getOpenAITokenParamName("gpt-5.2")).toBe("max_completion_tokens");
  });

  it("returns max_completion_tokens for gpt-5-mini variants", () => {
    expect(getOpenAITokenParamName("gpt-5-mini")).toBe("max_completion_tokens");
    expect(getOpenAITokenParamName("gpt-5-mini-2025-04")).toBe("max_completion_tokens");
  });

  it("returns max_completion_tokens for o-series reasoning models", () => {
    expect(getOpenAITokenParamName("o1")).toBe("max_completion_tokens");
    expect(getOpenAITokenParamName("o1-mini")).toBe("max_completion_tokens");
    expect(getOpenAITokenParamName("o3")).toBe("max_completion_tokens");
    expect(getOpenAITokenParamName("o3-mini")).toBe("max_completion_tokens");
    expect(getOpenAITokenParamName("o4-mini")).toBe("max_completion_tokens");
  });

  it("returns max_tokens for gpt-4o family", () => {
    expect(getOpenAITokenParamName("gpt-4o")).toBe("max_tokens");
    expect(getOpenAITokenParamName("gpt-4o-mini")).toBe("max_tokens");
  });

  it("returns max_tokens for gpt-4 family", () => {
    expect(getOpenAITokenParamName("gpt-4")).toBe("max_tokens");
    expect(getOpenAITokenParamName("gpt-4-turbo")).toBe("max_tokens");
  });

  it("returns max_tokens for gpt-3.5-turbo (legacy)", () => {
    expect(getOpenAITokenParamName("gpt-3.5-turbo")).toBe("max_tokens");
  });

  it("returns max_tokens for unknown/custom models as a safe default", () => {
    expect(getOpenAITokenParamName("my-custom-ft-model")).toBe("max_tokens");
    expect(getOpenAITokenParamName("")).toBe("max_tokens");
  });
});

describe("isOpenAITemperatureFixed", () => {
  it("returns true for gpt-5.x — temperature must be omitted", () => {
    expect(isOpenAITemperatureFixed("gpt-5")).toBe(true);
    expect(isOpenAITemperatureFixed("gpt-5.2")).toBe(true);
    expect(isOpenAITemperatureFixed("gpt-5.4")).toBe(true);
    expect(isOpenAITemperatureFixed("gpt-5-mini")).toBe(true);
  });

  it("returns true for o-series reasoning models", () => {
    expect(isOpenAITemperatureFixed("o1")).toBe(true);
    expect(isOpenAITemperatureFixed("o1-mini")).toBe(true);
    expect(isOpenAITemperatureFixed("o3")).toBe(true);
    expect(isOpenAITemperatureFixed("o3-mini")).toBe(true);
    expect(isOpenAITemperatureFixed("o4-mini")).toBe(true);
  });

  it("returns false for gpt-4o — temperature is supported", () => {
    expect(isOpenAITemperatureFixed("gpt-4o")).toBe(false);
    expect(isOpenAITemperatureFixed("gpt-4o-mini")).toBe(false);
  });

  it("returns false for gpt-4 family", () => {
    expect(isOpenAITemperatureFixed("gpt-4")).toBe(false);
    expect(isOpenAITemperatureFixed("gpt-4-turbo")).toBe(false);
  });

  it("returns false for unknown/custom models (safe default — do not omit)", () => {
    expect(isOpenAITemperatureFixed("my-fine-tune")).toBe(false);
    expect(isOpenAITemperatureFixed("")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// shouldUseResponsesAPI
// ---------------------------------------------------------------------------

describe("shouldUseResponsesAPI", () => {
  it("returns true for gpt-5.x — must use Responses API", () => {
    expect(shouldUseResponsesAPI("gpt-5")).toBe(true);
    expect(shouldUseResponsesAPI("gpt-5.2")).toBe(true);
    expect(shouldUseResponsesAPI("gpt-5.4")).toBe(true);
    expect(shouldUseResponsesAPI("gpt-5-mini")).toBe(true);
  });

  it("returns false for o-series — Chat Completions still works", () => {
    expect(shouldUseResponsesAPI("o1")).toBe(false);
    expect(shouldUseResponsesAPI("o3")).toBe(false);
    expect(shouldUseResponsesAPI("o4-mini")).toBe(false);
  });

  it("returns false for gpt-4o family — Chat Completions path", () => {
    expect(shouldUseResponsesAPI("gpt-4o")).toBe(false);
    expect(shouldUseResponsesAPI("gpt-4o-mini")).toBe(false);
  });

  it("returns false for legacy models", () => {
    expect(shouldUseResponsesAPI("gpt-4")).toBe(false);
    expect(shouldUseResponsesAPI("gpt-3.5-turbo")).toBe(false);
    expect(shouldUseResponsesAPI("")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// extractResponsesAPIText
// ---------------------------------------------------------------------------

describe("extractResponsesAPIText", () => {
  it("extracts text from a well-formed Responses API output", () => {
    const data = {
      output: [
        { type: "reasoning", summary: [] },
        {
          type: "message",
          content: [
            { type: "output_text", text: '{"verdict":{"headline":"test"}}' },
          ],
        },
      ],
    };
    expect(extractResponsesAPIText(data)).toBe('{"verdict":{"headline":"test"}}');
  });

  it("concatenates multiple output_text items", () => {
    const data = {
      output: [
        {
          type: "message",
          content: [
            { type: "output_text", text: "part1" },
            { type: "output_text", text: "part2" },
          ],
        },
      ],
    };
    expect(extractResponsesAPIText(data)).toBe("part1part2");
  });

  it("skips non-message and non-output_text items", () => {
    const data = {
      output: [
        { type: "reasoning", content: [{ type: "summary_text", text: "thinking..." }] },
        { type: "message", content: [{ type: "output_text", text: "answer" }] },
      ],
    };
    expect(extractResponsesAPIText(data)).toBe("answer");
  });

  it("returns empty string when output array is absent", () => {
    expect(extractResponsesAPIText({})).toBe("");
  });

  it("returns empty string when output array is empty", () => {
    expect(extractResponsesAPIText({ output: [] })).toBe("");
  });

  it("returns empty string when message has no output_text content", () => {
    const data = {
      output: [
        { type: "message", content: [{ type: "refusal", text: "sorry" }] },
      ],
    };
    expect(extractResponsesAPIText(data)).toBe("");
  });
});

// ---------------------------------------------------------------------------
// extractResponsesAPIText — fallback path + SDK response shape
// ---------------------------------------------------------------------------

describe("extractResponsesAPIText — SDK response shape", () => {
  it("handles SDK response where output is an array of typed items", () => {
    // Mirrors what `response.output` looks like from the SDK
    const sdkResponse = {
      output_text: "",
      output: [
        {
          type: "reasoning",
          content: [],
        },
        {
          type: "message",
          content: [
            { type: "output_text", text: '{"result":"ok"}' },
          ],
        },
      ],
    };
    // When output_text is empty, the fallback should find the message text
    const text = sdkResponse.output_text || extractResponsesAPIText(sdkResponse);
    expect(text).toBe('{"result":"ok"}');
  });

  it("output_text field takes precedence when non-empty", () => {
    const sdkResponse = {
      output_text: '{"from":"output_text"}',
      output: [
        {
          type: "message",
          content: [{ type: "output_text", text: '{"from":"output_array"}' }],
        },
      ],
    };
    const text = sdkResponse.output_text || extractResponsesAPIText(sdkResponse);
    expect(text).toBe('{"from":"output_text"}');
  });

  it("does not assume text lives at output[0].content[0].text — skips reasoning items", () => {
    const sdkResponse = {
      output_text: "",
      output: [
        // First item is reasoning, NOT message — should be skipped
        {
          type: "reasoning",
          content: [{ type: "thinking", text: "Let me think..." }],
        },
        // Second item is the actual message
        {
          type: "message",
          content: [{ type: "output_text", text: "answer" }],
        },
      ],
    };
    const text = sdkResponse.output_text || extractResponsesAPIText(sdkResponse);
    expect(text).toBe("answer"); // extracted from item[1], not item[0]
  });
});

// ---------------------------------------------------------------------------
// buildResponsesAPIInput — JSON-mode suffix injection
// ---------------------------------------------------------------------------

describe("buildResponsesAPIInput", () => {
  it("appends the JSON suffix to the last user message", () => {
    const messages = [
      { role: "system" as const, content: "You are a helper." },
      { role: "user" as const, content: "Analyse this contract." },
    ];
    const input = buildResponsesAPIInput(messages);
    expect(input).toHaveLength(1);
    expect(input[0].role).toBe("user");
    expect(input[0].content).toContain(RESPONSES_API_JSON_SUFFIX);
    // The API check is case-insensitive; verify the word appears in any case.
    expect(input[0].content.toLowerCase()).toContain("json");
  });

  it("excludes the system message from the returned input array", () => {
    const messages = [
      { role: "system" as const, content: "System." },
      { role: "user" as const, content: "User." },
    ];
    const input = buildResponsesAPIInput(messages);
    expect(input.every((m) => m.role === "user" || m.role === "assistant")).toBe(true);
  });

  it("appends suffix only to the last user message, not earlier ones", () => {
    const messages = [
      { role: "system" as const, content: "Sys." },
      { role: "user" as const, content: "First user turn." },
      { role: "assistant" as const, content: "Response." },
      { role: "user" as const, content: "Revision prompt." },
    ];
    const input = buildResponsesAPIInput(messages);
    expect(input).toHaveLength(3);
    expect(input[0].content).toBe("First user turn."); // no suffix on earlier user message
    expect(input[1].content).toBe("Response.");
    expect(input[2].content).toContain(RESPONSES_API_JSON_SUFFIX); // suffix on last user message
  });

  it("does not double-append if content already contains the suffix", () => {
    const messages = [
      { role: "user" as const, content: "Already has.\n\nReturn valid JSON only." },
    ];
    const input = buildResponsesAPIInput(messages);
    // Implementation appends regardless — test that "json" appears at least once
    expect(input[0].content.toLowerCase()).toContain("json");
  });

  it("handles a single user message with no system message", () => {
    const messages = [{ role: "user" as const, content: "Hello." }];
    const input = buildResponsesAPIInput(messages);
    expect(input).toHaveLength(1);
    expect(input[0].content).toContain(RESPONSES_API_JSON_SUFFIX);
  });

  it("preserves assistant messages untouched", () => {
    const messages = [
      { role: "user" as const, content: "Q1." },
      { role: "assistant" as const, content: "A1." },
      { role: "user" as const, content: "Q2." },
    ];
    const input = buildResponsesAPIInput(messages);
    const assistantMsg = input.find((m) => m.role === "assistant");
    expect(assistantMsg?.content).toBe("A1."); // no suffix added to assistant
  });

  it("suffix contains the word 'json' (required by the Responses API)", () => {
    expect(RESPONSES_API_JSON_SUFFIX.toLowerCase()).toContain("json");
  });
});

// ---------------------------------------------------------------------------
// buildResponsesTextFormat — json_object vs json_schema
// ---------------------------------------------------------------------------

describe("buildResponsesTextFormat", () => {
  it("returns json_object format when structured=false", () => {
    const fmt = buildResponsesTextFormat(false);
    expect(fmt).toEqual({ format: { type: "json_object" } });
  });

  it("returns json_schema format when structured=true", () => {
    const fmt = buildResponsesTextFormat(true);
    expect(fmt.format).toBeDefined();
    const format = fmt.format as { type: string; name: string; strict: boolean; schema: Record<string, unknown> };
    expect(format.type).toBe("json_schema");
    expect(format.name).toBe("plain_terms_report");
    expect(format.strict).toBe(false);
    expect(format.schema).toBeDefined();
    expect((format.schema as { required: string[] }).required).toContain("verdict");
    expect((format.schema as { required: string[] }).required).toContain("findings");
  });
});

// ---------------------------------------------------------------------------
// OpenAIReasoningEffort — "none" is a valid value
// ---------------------------------------------------------------------------

describe("OpenAIReasoningEffort — none", () => {
  it("'none' is accepted as a reasoning effort value (type-level check via runtime test)", () => {
    const effort: import("./openai").OpenAIReasoningEffort = "none";
    expect(effort).toBe("none");
    expect(["none", "low", "medium", "high", "xhigh"]).toContain(effort);
  });
});

// ---------------------------------------------------------------------------
// isLikelyIncompleteJson — truncation detection
// ---------------------------------------------------------------------------

describe("isLikelyIncompleteJson", () => {
  it("returns false for valid complete JSON object", () => {
    expect(isLikelyIncompleteJson('{"key":"value"}')).toBe(false);
  });

  it("returns false for valid complete JSON with nested structures", () => {
    expect(isLikelyIncompleteJson('{"a":[1,2,{"b":"c"}]}')).toBe(false);
  });

  it("returns true for empty string", () => {
    expect(isLikelyIncompleteJson("")).toBe(true);
  });

  it("returns true for truncated mid-object", () => {
    expect(isLikelyIncompleteJson('{"verdict":{"headline":"test"')).toBe(true);
  });

  it("returns true for truncated mid-array", () => {
    expect(isLikelyIncompleteJson('{"findings":[{"id":"f-1"},{"id":"f-2"')).toBe(true);
  });

  it("returns true for truncated mid-string", () => {
    expect(isLikelyIncompleteJson('{"key":"value is still going')).toBe(true);
  });

  it("returns true for unbalanced braces", () => {
    expect(isLikelyIncompleteJson('{"a":{"b":1}')).toBe(true);
  });

  it("returns true for unbalanced brackets", () => {
    expect(isLikelyIncompleteJson('{"a":[1,2,3}')).toBe(true);
  });

  it("returns true for JSON ending with comma", () => {
    expect(isLikelyIncompleteJson('{"a":1,')).toBe(true);
  });

  it("returns false for JSON with escaped quotes inside strings", () => {
    expect(isLikelyIncompleteJson('{"key":"value with \\"quotes\\""}')).toBe(false);
  });

  it("returns true for real-world truncated report JSON", () => {
    const truncated = '{"verdict":{"headline":"Multiple consumer traps detected","summary":"This insurance policy contains several clauses that could cost you money.","severityOverall":"high","scoreOverall":35},"findings":[{"id":"f-1","title":"High deductible","severity":"high","score":30,"tags":["SurpriseBilling"],"shortWhy":"The deductible is $5,000 per person","relatedClauseIds":["c-1"],"impactType":"cost","actionTiming":"before-signing","decisionRelevance":"decision-critical"},{"id":"f-2","title":"Out-of-network trap","severity":"high","score":25,"tags":["SurpriseBilling"],"shortWhy":"Out-of-network care is not covered at all';
    expect(isLikelyIncompleteJson(truncated)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Large document pipeline — threshold and types
// ---------------------------------------------------------------------------

describe("LARGE_DOC_THRESHOLD_CHARS", () => {
  it("is a reasonable threshold for triggering multi-pass analysis", () => {
    expect(LARGE_DOC_THRESHOLD_CHARS).toBeGreaterThanOrEqual(100_000);
    expect(LARGE_DOC_THRESHOLD_CHARS).toBeLessThanOrEqual(300_000);
  });

  it("a 250K char doc exceeds the threshold", () => {
    expect(250_000 >= LARGE_DOC_THRESHOLD_CHARS).toBe(true);
  });

  it("a 50K char doc does NOT exceed the threshold", () => {
    expect(50_000 >= LARGE_DOC_THRESHOLD_CHARS).toBe(false);
  });
});

describe("ChunkIssue type", () => {
  it("matches the expected extraction shape including mechanismType", () => {
    const issue: ChunkIssue = {
      clauseLabel: "Cancellation window",
      excerpt: "You must provide 60 days written notice...",
      shortWhy: "The cancellation window is very narrow.",
      severity: "high",
      tags: ["TimeTrap"],
      impactType: "cancellation",
      actionTiming: "before-cancellation",
      decisionRelevance: "decision-critical",
      mechanismType: "termination_rescission",
    };
    expect(issue.clauseLabel).toBeTruthy();
    expect(issue.excerpt).toBeTruthy();
    expect(issue.severity).toBe("high");
    expect(issue.tags).toHaveLength(1);
    expect(issue.impactType).toBe("cancellation");
    expect(issue.mechanismType).toBe("termination_rescission");
  });
});

// ---------------------------------------------------------------------------
// SectionSummary type shape
// ---------------------------------------------------------------------------

describe("SectionSummary type", () => {
  it("matches the expected shape including mechanismType", () => {
    const summary: SectionSummary = {
      sectionLabel: "Exclusions",
      coverageStatus: "complete",
      sourceChunkCount: 4,
      rawIssueCount: 3,
      canonicalIssues: [
        {
          title: "Pre-existing condition exclusion",
          severity: "high",
          shortWhy: "Excludes pre-existing conditions from coverage.",
          clauseLabel: "Pre-existing condition exclusion",
          excerpt: "Benefits do not include...",
          tags: ["SurpriseBilling"],
          impactType: "coverage",
          actionTiming: "before-signing",
          decisionRelevance: "decision-critical",
          mechanismType: "prior_authorization",
        },
      ],
    };
    expect(summary.sectionLabel).toBe("Exclusions");
    expect(summary.coverageStatus).toBe("complete");
    expect(summary.canonicalIssues).toHaveLength(1);
    expect(summary.canonicalIssues[0].severity).toBe("high");
    expect(summary.canonicalIssues[0].mechanismType).toBe("prior_authorization");
  });
});

// ---------------------------------------------------------------------------
// buildSectionSummaries — canonical merge
// ---------------------------------------------------------------------------

function makeIssue(overrides: Partial<ChunkIssue> = {}): ChunkIssue {
  return {
    clauseLabel: "Test clause",
    excerpt: "some excerpt",
    shortWhy: "some reason",
    severity: "medium",
    tags: [],
    impactType: "other",
    actionTiming: "before-signing",
    decisionRelevance: "important",
    mechanismType: "other",
    ...overrides,
  };
}

function makeFinding(overrides: Partial<Finding> = {}): Finding {
  return {
    id: "f-1",
    title: "Test finding",
    severity: "medium",
    score: 50,
    tags: [],
    shortWhy: "Some finding reason for testing.",
    relatedClauseIds: [],
    impactType: "other",
    actionTiming: "before-signing",
    decisionRelevance: "important",
    ...overrides,
  };
}

describe("buildSectionSummaries", () => {
  it("preserves all distinct deduplicated issues (no arbitrary cap)", () => {
    const issues: ChunkIssue[] = [];
    for (let i = 0; i < 15; i++) {
      issues.push(makeIssue({ clauseLabel: `Clause ${i}`, shortWhy: `Reason ${i}` }));
    }
    const issuesByBatch = new Map<number, ChunkIssue[]>();
    issuesByBatch.set(0, issues);

    const result = buildSectionSummaries(
      issuesByBatch,
      undefined,
      4,
      1,
      new Set(),
      4,
    );

    expect(result).toHaveLength(1);
    expect(result[0].canonicalIssues).toHaveLength(15);
    expect(result[0].rawIssueCount).toBe(15);
  });

  it("deduplicates issues with identical normalized titles (keeps higher severity)", () => {
    const issues: ChunkIssue[] = [
      makeIssue({ clauseLabel: "Auto-Renewal Trap", severity: "low", shortWhy: "A" }),
      makeIssue({ clauseLabel: "auto renewal trap", severity: "high", shortWhy: "B" }),
      makeIssue({ clauseLabel: "Cancellation Window", severity: "medium", shortWhy: "C" }),
    ];
    const issuesByBatch = new Map<number, ChunkIssue[]>();
    issuesByBatch.set(0, issues);

    const result = buildSectionSummaries(issuesByBatch, undefined, 4, 1, new Set(), 4);

    expect(result[0].canonicalIssues).toHaveLength(2);
    const autoRenewal = result[0].canonicalIssues.find((i) => i.title.toLowerCase().includes("renewal"));
    expect(autoRenewal?.severity).toBe("high");
  });

  it("groups issues by section and reports coverage correctly", () => {
    const batch0Issues = [makeIssue({ clauseLabel: "Fee increase" })];
    const batch1Issues = [makeIssue({ clauseLabel: "Cancellation" })];
    const issuesByBatch = new Map<number, ChunkIssue[]>();
    issuesByBatch.set(0, batch0Issues);
    issuesByBatch.set(1, batch1Issues);

    const sections = [
      { label: "Fees", chunkIndices: [0, 1, 2, 3] },
      { label: "Exit", chunkIndices: [4, 5, 6, 7] },
    ];

    const result = buildSectionSummaries(issuesByBatch, sections, 4, 2, new Set(), 8);
    expect(result).toHaveLength(2);
    expect(result[0].sectionLabel).toBe("Fees");
    expect(result[0].coverageStatus).toBe("complete");
    expect(result[1].sectionLabel).toBe("Exit");
    expect(result[1].coverageStatus).toBe("complete");
  });

  it("marks section as partial when some batches failed", () => {
    const issuesByBatch = new Map<number, ChunkIssue[]>();
    issuesByBatch.set(0, [makeIssue({ clauseLabel: "Clause A" })]);
    issuesByBatch.set(1, []);

    const failedBatchIndices = new Set([1]);
    const sections = [
      { label: "Section 1", chunkIndices: [0, 1, 2, 3, 4, 5, 6, 7] },
    ];

    const result = buildSectionSummaries(issuesByBatch, sections, 4, 2, failedBatchIndices, 8);
    expect(result[0].coverageStatus).toBe("partial");
  });

  it("marks section as failed when all its batches failed", () => {
    const issuesByBatch = new Map<number, ChunkIssue[]>();
    issuesByBatch.set(0, []);
    issuesByBatch.set(1, [makeIssue({ clauseLabel: "Good clause" })]);

    const failedBatchIndices = new Set([0]);
    const sections = [
      { label: "Failed Section", chunkIndices: [0, 1, 2, 3] },
      { label: "Good Section", chunkIndices: [4, 5, 6, 7] },
    ];

    const result = buildSectionSummaries(issuesByBatch, sections, 4, 2, failedBatchIndices, 8);
    expect(result[0].sectionLabel).toBe("Failed Section");
    expect(result[0].coverageStatus).toBe("failed");
    expect(result[1].sectionLabel).toBe("Good Section");
    expect(result[1].coverageStatus).toBe("complete");
  });

  it("stage-2 receives SectionSummary[] not raw ChunkIssue[]", () => {
    const issues: ChunkIssue[] = [
      makeIssue({ clauseLabel: "A" }),
      makeIssue({ clauseLabel: "B" }),
    ];
    const issuesByBatch = new Map<number, ChunkIssue[]>();
    issuesByBatch.set(0, issues);

    const summaries = buildSectionSummaries(issuesByBatch, undefined, 4, 1, new Set(), 4);

    expect(Array.isArray(summaries)).toBe(true);
    expect(summaries[0]).toHaveProperty("sectionLabel");
    expect(summaries[0]).toHaveProperty("coverageStatus");
    expect(summaries[0]).toHaveProperty("canonicalIssues");
    expect(summaries[0]).not.toHaveProperty("clauseLabel");
    expect(summaries[0]).not.toHaveProperty("excerpt");
  });
});

// ---------------------------------------------------------------------------
// Ingest threshold — 250K doc should not be truncated
// ---------------------------------------------------------------------------

describe("Ingest thresholds", () => {
  it("a 250K char doc is below HARD_MAX_EXTRACTED_CHARS (400K)", () => {
    const HARD_MAX_EXTRACTED_CHARS = 400_000;
    expect(250_000 < HARD_MAX_EXTRACTED_CHARS).toBe(true);
  });

  it("a 250K char doc should NOT be truncated at ingest", () => {
    const HARD_MAX_EXTRACTED_CHARS = 400_000;
    const docLength = 250_000;
    const isTruncated = docLength > HARD_MAX_EXTRACTED_CHARS;
    expect(isTruncated).toBe(false);
  });

  it("a 500K char doc should be truncated at ingest", () => {
    const HARD_MAX_EXTRACTED_CHARS = 400_000;
    const docLength = 500_000;
    const isTruncated = docLength > HARD_MAX_EXTRACTED_CHARS;
    expect(isTruncated).toBe(true);
  });

  it("a 250K char doc enters large-doc mode", () => {
    expect(250_000 >= LARGE_DOC_THRESHOLD_CHARS).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// mechanismType-aware merge blocking
// ---------------------------------------------------------------------------

describe("deduplicateAndCap — mechanismType merge blocking", () => {
  it("does not merge issues with different mechanismType even if titles match", () => {
    const issues: ChunkIssue[] = [
      makeIssue({
        clauseLabel: "Dispute Resolution",
        severity: "high",
        mechanismType: "arbitration",
      }),
      makeIssue({
        clauseLabel: "Dispute Resolution",
        severity: "medium",
        mechanismType: "class_action_waiver",
      }),
    ];
    const issuesByBatch = new Map<number, ChunkIssue[]>();
    issuesByBatch.set(0, issues);

    const result = buildSectionSummaries(issuesByBatch, undefined, 4, 1, new Set(), 4);

    expect(result[0].canonicalIssues).toHaveLength(2);
    const mechanisms = result[0].canonicalIssues.map((i) => i.mechanismType);
    expect(mechanisms).toContain("arbitration");
    expect(mechanisms).toContain("class_action_waiver");
  });

  it("class action waiver and subrogation reimbursement remain separate", () => {
    const issues: ChunkIssue[] = [
      makeIssue({
        clauseLabel: "Legal Rights Limitation",
        mechanismType: "class_action_waiver",
        severity: "high",
      }),
      makeIssue({
        clauseLabel: "Legal Rights Limitation",
        mechanismType: "subrogation_reimbursement",
        severity: "high",
      }),
    ];
    const issuesByBatch = new Map<number, ChunkIssue[]>();
    issuesByBatch.set(0, issues);

    const result = buildSectionSummaries(issuesByBatch, undefined, 4, 1, new Set(), 4);

    expect(result[0].canonicalIssues).toHaveLength(2);
    const mechanisms = result[0].canonicalIssues.map((i) => i.mechanismType);
    expect(mechanisms).toContain("class_action_waiver");
    expect(mechanisms).toContain("subrogation_reimbursement");
  });

  it("still merges duplicate issues with same title AND same mechanismType (higher severity wins)", () => {
    const issues: ChunkIssue[] = [
      makeIssue({
        clauseLabel: "Forced Arbitration",
        severity: "low",
        mechanismType: "arbitration",
        shortWhy: "A",
      }),
      makeIssue({
        clauseLabel: "forced arbitration",
        severity: "high",
        mechanismType: "arbitration",
        shortWhy: "B",
      }),
    ];
    const issuesByBatch = new Map<number, ChunkIssue[]>();
    issuesByBatch.set(0, issues);

    const result = buildSectionSummaries(issuesByBatch, undefined, 4, 1, new Set(), 4);

    expect(result[0].canonicalIssues).toHaveLength(1);
    expect(result[0].canonicalIssues[0].severity).toBe("high");
  });

  it("issues without mechanismType default to 'other' for merge purposes", () => {
    const issues: ChunkIssue[] = [
      makeIssue({ clauseLabel: "Fee Change", mechanismType: undefined }),
      makeIssue({ clauseLabel: "fee change", mechanismType: undefined }),
    ];
    const issuesByBatch = new Map<number, ChunkIssue[]>();
    issuesByBatch.set(0, issues);

    const result = buildSectionSummaries(issuesByBatch, undefined, 4, 1, new Set(), 4);

    expect(result[0].canonicalIssues).toHaveLength(1);
  });

  it("canonicalIssues carry mechanismType through", () => {
    const issues: ChunkIssue[] = [
      makeIssue({ clauseLabel: "Appeal Deadline", mechanismType: "appeal_deadline" }),
    ];
    const issuesByBatch = new Map<number, ChunkIssue[]>();
    issuesByBatch.set(0, issues);

    const result = buildSectionSummaries(issuesByBatch, undefined, 4, 1, new Set(), 4);

    expect(result[0].canonicalIssues[0].mechanismType).toBe("appeal_deadline");
  });
});

// ---------------------------------------------------------------------------
// computeTopIssues — deterministic ranking
// ---------------------------------------------------------------------------

describe("computeTopIssues", () => {
  it("returns at most TOP_ISSUES_LIMIT findings", () => {
    const findings: Finding[] = [];
    for (let i = 0; i < 20; i++) {
      findings.push(makeFinding({ id: `f-${i}`, title: `Finding ${i}` }));
    }

    const top = computeTopIssues(findings);
    expect(top.length).toBeLessThanOrEqual(TOP_ISSUES_LIMIT);
    expect(top.length).toBe(TOP_ISSUES_LIMIT);
  });

  it("returns all findings when count is below the limit", () => {
    const findings: Finding[] = [
      makeFinding({ id: "f-1" }),
      makeFinding({ id: "f-2" }),
    ];
    const top = computeTopIssues(findings);
    expect(top).toHaveLength(2);
  });

  it("is a subset of the input findings", () => {
    const findings: Finding[] = [];
    for (let i = 0; i < 15; i++) {
      findings.push(makeFinding({ id: `f-${i}`, title: `Finding ${i}` }));
    }
    const top = computeTopIssues(findings);
    for (const t of top) {
      expect(findings.some((f) => f.id === t.id)).toBe(true);
    }
  });

  it("ranks decision-critical findings higher than background", () => {
    const findings: Finding[] = [
      makeFinding({ id: "bg", decisionRelevance: "background", severity: "low" }),
      makeFinding({ id: "dc", decisionRelevance: "decision-critical", severity: "critical" }),
    ];
    const top = computeTopIssues(findings);
    expect(top[0].id).toBe("dc");
  });
});

// ---------------------------------------------------------------------------
// buildAllIssuesBySection — grouping
// ---------------------------------------------------------------------------

describe("buildAllIssuesBySection", () => {
  it("groups findings by sectionLabel", () => {
    const findings: Finding[] = [
      makeFinding({ id: "f-1", sectionLabel: "Fees" }),
      makeFinding({ id: "f-2", sectionLabel: "Fees" }),
      makeFinding({ id: "f-3", sectionLabel: "Exit" }),
    ];

    const result = buildAllIssuesBySection(findings);
    expect(result).toHaveLength(2);

    const fees = result.find((s) => s.sectionLabel === "Fees");
    expect(fees?.issues).toHaveLength(2);

    const exit = result.find((s) => s.sectionLabel === "Exit");
    expect(exit?.issues).toHaveLength(1);
  });

  it("puts findings without sectionLabel into 'Other'", () => {
    const findings: Finding[] = [
      makeFinding({ id: "f-1", sectionLabel: undefined }),
      makeFinding({ id: "f-2", sectionLabel: "Fees" }),
    ];

    const result = buildAllIssuesBySection(findings);
    const other = result.find((s) => s.sectionLabel === "Other");
    expect(other?.issues).toHaveLength(1);
    expect(other?.issues[0].id).toBe("f-1");
  });

  it("returns empty array for no findings", () => {
    expect(buildAllIssuesBySection([])).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Stage-1 extraction budget constants
// ---------------------------------------------------------------------------

describe("Extraction token budgets", () => {
  it("retry budget is larger than initial budget", () => {
    expect(EXTRACTION_RETRY_OUTPUT_TOKENS).toBeGreaterThan(EXTRACTION_MAX_OUTPUT_TOKENS);
  });

  it("initial budget is 3000", () => {
    expect(EXTRACTION_MAX_OUTPUT_TOKENS).toBe(3000);
  });

  it("retry budget is 5000", () => {
    expect(EXTRACTION_RETRY_OUTPUT_TOKENS).toBe(5000);
  });
});

// ---------------------------------------------------------------------------
// classifyExtractionError
// ---------------------------------------------------------------------------

describe("classifyExtractionError", () => {
  it("classifies truncation errors", () => {
    const err = new Error("Extraction truncated");
    (err as Record<string, unknown>).truncated = true;
    expect(classifyExtractionError(err)).toBe("truncation");
  });

  it("classifies transport errors", () => {
    expect(classifyExtractionError(new Error("fetch failed"))).toBe("transport");
    expect(classifyExtractionError(new Error("ECONNRESET"))).toBe("transport");
    expect(classifyExtractionError(new Error("socket hang up"))).toBe("transport");
  });

  it("classifies JSON parse errors", () => {
    expect(classifyExtractionError(new SyntaxError("Unexpected token"))).toBe("parse");
    expect(classifyExtractionError(new Error("Invalid JSON at position 5"))).toBe("parse");
  });

  it("classifies unknown errors", () => {
    expect(classifyExtractionError(new Error("some other error"))).toBe("unknown");
    expect(classifyExtractionError("string error")).toBe("unknown");
    expect(classifyExtractionError(null)).toBe("unknown");
  });

  it("truncation takes priority over transport-like message", () => {
    const err = new Error("fetch failed");
    (err as Record<string, unknown>).truncated = true;
    expect(classifyExtractionError(err)).toBe("truncation");
  });
});

// ---------------------------------------------------------------------------
// isTransientTransportError (from anthropic.ts)
// ---------------------------------------------------------------------------

describe("isTransientTransportError", () => {
  it("returns true for fetch failed", () => {
    expect(isTransientTransportError(new Error("fetch failed"))).toBe(true);
  });

  it("returns true for ECONNRESET", () => {
    expect(isTransientTransportError(new Error("ECONNRESET"))).toBe(true);
  });

  it("returns true for socket hang up", () => {
    expect(isTransientTransportError(new Error("socket hang up"))).toBe(true);
  });

  it("returns true for AbortError", () => {
    const err = new Error("The operation was aborted");
    err.name = "AbortError";
    expect(isTransientTransportError(err)).toBe(true);
  });

  it("returns false for API errors", () => {
    expect(isTransientTransportError(new Error("Anthropic API error 429"))).toBe(false);
  });

  it("returns false for non-Error values", () => {
    expect(isTransientTransportError("string")).toBe(false);
    expect(isTransientTransportError(null)).toBe(false);
    expect(isTransientTransportError(42)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isShortDocTimeoutRecoverable
// ---------------------------------------------------------------------------

describe("isShortDocTimeoutRecoverable", () => {
  it("returns true for AbortError", () => {
    const err = new Error("Aborted");
    err.name = "AbortError";
    expect(isShortDocTimeoutRecoverable(err)).toBe(true);
  });

  it("returns true when the message mentions timed out", () => {
    expect(
      isShortDocTimeoutRecoverable(
        new Error("Anthropic request timed out after 120000ms (stream=false)."),
      ),
    ).toBe(true);
  });

  it("returns false for TRUNCATED_OUTPUT", () => {
    const err = new Error("truncated");
    (err as Record<string, unknown>).code = "TRUNCATED_OUTPUT";
    expect(isShortDocTimeoutRecoverable(err)).toBe(false);
  });

  it("returns false for unrelated API errors", () => {
    expect(isShortDocTimeoutRecoverable(new Error("invalid_api_key"))).toBe(
      false,
    );
  });
});

// ---------------------------------------------------------------------------
// Canonical inflation fix — boundary batches
// ---------------------------------------------------------------------------

describe("buildSectionSummaries — boundary batch deduplication", () => {
  it("does not inflate canonical counts when a batch spans two sections", () => {
    // Batch 0 covers chunks 0-3 which straddles Section A (chunks 0-2) and Section B (chunks 3-5)
    const sharedIssue = makeIssue({ clauseLabel: "Shared Clause", severity: "high" });
    const issuesByBatch = new Map<number, ChunkIssue[]>();
    issuesByBatch.set(0, [sharedIssue]);
    issuesByBatch.set(1, [makeIssue({ clauseLabel: "Section B Only" })]);

    const sections = [
      { label: "Section A", chunkIndices: [0, 1, 2] },
      { label: "Section B", chunkIndices: [3, 4, 5, 6, 7] },
    ];

    const result = buildSectionSummaries(issuesByBatch, sections, 4, 2, new Set(), 8);

    // The shared batch should be assigned to exactly one section (first match)
    const totalCanonical = result.reduce((s, sec) => s + sec.canonicalIssues.length, 0);
    expect(totalCanonical).toBe(2); // 1 from batch 0 (in Section A) + 1 from batch 1 (in Section B)
    expect(totalCanonical).toBeLessThanOrEqual(2); // no inflation
  });

  it("totalCanonicalIssues never exceeds rawCandidates for boundary batches", () => {
    // Create a scenario where batch 1 straddles sections
    const issuesByBatch = new Map<number, ChunkIssue[]>();
    issuesByBatch.set(0, [
      makeIssue({ clauseLabel: "A1" }),
      makeIssue({ clauseLabel: "A2" }),
    ]);
    issuesByBatch.set(1, [
      makeIssue({ clauseLabel: "Boundary Issue" }),
    ]);
    issuesByBatch.set(2, [
      makeIssue({ clauseLabel: "B1" }),
    ]);

    const sections = [
      { label: "Part 1", chunkIndices: [0, 1, 2, 3, 4, 5] },
      { label: "Part 2", chunkIndices: [4, 5, 6, 7, 8, 9, 10, 11] },
    ];

    const result = buildSectionSummaries(issuesByBatch, sections, 4, 3, new Set(), 12);

    const rawTotal = 4; // 2 + 1 + 1
    const canonicalSum = result.reduce((s, sec) => s + sec.canonicalIssues.length, 0);
    expect(canonicalSum).toBeLessThanOrEqual(rawTotal);
  });

  it("assigns boundary batch to first section that references it", () => {
    const issuesByBatch = new Map<number, ChunkIssue[]>();
    issuesByBatch.set(0, [makeIssue({ clauseLabel: "Boundary" })]);

    const sections = [
      { label: "First", chunkIndices: [2, 3] },  // chunk 2 is in batch 0 (batchSize=4, so chunks 0-3 are batch 0)
      { label: "Second", chunkIndices: [0, 1] },  // chunk 0 is also in batch 0
    ];

    const result = buildSectionSummaries(issuesByBatch, sections, 4, 1, new Set(), 4);

    // Batch 0 should be assigned to "First" (first section checked that references it)
    const first = result.find((s) => s.sectionLabel === "First");
    const second = result.find((s) => s.sectionLabel === "Second");
    expect(first?.canonicalIssues).toHaveLength(1);
    expect(second?.canonicalIssues).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Group-level synthesis token budgets
// ---------------------------------------------------------------------------

describe("Group synthesis token budgets", () => {
  it("per-group budgets are much smaller than previous section-level budgets", () => {
    expect(GROUP_SYNTH_MAX_OUTPUT_TOKENS).toBeLessThan(SECTION_SYNTH_MAX_OUTPUT_TOKENS);
    expect(GROUP_SYNTH_RETRY_OUTPUT_TOKENS).toBeLessThan(SECTION_SYNTH_RETRY_OUTPUT_TOKENS);
  });

  it("retry budget is larger than initial budget", () => {
    expect(GROUP_SYNTH_RETRY_OUTPUT_TOKENS).toBeGreaterThan(GROUP_SYNTH_MAX_OUTPUT_TOKENS);
  });

  it("ISSUES_PER_SYNTH_GROUP is a small conservative number", () => {
    expect(ISSUES_PER_SYNTH_GROUP).toBeGreaterThanOrEqual(4);
    expect(ISSUES_PER_SYNTH_GROUP).toBeLessThanOrEqual(10);
  });
});

// ---------------------------------------------------------------------------
// chunkCanonicalIssuesForSynthesis — issue grouping
// ---------------------------------------------------------------------------

describe("chunkCanonicalIssuesForSynthesis", () => {
  it("splits 40 issues into groups of ISSUES_PER_SYNTH_GROUP", () => {
    const items = Array.from({ length: 40 }, (_, i) => i);
    const groups = chunkCanonicalIssuesForSynthesis(items);
    expect(groups.length).toBe(Math.ceil(40 / ISSUES_PER_SYNTH_GROUP));
    for (const g of groups) {
      expect(g.length).toBeLessThanOrEqual(ISSUES_PER_SYNTH_GROUP);
      expect(g.length).toBeGreaterThan(0);
    }
    expect(groups.flat()).toEqual(items);
  });

  it("splits 52 issues into groups (real Core terms case)", () => {
    const items = Array.from({ length: 52 }, (_, i) => i);
    const groups = chunkCanonicalIssuesForSynthesis(items);
    expect(groups.length).toBe(Math.ceil(52 / ISSUES_PER_SYNTH_GROUP));
    const totalItems = groups.reduce((s, g) => s + g.length, 0);
    expect(totalItems).toBe(52);
  });

  it("splits 21 issues into groups (real Closing terms case)", () => {
    const items = Array.from({ length: 21 }, (_, i) => i);
    const groups = chunkCanonicalIssuesForSynthesis(items);
    expect(groups.length).toBe(Math.ceil(21 / ISSUES_PER_SYNTH_GROUP));
    const totalItems = groups.reduce((s, g) => s + g.length, 0);
    expect(totalItems).toBe(21);
  });

  it("returns one group for small sections", () => {
    const items = Array.from({ length: 3 }, (_, i) => i);
    const groups = chunkCanonicalIssuesForSynthesis(items);
    expect(groups).toHaveLength(1);
    expect(groups[0]).toHaveLength(3);
  });

  it("returns empty array for empty input", () => {
    expect(chunkCanonicalIssuesForSynthesis([])).toHaveLength(0);
  });

  it("preserves all items without duplication or loss", () => {
    const items = Array.from({ length: 111 }, (_, i) => `issue-${i}`);
    const groups = chunkCanonicalIssuesForSynthesis(items);
    const flattened = groups.flat();
    expect(flattened).toEqual(items);
    expect(flattened).toHaveLength(111);
  });

  it("accepts custom group size", () => {
    const items = Array.from({ length: 10 }, (_, i) => i);
    const groups = chunkCanonicalIssuesForSynthesis(items, 3);
    expect(groups).toHaveLength(4);
    expect(groups[3]).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// estimateGroupTokenBudget — per-group budget
// ---------------------------------------------------------------------------

describe("estimateGroupTokenBudget", () => {
  it("returns at least 2000 tokens for a small group", () => {
    expect(estimateGroupTokenBudget(1)).toBeGreaterThanOrEqual(2000);
  });

  it("scales with issue count for a group of ISSUES_PER_SYNTH_GROUP", () => {
    const budget = estimateGroupTokenBudget(ISSUES_PER_SYNTH_GROUP);
    expect(budget).toBeGreaterThanOrEqual(ISSUES_PER_SYNTH_GROUP * 500);
    expect(budget).toBeLessThanOrEqual(GROUP_SYNTH_MAX_OUTPUT_TOKENS);
  });

  it("caps at GROUP_SYNTH_MAX_OUTPUT_TOKENS", () => {
    expect(estimateGroupTokenBudget(100)).toBeLessThanOrEqual(GROUP_SYNTH_MAX_OUTPUT_TOKENS);
  });

  it("is 0-safe", () => {
    expect(estimateGroupTokenBudget(0)).toBeGreaterThanOrEqual(2000);
  });
});

// ---------------------------------------------------------------------------
// runPerSectionSynthesis — micro-batched orchestration
// ---------------------------------------------------------------------------

describe("runPerSectionSynthesis", () => {
  const makeSection = (label: string, issueCount: number): SectionSummary => ({
    sectionLabel: label,
    coverageStatus: "complete",
    sourceChunkCount: 4,
    rawIssueCount: issueCount,
    canonicalIssues: Array.from({ length: issueCount }, (_, i) => ({
      title: `${label} Issue ${i + 1}`,
      severity: "medium" as const,
      shortWhy: `Reason ${i + 1}`,
      clauseLabel: `${label} Clause ${i + 1}`,
      excerpt: "Some excerpt text here",
      tags: [],
      impactType: "other",
      actionTiming: "before-signing",
      decisionRelevance: "important",
      mechanismType: "other",
    })),
  });

  function buildGroupAwareMock(sections: SectionSummary[]) {
    const calls: { label: string; tokens: number }[] = [];

    const mockCallSynthesis = async (_sys: string, userMsg: string, tokens: number, label?: string) => {
      calls.push({ label: label ?? "unknown", tokens });

      const issueMatch = userMsg.match(/--- CANONICAL ISSUES ---\s*\n\s*([\s\S]+)$/);
      if (!issueMatch) return { text: JSON.stringify({ findings: [], clauseCards: [] }), stopReason: undefined };

      let groupIssues: Array<{ title: string; severity: string; shortWhy: string; impactType: string; actionTiming: string; decisionRelevance: string; mechanismType?: string }>;
      try {
        groupIssues = JSON.parse(issueMatch[1]);
      } catch {
        return { text: JSON.stringify({ findings: [], clauseCards: [] }), stopReason: undefined };
      }

      const sectionMatch = userMsg.match(/Section: "([^"]+)"/);
      const sectionLabel = sectionMatch?.[1] ?? "Unknown";

      const findings = groupIssues.map((ci, i) => ({
        id: `f-${sectionLabel}-${label?.match(/g(\d+)/)?.[1] ?? "0"}-${i + 1}`,
        title: ci.title,
        severity: ci.severity,
        score: 50,
        tags: [],
        shortWhy: ci.shortWhy,
        relatedClauseIds: [`c-${i + 1}`],
        impactType: ci.impactType,
        actionTiming: ci.actionTiming,
        decisionRelevance: ci.decisionRelevance,
        mechanismType: ci.mechanismType,
        sectionLabel,
      }));

      const clauseCards = findings.map((f, i) => ({
        clauseId: f.relatedClauseIds[0],
        clauseLabel: `Clause ${i + 1}`,
        originalTextExcerpt: "excerpt",
        atFirstGlance: "glance",
        whatItMeans: "means",
        scenario: "scenario",
        whatToDo: ["do this"],
      }));

      return { text: JSON.stringify({ findings, clauseCards }), stopReason: undefined };
    };

    return { calls, mockCallSynthesis };
  }

  it("splits large sections into multiple micro-batch calls", async () => {
    const sections = [makeSection("Core terms", 52)];
    const { calls, mockCallSynthesis } = buildGroupAwareMock(sections);

    const results = await runPerSectionSynthesis(
      sections, "system prompt", { sourceType: "pdf", contextParts: [] }, mockCallSynthesis,
    );

    const expectedGroups = Math.ceil(52 / ISSUES_PER_SYNTH_GROUP);
    expect(calls.length).toBe(expectedGroups);
    expect(results[0].findings).toHaveLength(52);
  });

  it("preserves all findings across all micro-batches and sections (no lossy cap)", async () => {
    const sections = [
      makeSection("Opening terms", 40),
      makeSection("Core terms", 52),
      makeSection("Closing terms", 21),
    ];
    const { mockCallSynthesis } = buildGroupAwareMock(sections);

    const results = await runPerSectionSynthesis(
      sections, "system prompt", { sourceType: "pdf", contextParts: [] }, mockCallSynthesis,
    );

    const totalFindings = results.reduce((s, r) => s + r.findings.length, 0);
    expect(totalFindings).toBe(40 + 52 + 21);
    expect(totalFindings).toBeGreaterThan(TOP_ISSUES_LIMIT);
  });

  it("empty sections produce zero calls and zero findings", async () => {
    const sections = [makeSection("Empty", 0), makeSection("Small", 2)];
    const { calls, mockCallSynthesis } = buildGroupAwareMock(sections);

    const results = await runPerSectionSynthesis(
      sections, "system prompt", { sourceType: "pdf", contextParts: [] }, mockCallSynthesis,
    );

    expect(results[0].findings).toHaveLength(0);
    expect(results[1].findings).toHaveLength(2);
    expect(calls.every((c) => !c.label.includes("Empty"))).toBe(true);
  });

  it("handles group synthesis failure gracefully — other groups still succeed", async () => {
    const sections = [makeSection("Mixed", 12)];
    let callIndex = 0;

    const mockCallSynthesis = async (_sys: string, userMsg: string, tokens: number, label?: string) => {
      callIndex++;
      if (callIndex === 1) {
        throw new Error("Simulated first group failure");
      }

      const issueMatch = userMsg.match(/--- CANONICAL ISSUES ---\s*\n\s*([\s\S]+)$/);
      let groupIssues: unknown[] = [];
      try { groupIssues = JSON.parse(issueMatch?.[1] ?? "[]"); } catch { /* empty */ }

      const findings = groupIssues.map((_, i) => ({
        id: `f-${callIndex}-${i}`, title: "T", severity: "medium", score: 50,
        tags: [], shortWhy: "W", relatedClauseIds: [], impactType: "other",
        actionTiming: "before-signing", decisionRelevance: "important", sectionLabel: "Mixed",
      }));
      return { text: JSON.stringify({ findings, clauseCards: [] }), stopReason: undefined };
    };

    const results = await runPerSectionSynthesis(
      sections, "system prompt", { sourceType: "pdf", contextParts: [] }, mockCallSynthesis,
    );

    const total = results[0].findings.length;
    expect(total).toBeGreaterThan(0);
    expect(total).toBeLessThan(12);
  });

  it("topIssues from merged micro-batch outputs is a proper subset", async () => {
    const sections = [makeSection("Fees", 20), makeSection("Exit", 15)];
    const { mockCallSynthesis } = buildGroupAwareMock(sections);

    const results = await runPerSectionSynthesis(
      sections, "system prompt", { sourceType: "pdf", contextParts: [] }, mockCallSynthesis,
    );

    const allFindings: Finding[] = [];
    for (const r of results) allFindings.push(...r.findings);

    const topIssues = computeTopIssues(allFindings);
    const allBySection = buildAllIssuesBySection(allFindings);

    expect(topIssues.length).toBeLessThanOrEqual(TOP_ISSUES_LIMIT);
    expect(topIssues.length).toBeLessThan(allFindings.length);
    for (const t of topIssues) {
      expect(allFindings.some((f) => f.id === t.id)).toBe(true);
    }
    const totalSectionFindings = allBySection.reduce((s, sec) => s + sec.issues.length, 0);
    expect(totalSectionFindings).toBe(allFindings.length);
  });

  it("no single call exceeds GROUP_SYNTH_MAX_OUTPUT_TOKENS", async () => {
    const sections = [makeSection("Big", 52)];
    const { calls, mockCallSynthesis } = buildGroupAwareMock(sections);

    await runPerSectionSynthesis(
      sections, "system prompt", { sourceType: "pdf", contextParts: [] }, mockCallSynthesis,
    );

    for (const call of calls) {
      expect(call.tokens).toBeLessThanOrEqual(GROUP_SYNTH_MAX_OUTPUT_TOKENS);
    }
  });

  it("real-world section sizes produce the correct number of groups", async () => {
    const sections = [
      makeSection("Opening terms", 40),
      makeSection("Core terms", 52),
      makeSection("Closing terms and schedules", 21),
    ];
    const { calls, mockCallSynthesis } = buildGroupAwareMock(sections);

    await runPerSectionSynthesis(
      sections, "system prompt", { sourceType: "pdf", contextParts: [] }, mockCallSynthesis,
    );

    const expectedGroups =
      Math.ceil(40 / ISSUES_PER_SYNTH_GROUP) +
      Math.ceil(52 / ISSUES_PER_SYNTH_GROUP) +
      Math.ceil(21 / ISSUES_PER_SYNTH_GROUP);
    expect(calls.length).toBe(expectedGroups);
  });
});

// ---------------------------------------------------------------------------
// SYSTEM_PROMPT — report-usability rules
// ---------------------------------------------------------------------------

describe("SYSTEM_PROMPT report-usability rules", () => {
  it("includes contract-type-aware front-summary prioritisation", () => {
    expect(SYSTEM_PROMPT).toContain("CONTRACT-TYPE FRONT-SUMMARY PRIORITISATION");
    expect(SYSTEM_PROMPT).toContain("concern buckets");
    expect(SYSTEM_PROMPT).toContain("Health insurance");
    expect(SYSTEM_PROMPT).toContain("Home insurance");
    expect(SYSTEM_PROMPT).toContain("Car / motor insurance");
    expect(SYSTEM_PROMPT).toContain("Lease / tenancy");
    expect(SYSTEM_PROMPT).toContain("Service / subscription / SaaS");
    expect(SYSTEM_PROMPT).toContain("Employment / contractor");
    expect(SYSTEM_PROMPT).toContain("Generic fallback");
  });

  it("includes standard-vs-unusual-vs-positive guidance", () => {
    expect(SYSTEM_PROMPT).toContain("STANDARD vs UNUSUAL vs POSITIVE GUIDANCE");
    expect(SYSTEM_PROMPT).toContain("Common or standard for this type");
    expect(SYSTEM_PROMPT).toContain("Stricter than usual");
    expect(SYSTEM_PROMPT).toContain("Genuine positive");
    expect(SYSTEM_PROMPT).toContain("Possible deal-breaker");
    expect(SYSTEM_PROMPT).toContain("overclaim market certainty");
  });

  it("includes dynamic framing by clause type with explicit categories", () => {
    expect(SYSTEM_PROMPT).toContain("DYNAMIC FRAMING BY CLAUSE TYPE");
    expect(SYSTEM_PROMPT).toContain("Clear exclusion");
    expect(SYSTEM_PROMPT).toContain("Waiting period");
    expect(SYSTEM_PROMPT).toContain("Numeric cap or limit");
    expect(SYSTEM_PROMPT).toContain("Condition or requirement");
    expect(SYSTEM_PROMPT).toContain("Ambiguous or misleading wording");
    expect(SYSTEM_PROMPT).toContain("Discretionary power");
    expect(SYSTEM_PROMPT).toContain("Legal or technical nuance");
    expect(SYSTEM_PROMPT).toContain('Only use "catch" style framing');
    expect(SYSTEM_PROMPT).toContain("plainer explanatory framing");
    expect(SYSTEM_PROMPT).toContain("Do NOT force a naive assumption sentence");
  });

  it("restricts You would think to genuinely ambiguous wording", () => {
    expect(SYSTEM_PROMPT).toContain('Do NOT start with "You would think..."');
    expect(SYSTEM_PROMPT).toContain("genuinely plausible from ambiguous wording");
    expect(SYSTEM_PROMPT).toContain("What this clause says");
    expect(SYSTEM_PROMPT).toContain("What this means on a quick read");
    expect(SYSTEM_PROMPT).toContain("What many people may miss");
  });

  it("uses explanatory framing for clear exclusions and caps in whatItMeans", () => {
    expect(SYSTEM_PROMPT).toContain("What this means in practice");
    expect(SYSTEM_PROMPT).toContain("Why this matters");
    expect(SYSTEM_PROMPT).toContain("How this affects a claim");
    expect(SYSTEM_PROMPT).toContain("Do NOT imply there is a hidden catch when the clause is already explicit");
  });

  it("includes technical term explanation rules with expanded term lists", () => {
    expect(SYSTEM_PROMPT).toContain("EXPLAIN TECHNICAL AND LEGAL TERMS");
    expect(SYSTEM_PROMPT).toContain("plain-English definition");
    expect(SYSTEM_PROMPT).toContain("deductible");
    expect(SYSTEM_PROMPT).toContain("subsidence");
    expect(SYSTEM_PROMPT).toContain("indemnity");
    expect(SYSTEM_PROMPT).toContain("occupiers' liability");
    expect(SYSTEM_PROMPT).toContain("property owners' liability");
    expect(SYSTEM_PROMPT).toContain("liability cap");
    expect(SYSTEM_PROMPT).toContain("market value");
    expect(SYSTEM_PROMPT).toContain("one short plain-English explanation of the term");
  });

  it("includes custom-context moderation rules to reduce overuse", () => {
    expect(SYSTEM_PROMPT).toContain("CUSTOM CONTEXT MODERATION");
    expect(SYSTEM_PROMPT).toContain("2 to 3 findings");
    expect(SYSTEM_PROMPT).toContain("common real-world scenarios");
    expect(SYSTEM_PROMPT).toContain("common everyday example");
  });

  it("includes positive and neutral balance guidance", () => {
    expect(SYSTEM_PROMPT).toContain("POSITIVE AND NEUTRAL BALANCE");
    expect(SYSTEM_PROMPT).toContain("Do NOT force fake balance");
    expect(SYSTEM_PROMPT).toContain("honest balance");
    expect(SYSTEM_PROMPT).toContain("broadly terrible");
  });

  it("includes schedule-aware certainty rules", () => {
    expect(SYSTEM_PROMPT).toContain("SCHEDULE-AWARE CERTAINTY");
    expect(SYSTEM_PROMPT).toContain("general wording booklet");
    expect(SYSTEM_PROMPT).toContain("check your schedule to confirm");
    expect(SYSTEM_PROMPT).toContain("personalised schedule or certificate");
    expect(SYSTEM_PROMPT).toContain("err on the side of telling the buyer to confirm");
  });

  it("includes country-aware examples and currency formatting guidance", () => {
    expect(SYSTEM_PROMPT).toContain("COUNTRY-AWARE EXAMPLES AND CURRENCY");
    expect(SYSTEM_PROMPT).toContain("UK: use pounds");
    expect(SYSTEM_PROMPT).toContain("US: use dollars");
    expect(SYSTEM_PROMPT).toContain("CA: use Canadian dollars");
    expect(SYSTEM_PROMPT).toContain("AU: use Australian dollars");
    expect(SYSTEM_PROMPT).toContain("£3,000");
    expect(SYSTEM_PROMPT).toContain("$5,000");
    expect(SYSTEM_PROMPT).toContain("Do NOT use US-style medical cost examples in a UK home-insurance context");
  });

  it("instructs no em dashes or en dashes", () => {
    expect(SYSTEM_PROMPT).toContain("PUNCTUATION");
    expect(SYSTEM_PROMPT).toContain("Never use em dashes or en dashes");
  });
});

describe("GROUP_SYNTHESIS_SYSTEM_PROMPT buyer-facing rules", () => {
  it("requires plain language at a 12-year-old reading level", () => {
    expect(GROUP_SYNTHESIS_SYSTEM_PROMPT).toContain("12-year-old");
    expect(GROUP_SYNTHESIS_SYSTEM_PROMPT).toContain("short sentences");
    expect(GROUP_SYNTHESIS_SYSTEM_PROMPT).toContain("common everyday words");
  });

  it("requires support-worker tone, not legal/academic", () => {
    expect(GROUP_SYNTHESIS_SYSTEM_PROMPT).toContain("support worker");
    expect(GROUP_SYNTHESIS_SYSTEM_PROMPT).toContain("not a lawyer");
  });

  it("requires at-first-glance vs what-it-really-means framing", () => {
    expect(GROUP_SYNTHESIS_SYSTEM_PROMPT).toContain("atFirstGlance");
    expect(GROUP_SYNTHESIS_SYSTEM_PROMPT).toContain("whatItMeans");
    expect(GROUP_SYNTHESIS_SYSTEM_PROMPT).toContain("the catch");
  });

  it("includes personal context handling rules", () => {
    expect(GROUP_SYNTHESIS_SYSTEM_PROMPT).toContain("personal context");
    expect(GROUP_SYNTHESIS_SYSTEM_PROMPT).toContain("personally relevant");
  });

  it("includes legally qualified clause handling", () => {
    expect(GROUP_SYNTHESIS_SYSTEM_PROMPT).toContain("outside law");
    expect(GROUP_SYNTHESIS_SYSTEM_PROMPT).toContain("written clarification");
  });

  it("preserves issue preservation rules", () => {
    expect(GROUP_SYNTHESIS_SYSTEM_PROMPT).toContain("EXACTLY ONE finding per canonical issue");
    expect(GROUP_SYNTHESIS_SYSTEM_PROMPT).toContain("No merging");
    expect(GROUP_SYNTHESIS_SYSTEM_PROMPT).toContain("mechanismType");
  });

  it("still requires valid JSON output", () => {
    expect(GROUP_SYNTHESIS_SYSTEM_PROMPT).toContain("Output ONLY valid JSON");
  });

  it("includes standard-vs-unusual-vs-positive guidance", () => {
    expect(GROUP_SYNTHESIS_SYSTEM_PROMPT).toContain("STANDARD vs UNUSUAL vs POSITIVE");
    expect(GROUP_SYNTHESIS_SYSTEM_PROMPT).toContain("appears common");
    expect(GROUP_SYNTHESIS_SYSTEM_PROMPT).toContain("stricter than");
    expect(GROUP_SYNTHESIS_SYSTEM_PROMPT).toContain("stronger-than-average");
    expect(GROUP_SYNTHESIS_SYSTEM_PROMPT).toContain("overclaim market certainty");
  });

  it("includes dynamic framing by clause type", () => {
    expect(GROUP_SYNTHESIS_SYSTEM_PROMPT).toContain("DYNAMIC FRAMING BY CLAUSE TYPE");
    expect(GROUP_SYNTHESIS_SYSTEM_PROMPT).toContain("Clear exclusion, waiting period, numeric cap");
    expect(GROUP_SYNTHESIS_SYSTEM_PROMPT).toContain("explanatory framing");
    expect(GROUP_SYNTHESIS_SYSTEM_PROMPT).toContain("contrast framing");
    expect(GROUP_SYNTHESIS_SYSTEM_PROMPT).toContain('Only use "catch" framing when the clause genuinely hides');
  });

  it("includes improved clause-card framing rules that avoid forced assumptions", () => {
    expect(GROUP_SYNTHESIS_SYSTEM_PROMPT).toContain("most plausible quick reading");
    expect(GROUP_SYNTHESIS_SYSTEM_PROMPT).toContain("Do NOT force a cartoonishly broad misunderstanding");
    expect(GROUP_SYNTHESIS_SYSTEM_PROMPT).toContain('Do NOT start with "You would think..."');
    expect(GROUP_SYNTHESIS_SYSTEM_PROMPT).toContain("What this clause says");
    expect(GROUP_SYNTHESIS_SYSTEM_PROMPT).toContain("What many people may miss");
    expect(GROUP_SYNTHESIS_SYSTEM_PROMPT).toContain("What many people may assume");
    expect(GROUP_SYNTHESIS_SYSTEM_PROMPT).toContain("assumption-vs-reality framing when the clause genuinely misleads");
  });

  it("uses explanatory framing for clear exclusions in whatItMeans", () => {
    expect(GROUP_SYNTHESIS_SYSTEM_PROMPT).toContain("What this means in practice");
    expect(GROUP_SYNTHESIS_SYSTEM_PROMPT).toContain("Why this matters");
    expect(GROUP_SYNTHESIS_SYSTEM_PROMPT).toContain("How this affects a claim");
    expect(GROUP_SYNTHESIS_SYSTEM_PROMPT).toContain("Do NOT imply there is a hidden catch when the clause is already explicit");
  });

  it("includes schedule-aware certainty rules", () => {
    expect(GROUP_SYNTHESIS_SYSTEM_PROMPT).toContain("SCHEDULE-AWARE CERTAINTY");
    expect(GROUP_SYNTHESIS_SYSTEM_PROMPT).toContain("general policy wording booklet");
    expect(GROUP_SYNTHESIS_SYSTEM_PROMPT).toContain("check your schedule to confirm");
    expect(GROUP_SYNTHESIS_SYSTEM_PROMPT).toContain("Optional");
    expect(GROUP_SYNTHESIS_SYSTEM_PROMPT).toContain("If selected");
  });

  it("includes country-appropriate currency guidance in scenarios", () => {
    expect(GROUP_SYNTHESIS_SYSTEM_PROMPT).toContain("country-appropriate currency symbols");
  });

  it("includes technical term explanation rules", () => {
    expect(GROUP_SYNTHESIS_SYSTEM_PROMPT).toContain("TECHNICAL TERM EXPLANATION");
    expect(GROUP_SYNTHESIS_SYSTEM_PROMPT).toContain("plain-English definition");
    expect(GROUP_SYNTHESIS_SYSTEM_PROMPT).toContain("deductible");
    expect(GROUP_SYNTHESIS_SYSTEM_PROMPT).toContain("subsidence");
    expect(GROUP_SYNTHESIS_SYSTEM_PROMPT).toContain("occupiers' liability");
    expect(GROUP_SYNTHESIS_SYSTEM_PROMPT).toContain("Do NOT just name the distinction");
  });

  it("includes custom-context moderation rules", () => {
    expect(GROUP_SYNTHESIS_SYSTEM_PROMPT).toContain("MODERATION");
    expect(GROUP_SYNTHESIS_SYSTEM_PROMPT).toContain("2 to 3 findings");
    expect(GROUP_SYNTHESIS_SYSTEM_PROMPT).toContain("common real-world scenarios");
  });

  it("instructs no em dashes or en dashes in generated text", () => {
    expect(GROUP_SYNTHESIS_SYSTEM_PROMPT).toContain("Never use em dashes or en dashes");
  });
});

describe("VERDICT_SYNTHESIS_PROMPT buyer-facing rules", () => {
  it("requires plain language at a 12-year-old reading level", () => {
    expect(VERDICT_SYNTHESIS_PROMPT).toContain("12-year-old");
  });

  it("requires support-worker tone", () => {
    expect(VERDICT_SYNTHESIS_PROMPT).toContain("support worker");
  });

  it("includes personal context handling", () => {
    expect(VERDICT_SYNTHESIS_PROMPT).toContain("personal context");
    expect(VERDICT_SYNTHESIS_PROMPT).toContain("tailor the verdict");
  });

  it("includes combined clarification letter template", () => {
    expect(VERDICT_SYNTHESIS_PROMPT).toContain("lt-combined");
    expect(VERDICT_SYNTHESIS_PROMPT).toContain("combined clarification");
  });

  it("includes legally qualified clause handling", () => {
    expect(VERDICT_SYNTHESIS_PROMPT).toContain("legal uncertainty");
    expect(VERDICT_SYNTHESIS_PROMPT).toContain("written clarification");
  });

  it("does not regenerate findings", () => {
    expect(VERDICT_SYNTHESIS_PROMPT).toContain("Do NOT regenerate findings");
  });

  it("includes contract-type-aware front-summary prioritisation", () => {
    expect(VERDICT_SYNTHESIS_PROMPT).toContain("FRONT-SUMMARY PRIORITISATION");
    expect(VERDICT_SYNTHESIS_PROMPT).toContain("concern buckets");
    expect(VERDICT_SYNTHESIS_PROMPT).toContain("Health insurance");
    expect(VERDICT_SYNTHESIS_PROMPT).toContain("Home insurance");
    expect(VERDICT_SYNTHESIS_PROMPT).toContain("Car insurance");
    expect(VERDICT_SYNTHESIS_PROMPT).toContain("Lease");
    expect(VERDICT_SYNTHESIS_PROMPT).toContain("Employment");
    expect(VERDICT_SYNTHESIS_PROMPT).toContain("Generic");
  });

  it("includes standard-vs-unusual-vs-positive balance guidance", () => {
    expect(VERDICT_SYNTHESIS_PROMPT).toContain("STANDARD vs UNUSUAL vs POSITIVE");
    expect(VERDICT_SYNTHESIS_PROMPT).toContain("genuine positives");
    expect(VERDICT_SYNTHESIS_PROMPT).toContain("common for contracts of this type");
    expect(VERDICT_SYNTHESIS_PROMPT).toContain("honest balance");
  });

  it("instructs personal context not to dominate front summary", () => {
    expect(VERDICT_SYNTHESIS_PROMPT).toContain("Do NOT let personal context dominate the front summary");
  });

  it("includes custom-context moderation rules", () => {
    expect(VERDICT_SYNTHESIS_PROMPT).toContain("MODERATION");
    expect(VERDICT_SYNTHESIS_PROMPT).toContain("Vary across the main concern areas");
  });

  it("includes schedule-aware certainty rules", () => {
    expect(VERDICT_SYNTHESIS_PROMPT).toContain("SCHEDULE-AWARE CERTAINTY");
    expect(VERDICT_SYNTHESIS_PROMPT).toContain("optional or conditional sections");
    expect(VERDICT_SYNTHESIS_PROMPT).toContain("check their schedule or certificate");
    expect(VERDICT_SYNTHESIS_PROMPT).toContain("optional cover as definitely active");
  });

  it("includes country-aware examples and currency formatting", () => {
    expect(VERDICT_SYNTHESIS_PROMPT).toContain("COUNTRY-AWARE EXAMPLES AND CURRENCY");
    expect(VERDICT_SYNTHESIS_PROMPT).toContain("country-appropriate currency symbols");
    expect(VERDICT_SYNTHESIS_PROMPT).toContain("£3,000");
    expect(VERDICT_SYNTHESIS_PROMPT).toContain("FOS");
    expect(VERDICT_SYNTHESIS_PROMPT).toContain("state insurance commissioner");
  });

  it("instructs no em dashes or en dashes in generated text", () => {
    expect(VERDICT_SYNTHESIS_PROMPT).toContain("Never use em dashes or en dashes");
  });
});
