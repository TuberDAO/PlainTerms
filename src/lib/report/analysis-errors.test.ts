import { describe, it, expect } from "vitest";
import { analysisErrorToApiResult } from "./analysis-errors";

describe("analysisErrorToApiResult", () => {
  it("returns truncated-output copy with code TRUNCATED_OUTPUT", () => {
    const err = new Error("parse failed");
    (err as unknown as Record<string, unknown>).code = "TRUNCATED_OUTPUT";
    const r = analysisErrorToApiResult(err);
    expect(r?.code).toBe("TRUNCATED_OUTPUT");
    expect(r?.message).toContain("one pass");
    expect(r?.message).not.toMatch(/\u2014|\u2013/);
  });

  it("prefers userMessage from the error when present", () => {
    const err = new Error("upstream");
    (err as unknown as Record<string, unknown>).code =
      "ANALYSIS_TIMEOUT_FALLBACK_FAILED";
    (err as unknown as Record<string, unknown>).userMessage =
      "We switched to a slower, section by section review, but it still did not finish. Please try again in a little while.";
    const r = analysisErrorToApiResult(err);
    expect(r?.message).toContain("section by section");
    expect(r?.code).toBe("ANALYSIS_TIMEOUT_FALLBACK_FAILED");
  });

  it("maps AbortError to timeout user copy", () => {
    const err = new Error("Aborted");
    err.name = "AbortError";
    const r = analysisErrorToApiResult(err);
    expect(r?.code).toBe("ANALYSIS_TIMEOUT");
    expect(r?.message).toBe(
      "This document took too long to review in one pass. Please try again.",
    );
  });

  it("returns null for unrelated errors", () => {
    const err = new Error("Something else broke");
    expect(analysisErrorToApiResult(err)).toBeNull();
  });
});
