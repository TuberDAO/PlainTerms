import { describe, it, expect } from "vitest";
import { checkDocumentRelevance } from "./relevance-check";

describe("checkDocumentRelevance", () => {
  it("returns relevant=true for text with contract keywords", () => {
    const chunks = [
      "This Agreement is entered into between the parties. " +
        "The policy provides coverage for the insured. " +
        "Cancellation requires 30 days written notice. " +
        "Liability is limited to the premium paid. " +
        "Claims must be filed within 60 days. " +
        "Benefits are subject to exclusions described herein.",
    ];
    const result = checkDocumentRelevance(chunks);
    expect(result.relevant).toBe(true);
    expect(result.distinctKeywordsFound).toBeGreaterThanOrEqual(3);
  });

  it("returns relevant=true for insurance policy text", () => {
    const chunks = [
      "Schedule of Benefits. " +
        "The insurer will pay the policyholder for covered claims. " +
        "Co-payment of 20% applies. Deductible is $500 per year. " +
        "Pre-existing conditions are excluded for the first 12 months. " +
        "Prior authorization is required for elective procedures.",
    ];
    const result = checkDocumentRelevance(chunks);
    expect(result.relevant).toBe(true);
  });

  it("returns relevant=true for terms and conditions", () => {
    const chunks = [
      "Terms and Conditions. By using this service you agree to be bound by these terms. " +
        "Billing will occur monthly. Cancellation fees may apply. " +
        "The warranty does not cover damage from misuse.",
    ];
    const result = checkDocumentRelevance(chunks);
    expect(result.relevant).toBe(true);
  });

  it("returns relevant=false for a novel/fiction text", () => {
    const chunks = [
      "The sun was setting over the rolling hills as Sarah walked along the dusty road. " +
        "She thought about her childhood and the summers spent at the lake. " +
        "The birds sang in the trees and the wind rustled the leaves. " +
        "Her dog ran ahead, chasing butterflies through the meadow. " +
        "Tomorrow she would visit her grandmother in the old stone cottage. " +
        "The garden was full of roses and the air smelled sweet. " +
        "She remembered the stories her grandfather told about the war. " +
        "The evening star appeared above the horizon.",
    ];
    const result = checkDocumentRelevance(chunks);
    expect(result.relevant).toBe(false);
    expect(result.distinctKeywordsFound).toBeLessThan(3);
  });

  it("returns relevant=false for a research paper", () => {
    const chunks = [
      "Abstract: This paper investigates the effects of temperature on enzyme activity. " +
        "Methods: We collected samples from three different environments. " +
        "Results: The catalytic rate increased by 15% at higher temperatures. " +
        "Discussion: These findings are consistent with previous research. " +
        "Conclusion: Temperature plays a significant role in enzymatic processes.",
    ];
    const result = checkDocumentRelevance(chunks);
    expect(result.relevant).toBe(false);
  });

  it("returns relevant=true for borderline documents with some legal language", () => {
    const chunks = [
      "This document outlines the agreement between landlord and tenant. " +
        "The tenant shall pay rent monthly. The landlord is responsible for repairs. " +
        "Notice of termination must be given 30 days in advance.",
    ];
    const result = checkDocumentRelevance(chunks);
    expect(result.relevant).toBe(true);
  });

  it("handles empty chunks", () => {
    const result = checkDocumentRelevance([]);
    expect(result.relevant).toBe(false);
  });

  it("handles a single very short chunk", () => {
    const result = checkDocumentRelevance(["Hello world."]);
    expect(result.relevant).toBe(false);
  });

  it("scans only the first ~50K characters for performance", () => {
    const longChunk =
      "This agreement covers liability and cancellation. " +
      "Other text. ".repeat(10_000);
    const result = checkDocumentRelevance([longChunk]);
    expect(result.relevant).toBe(true);
    expect(result.distinctKeywordsFound).toBeGreaterThanOrEqual(3);
  });
});
