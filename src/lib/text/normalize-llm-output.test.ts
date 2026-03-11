import { describe, it, expect } from "vitest";
import { normalizeLlmOutput } from "./normalize-llm-output";

describe("normalizeLlmOutput", () => {
  it("returns empty string unchanged", () => {
    expect(normalizeLlmOutput("")).toBe("");
  });

  it("passes clean text through unchanged", () => {
    expect(normalizeLlmOutput("Hello world.")).toBe("Hello world.");
  });

  it("fixes common mojibake apostrophe (â€™ -> ')", () => {
    expect(normalizeLlmOutput("you\u00e2\u0080\u0099re fine")).toBe(
      "you're fine",
    );
  });

  it("normalizes smart quotes to straight quotes", () => {
    expect(normalizeLlmOutput("\u201CHello\u201D")).toBe('"Hello"');
  });

  it("normalizes smart apostrophes to straight", () => {
    expect(normalizeLlmOutput("it\u2019s")).toBe("it's");
  });

  it("replaces en-dash and em-dash unicode", () => {
    expect(normalizeLlmOutput("a\u2013b\u2014c")).toBe("a\u2013b\u2014c");
  });

  it("removes stray Â before non-breaking space", () => {
    expect(normalizeLlmOutput("hello\u00c2\u00a0world")).toBe("hello world");
  });

  it("collapses repeated whitespace", () => {
    expect(normalizeLlmOutput("too   many    spaces")).toBe(
      "too many spaces",
    );
  });

  it("preserves paragraph breaks but collapses triple+ newlines", () => {
    expect(normalizeLlmOutput("para1\n\n\n\npara2")).toBe("para1\n\npara2");
  });

  it("trims leading and trailing whitespace", () => {
    expect(normalizeLlmOutput("  hello  ")).toBe("hello");
  });

  it("replaces non-breaking space with normal space", () => {
    expect(normalizeLlmOutput("no\u00A0break")).toBe("no break");
  });

  it("replaces ellipsis character", () => {
    expect(normalizeLlmOutput("wait\u2026")).toBe("wait...");
  });

  it("handles a realistic mojibake string", () => {
    const input = "Clause 4 imposes a \u00c2£49.99 fee \u00e2\u0080\u0093 you\u00e2\u0080\u0099d pay to leave.";
    const result = normalizeLlmOutput(input);
    expect(result).toContain("'d pay");
    expect(result).not.toContain("\u00e2");
    expect(result).not.toContain("\u00c2");
  });
});
