import { describe, it, expect } from "vitest";
import { detectInvention } from "./simplify";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Assert that at least one issue matches a substring. */
function hasIssue(issues: string[], fragment: string): boolean {
  return issues.some((i) => i.toLowerCase().includes(fragment.toLowerCase()));
}

// ---------------------------------------------------------------------------
// "for example" drift
// ---------------------------------------------------------------------------

describe("detectInvention — for example / e.g. drift", () => {
  it("flags 'for example' added by simplification", () => {
    const issues = detectInvention(
      "If you cancel, you will be charged a fee.",
      "If you cancel, you will be charged a fee. For example, this could be £49.",
    );
    expect(hasIssue(issues, "for example")).toBe(true);
  });

  it("flags 'e.g.' added by simplification", () => {
    const issues = detectInvention(
      "Certain services require authorisation.",
      "Some services need approval first (e.g. specialist referrals).",
    );
    expect(hasIssue(issues, "for example")).toBe(true);
  });

  it("does NOT flag 'for example' already present in original", () => {
    const issues = detectInvention(
      "For example, you could owe a £50 fee.",
      "For example, you may have to pay £50.",
    );
    expect(hasIssue(issues, "for example")).toBe(false);
  });

  it("does NOT flag clean simplification with no examples", () => {
    const issues = detectInvention(
      "The deductible applies before coverage begins.",
      "You pay first before the insurance pays anything.",
    );
    expect(issues).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// "such as" drift
// ---------------------------------------------------------------------------

describe("detectInvention — such as elaboration", () => {
  it("flags 'such as' added by simplification", () => {
    const issues = detectInvention(
      "You may be charged additional fees.",
      "You may be charged additional fees, such as late payment or admin charges.",
    );
    expect(hasIssue(issues, "such as")).toBe(true);
  });

  it("does NOT flag 'such as' already in the original", () => {
    const issues = detectInvention(
      "Additional fees, such as late payment charges, may apply.",
      "Extra fees, such as late charges, can be added.",
    );
    expect(hasIssue(issues, "such as")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// New numbers added
// ---------------------------------------------------------------------------

describe("detectInvention — new numbers", () => {
  it("flags a specific amount added that was not in the original", () => {
    const issues = detectInvention(
      "You will be charged a cancellation fee.",
      "You will be charged a cancellation fee of £49.",
    );
    expect(hasIssue(issues, "number")).toBe(true);
  });

  it("flags a percentage added that was not in the original", () => {
    const issues = detectInvention(
      "A coinsurance charge applies after the deductible.",
      "A 40% coinsurance charge applies after the deductible.",
    );
    expect(hasIssue(issues, "number")).toBe(true);
  });

  it("flags a year added that was not in the original", () => {
    const issues = detectInvention(
      "Benefits stop after the monitoring period ends.",
      "Benefits stop after 12 months.",
    );
    expect(hasIssue(issues, "number")).toBe(true);
  });

  it("does NOT flag numbers that were already in the original", () => {
    const issues = detectInvention(
      "You will be charged £49 on cancellation.",
      "You pay £49 if you cancel.",
    );
    expect(hasIssue(issues, "number")).toBe(false);
  });

  it("does NOT flag numbers that are the same in both texts", () => {
    const issues = detectInvention(
      "A 40% coinsurance rate applies out-of-network.",
      "You pay 40% of the cost when you go out-of-network.",
    );
    expect(hasIssue(issues, "number")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Length ratio
// ---------------------------------------------------------------------------

describe("detectInvention — output length", () => {
  it("flags output substantially longer than input", () => {
    const shortInput = "The fee is non-refundable.";
    const longOutput =
      "This means you cannot get your money back once the fee has been charged. " +
      "The company will keep the fee even if you cancel early or have a complaint. " +
      "There is no way to dispute this charge under the terms of this agreement. " +
      "You should keep this in mind before you decide to sign up.";
    const issues = detectInvention(shortInput, longOutput);
    expect(hasIssue(issues, "longer")).toBe(true);
  });

  it("does NOT flag output that is shorter than input", () => {
    const longInput =
      "The indemnification clause requires the subscriber to hold harmless " +
      "the provider for all consequential damages arising from any cause.";
    const shortOutput = "You agree to protect the company from costs caused by your actions.";
    const issues = detectInvention(longInput, shortOutput);
    expect(hasIssue(issues, "longer")).toBe(false);
  });

  it("does NOT flag output at roughly the same length as input", () => {
    const input = "Coverage stops after 12 months from when we first pay a benefit for that condition.";
    const output = "We stop paying after 12 months from when your first claim is paid.";
    const issues = detectInvention(input, output);
    expect(hasIssue(issues, "longer")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Caveats preserved (no invention but checking we do not flag clean rewrites)
// ---------------------------------------------------------------------------

describe("detectInvention — clean rewrites pass through", () => {
  it("returns no issues for a jargon simplification with no additions", () => {
    const issues = detectInvention(
      "Actual cash value is determined as the replacement cost at the time of loss, less depreciation.",
      "We pay what it would cost to replace the item, minus how much value it has lost over time.",
    );
    expect(issues).toHaveLength(0);
  });

  it("returns no issues for a sentence split with no new content", () => {
    const issues = detectInvention(
      "Prior authorisation does not guarantee payment; all claims remain subject to medical necessity review.",
      "Getting prior authorisation does not mean we will definitely pay. We still review each claim to check medical necessity.",
    );
    expect(issues).toHaveLength(0);
  });

  it("returns no issues when caveats from original are preserved verbatim", () => {
    const issues = detectInvention(
      "Coverage may be denied if the condition is considered pre-existing.",
      "We may refuse to cover the condition if it counts as pre-existing.",
    );
    expect(issues).toHaveLength(0);
  });

  it("returns no issues for a UK PMI chronic-condition simplified rewrite", () => {
    const input =
      "We will pay for eligible treatment of a chronic condition for a maximum period " +
      "of 12 months from the date we first pay a benefit for that condition. After this " +
      "12-month period, no further benefits will be payable for that condition under this policy.";
    const simplified =
      "We will pay for treatment of a long-term condition for up to 12 months from when we first " +
      "paid. After that 12 months, we will not pay for that condition again under this policy.";
    const issues = detectInvention(input, simplified);
    expect(issues).toHaveLength(0);
  });
});
