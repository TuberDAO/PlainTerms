import { describe, it, expect } from "vitest";
import { resolveContractPolicy } from "./contract-family-policy";

describe("resolveContractPolicy", () => {
  // -----------------------------------------------------------------------
  // A. Mass-market retail consumer
  // -----------------------------------------------------------------------

  it("telecom family → consumer-retail, non-negotiable", () => {
    const p = resolveContractPolicy("telecom");
    expect(p.adviceMode).toBe("consumer-retail");
    expect(p.negotiabilityClass).toBe("non-negotiable");
  });

  it("gym family → consumer-retail, non-negotiable", () => {
    const p = resolveContractPolicy("gym");
    expect(p.adviceMode).toBe("consumer-retail");
    expect(p.negotiabilityClass).toBe("non-negotiable");
  });

  it("cloud-services family → consumer-retail, non-negotiable", () => {
    const p = resolveContractPolicy("cloud-services");
    expect(p.adviceMode).toBe("consumer-retail");
    expect(p.negotiabilityClass).toBe("non-negotiable");
  });

  it("finance family → consumer-retail (broad bucket default)", () => {
    const p = resolveContractPolicy("finance");
    expect(p.adviceMode).toBe("consumer-retail");
  });

  it("type hint 'Mobile phone plan' → consumer-retail", () => {
    const p = resolveContractPolicy(undefined, "Mobile phone plan");
    expect(p.adviceMode).toBe("consumer-retail");
    expect(p.negotiabilityClass).toBe("non-negotiable");
  });

  it("type hint 'Gym membership' → consumer-retail", () => {
    const p = resolveContractPolicy(undefined, "Gym membership");
    expect(p.adviceMode).toBe("consumer-retail");
  });

  it("type hint 'Consumer loan / BNPL' → consumer-retail", () => {
    const p = resolveContractPolicy("finance", "Consumer loan / BNPL");
    expect(p.adviceMode).toBe("consumer-retail");
  });

  it("type hint 'Streaming subscription' → consumer-retail", () => {
    const p = resolveContractPolicy(undefined, "Streaming subscription");
    expect(p.adviceMode).toBe("consumer-retail");
  });

  it("type hint 'Utility / energy' → consumer-retail", () => {
    const p = resolveContractPolicy(undefined, "Energy utility agreement");
    expect(p.adviceMode).toBe("consumer-retail");
  });

  // -----------------------------------------------------------------------
  // B. Insurance / plan-check
  // -----------------------------------------------------------------------

  it("insurance family → plan-check, non-negotiable", () => {
    const p = resolveContractPolicy("insurance");
    expect(p.adviceMode).toBe("plan-check");
    expect(p.negotiabilityClass).toBe("non-negotiable");
  });

  it("type hint 'Health insurance' → plan-check", () => {
    const p = resolveContractPolicy(undefined, "Health insurance");
    expect(p.adviceMode).toBe("plan-check");
  });

  it("type hint 'Home insurance' → plan-check", () => {
    const p = resolveContractPolicy(undefined, "Home insurance");
    expect(p.adviceMode).toBe("plan-check");
  });

  it("type hint 'Travel insurance' → plan-check", () => {
    const p = resolveContractPolicy(undefined, "Travel insurance");
    expect(p.adviceMode).toBe("plan-check");
  });

  it("type hint 'Cyber insurance' → plan-check", () => {
    const p = resolveContractPolicy(undefined, "Cyber insurance");
    expect(p.adviceMode).toBe("plan-check");
  });

  // -----------------------------------------------------------------------
  // C. Tenancy / lease
  // -----------------------------------------------------------------------

  it("leases family → tenancy, sometimes-negotiable", () => {
    const p = resolveContractPolicy("leases");
    expect(p.adviceMode).toBe("tenancy");
    expect(p.negotiabilityClass).toBe("sometimes-negotiable");
  });

  it("type hint 'Rental agreement' → tenancy", () => {
    const p = resolveContractPolicy(undefined, "Rental agreement");
    expect(p.adviceMode).toBe("tenancy");
    expect(p.negotiabilityClass).toBe("sometimes-negotiable");
  });

  // -----------------------------------------------------------------------
  // D. Negotiable (employment / commercial)
  // -----------------------------------------------------------------------

  it("employment family → negotiable, often-negotiable", () => {
    const p = resolveContractPolicy("employment");
    expect(p.adviceMode).toBe("negotiable");
    expect(p.negotiabilityClass).toBe("often-negotiable");
  });

  it("type hint 'Commercial vendor agreement' → negotiable", () => {
    const p = resolveContractPolicy(undefined, "Commercial vendor agreement");
    expect(p.adviceMode).toBe("negotiable");
    expect(p.negotiabilityClass).toBe("often-negotiable");
  });

  it("type hint 'Consulting service agreement' → negotiable", () => {
    const p = resolveContractPolicy(undefined, "Consulting service agreement");
    expect(p.adviceMode).toBe("negotiable");
  });

  // -----------------------------------------------------------------------
  // E. Unknown / fallback
  // -----------------------------------------------------------------------

  it("unknown family → safe fallback, rarely-negotiable", () => {
    const p = resolveContractPolicy(undefined, undefined);
    expect(p.adviceMode).toBe("consumer-retail");
    expect(p.negotiabilityClass).toBe("rarely-negotiable");
  });

  it("contracts family (generic) → fallback", () => {
    const p = resolveContractPolicy("contracts");
    expect(p.negotiabilityClass).toBe("rarely-negotiable");
  });

  // -----------------------------------------------------------------------
  // F. Type hint takes priority over family
  // -----------------------------------------------------------------------

  it("type hint overrides family when more specific", () => {
    // Family says "contracts" (generic), but type hint says "Mobile phone plan"
    const p = resolveContractPolicy("contracts", "Mobile phone plan");
    expect(p.adviceMode).toBe("consumer-retail");
    expect(p.negotiabilityClass).toBe("non-negotiable");
  });

  it("type hint 'Employment offer letter' overrides contracts family", () => {
    const p = resolveContractPolicy("contracts", "Employment offer letter");
    expect(p.adviceMode).toBe("negotiable");
    expect(p.negotiabilityClass).toBe("often-negotiable");
  });
});
