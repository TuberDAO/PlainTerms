import { isTransientTransportError } from "@/lib/llm/anthropic";

export type AnalysisErrorApiResult = {
  message: string;
  code: string;
  status: number;
};

/**
 * Maps LLM/analysis failures to user-facing API error payloads.
 * Used by POST /api/report/generate and covered by unit tests.
 */
export function analysisErrorToApiResult(
  err: unknown,
): AnalysisErrorApiResult | null {
  const rec = err as Record<string, unknown>;
  const code = rec?.code;
  const userMessage =
    typeof rec?.userMessage === "string" ? rec.userMessage : undefined;

  if (code === "TRUNCATED_OUTPUT") {
    return {
      message:
        "This document produced a very large analysis that could not be completed in one pass. " +
        "Try selecting a specific contract type or reducing the document length.",
      code: "TRUNCATED_OUTPUT",
      status: 500,
    };
  }

  if (userMessage) {
    return {
      message: userMessage,
      code: typeof code === "string" ? code : "ANALYSIS_FAILED",
      status: 500,
    };
  }

  if (isTransientTransportError(err)) {
    return {
      message:
        "This document took too long to review in one pass. Please try again.",
      code: "ANALYSIS_TIMEOUT",
      status: 500,
    };
  }

  return null;
}
