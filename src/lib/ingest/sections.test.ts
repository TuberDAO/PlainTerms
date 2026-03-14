import { describe, it, expect } from "vitest";
import { detectSections } from "./sections";

describe("detectSections", () => {
  it("returns a single section for a 1-chunk document", () => {
    const result = detectSections(["Hello world, some contract text."]);
    expect(result).toHaveLength(1);
    expect(result[0].label).toBe("Full document");
    expect(result[0].chunkIndices).toEqual([0]);
  });

  it("detects ALL CAPS headings across chunks", () => {
    const chunks = [
      "DEFINITIONS\nThis agreement defines the following terms...",
      "Some filler text about the contract preamble and background.",
      "COVERAGE AND BENEFITS\nThe insurer will cover the following...",
      "Additional coverage details go here for subscribers.",
      "EXCLUSIONS\nThe following conditions are not covered...",
      "Further exclusion details and fine print.",
    ];
    const result = detectSections(chunks);
    expect(result.length).toBeGreaterThanOrEqual(3);

    const labels = result.map((s) => s.label.toLowerCase());
    expect(labels.some((l) => l.includes("definitions"))).toBe(true);
    expect(labels.some((l) => l.includes("coverage"))).toBe(true);
    expect(labels.some((l) => l.includes("exclusions"))).toBe(true);
  });

  it("detects numbered section headings", () => {
    const chunks = [
      "Introduction to the terms.",
      "Section 1 Definitions\nKey terms used throughout...",
      "Section 2 Coverage\nThis policy covers...",
      "Section 3 Exclusions\nThe following are excluded...",
    ];
    const result = detectSections(chunks);
    expect(result.length).toBeGreaterThanOrEqual(3);
  });

  it("creates a preamble section for chunks before the first heading", () => {
    const chunks = [
      "Welcome to our service. This document explains your rights.",
      "TERMS AND CONDITIONS\nBy using our service, you agree...",
      "More terms detail here.",
      "CANCELLATION\nYou may cancel at any time...",
    ];
    const result = detectSections(chunks);
    const labels = result.map((s) => s.label);
    expect(labels[0]).toContain("Preamble");
  });

  it("falls back to position-based sections when no headings found", () => {
    const chunks = Array.from({ length: 12 }, (_, i) =>
      `Paragraph ${i + 1} of the contract with various details about terms and conditions.`,
    );
    const result = detectSections(chunks);
    expect(result.length).toBeGreaterThanOrEqual(2);
    expect(result.length).toBeLessThanOrEqual(4);

    const allIndices = result.flatMap((s) => s.chunkIndices);
    expect(new Set(allIndices).size).toBe(12);
  });

  it("assigns all chunk indices without gaps or duplicates", () => {
    const chunks = [
      "DEFINITIONS\nTerms defined here.",
      "More definitions continue.",
      "COVERAGE\nCoverage details.",
      "EXCLUSIONS\nExclusion details.",
      "CLAIMS\nHow to file a claim.",
      "GENERAL PROVISIONS\nMiscellaneous clauses.",
    ];
    const result = detectSections(chunks);
    const allIndices = result.flatMap((s) => s.chunkIndices).sort((a, b) => a - b);
    expect(allIndices).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it("handles known contract section names case-insensitively", () => {
    const chunks = [
      "definitions\nSome terms...",
      "Cancellation\nYou may cancel...",
      "privacy\nWe respect your privacy...",
    ];
    const result = detectSections(chunks);
    expect(result.length).toBeGreaterThanOrEqual(2);
  });

  it("merges tiny single-chunk sections when adjacent", () => {
    const chunks = [
      "SECTION A\nShort section A.",
      "SECTION B\nShort section B.",
      "SECTION C\nLonger section C with more content.",
      "Continuation of section C.",
      "Continuation of section C.",
    ];
    const result = detectSections(chunks);
    const totalChunks = result.reduce((s, sec) => s + sec.chunkIndices.length, 0);
    expect(totalChunks).toBe(5);
  });
});
