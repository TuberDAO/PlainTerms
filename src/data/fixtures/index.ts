import type { Report } from "@/types/report";
import { reportInsurance } from "./report-insurance";
import { reportLease } from "./report-lease";
import { reportContract } from "./report-contract";

export const fixtures: Record<string, Report> = {
  "demo-insurance": reportInsurance,
  "demo-lease": reportLease,
  "demo-contract": reportContract,
};

export function getFixtureReport(id: string): Report | undefined {
  return fixtures[id];
}

export { reportInsurance, reportLease, reportContract };
