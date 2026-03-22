import { describe, it, expect } from "vitest";
import {
  shouldUseLargeDocPipeline,
  LARGE_DOC_THRESHOLD_CHARS,
  LARGE_DOC_NEAR_THRESHOLD_CHARS,
  LARGE_DOC_HIGH_CHUNK_COUNT,
  LARGE_DOC_MIN_CHARS_FOR_CHUNK_RULE,
} from "./large-doc-routing";

describe("shouldUseLargeDocPipeline", () => {
  it("routes the live near-threshold case (146k chars, 13 chunks) to large-doc", () => {
    expect(shouldUseLargeDocPipeline(146_065, 13)).toBe(true);
  });

  it("routes at and above the primary char threshold", () => {
    expect(shouldUseLargeDocPipeline(LARGE_DOC_THRESHOLD_CHARS, 1)).toBe(true);
    expect(shouldUseLargeDocPipeline(LARGE_DOC_THRESHOLD_CHARS + 1, 1)).toBe(
      true,
    );
  });

  it("routes near-threshold char counts even with few chunks", () => {
    expect(
      shouldUseLargeDocPipeline(LARGE_DOC_NEAR_THRESHOLD_CHARS, 2),
    ).toBe(true);
  });

  it("routes high chunk counts when the document is still below the primary threshold", () => {
    expect(
      shouldUseLargeDocPipeline(
        LARGE_DOC_MIN_CHARS_FOR_CHUNK_RULE,
        LARGE_DOC_HIGH_CHUNK_COUNT,
      ),
    ).toBe(true);
    expect(
      shouldUseLargeDocPipeline(
        LARGE_DOC_MIN_CHARS_FOR_CHUNK_RULE - 1,
        LARGE_DOC_HIGH_CHUNK_COUNT,
      ),
    ).toBe(false);
  });

  it("keeps typical short documents on the single-pass path", () => {
    expect(shouldUseLargeDocPipeline(80_000, 5)).toBe(false);
    expect(shouldUseLargeDocPipeline(50_000, 12)).toBe(false);
  });
});
