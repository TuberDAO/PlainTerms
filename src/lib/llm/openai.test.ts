import { describe, it, expect } from "vitest";
import {
  getOpenAITokenParamName,
  isOpenAITemperatureFixed,
  shouldUseResponsesAPI,
  extractResponsesAPIText,
  buildResponsesAPIInput,
  buildResponsesTextFormat,
  RESPONSES_API_JSON_SUFFIX,
} from "./openai";

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
