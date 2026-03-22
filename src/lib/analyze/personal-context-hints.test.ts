import { describe, it, expect } from "vitest";
import {
  getPersonalContextHintLines,
  getPersonalContextPlaceholder,
} from "./personal-context-hints";

describe("getPersonalContextHintLines", () => {
  it("shows health-specific examples for Health insurance", () => {
    const lines = getPersonalContextHintLines("Health insurance");
    expect(lines.some((l) => l.toLowerCase().includes("medication"))).toBe(
      true,
    );
    expect(lines.join(" ")).not.toMatch(/listed building|flat roof/i);
  });

  it("shows home-specific examples for Home insurance", () => {
    const lines = getPersonalContextHintLines("Home insurance");
    expect(lines.some((l) => l.toLowerCase().includes("listed"))).toBe(true);
    expect(lines.join(" ")).not.toMatch(/medication|specialist doctors/i);
  });

  it("shows car-specific examples for Car insurance", () => {
    const lines = getPersonalContextHintLines("Car insurance");
    expect(lines.some((l) => l.toLowerCase().includes("mileage"))).toBe(true);
    expect(lines.join(" ")).not.toMatch(/listed building|medication/i);
  });

  it("shows generic examples when no contract type is selected", () => {
    const lines = getPersonalContextHintLines("");
    expect(lines.length).toBeGreaterThan(3);
    expect(lines.join(" ")).not.toMatch(/medication|flat roof|mileage/i);
  });

  it("does not use long dash punctuation in hint lines", () => {
    for (const choice of [
      "",
      "Health insurance",
      "Home insurance",
      "Car insurance",
      "Travel insurance",
      "Mobile phone plan",
    ]) {
      const text = getPersonalContextHintLines(choice).join("\n");
      expect(text).not.toMatch(/\u2014|\u2013/);
    }
  });
});

describe("getPersonalContextPlaceholder", () => {
  it("uses a generic placeholder when type is empty", () => {
    const p = getPersonalContextPlaceholder("");
    expect(p.toLowerCase()).toMatch(/e\.g\./);
    expect(p).not.toMatch(/asthma/i);
  });

  it("uses health placeholder for Health insurance", () => {
    expect(getPersonalContextPlaceholder("Health insurance")).toMatch(
      /asthma|medication/i,
    );
  });

  it("uses home placeholder for Home insurance", () => {
    expect(getPersonalContextPlaceholder("Home insurance")).toMatch(
      /listed|flat roof|jewellery/i,
    );
  });

  it("uses car placeholder for Car insurance", () => {
    expect(getPersonalContextPlaceholder("Car insurance")).toMatch(
      /commuting|mileage|named drivers/i,
    );
  });
});
