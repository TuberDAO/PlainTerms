import type { Locale } from "@/types/report";

type TermKey =
  | "lease"
  | "leaseAgreement"
  | "landlord"
  | "tenant"
  | "deposit"
  | "flat"
  | "apartment"
  | "postcode"
  | "zipcode"
  | "colour"
  | "favour"
  | "analyse"
  | "licence"
  | "cheque"
  | "currency"
  | "currencySymbol";

const TERMS: Record<TermKey, Record<Locale, string>> = {
  lease: {
    GB: "tenancy",
    US: "lease",
    CA: "rental",
    AU: "lease",
  },
  leaseAgreement: {
    GB: "tenancy agreement",
    US: "lease agreement",
    CA: "rental agreement",
    AU: "lease agreement",
  },
  landlord: {
    GB: "landlord",
    US: "landlord",
    CA: "landlord",
    AU: "landlord",
  },
  tenant: {
    GB: "tenant",
    US: "tenant",
    CA: "renter",
    AU: "tenant",
  },
  deposit: {
    GB: "deposit",
    US: "security deposit",
    CA: "security deposit",
    AU: "bond",
  },
  flat: {
    GB: "flat",
    US: "apartment",
    CA: "apartment",
    AU: "unit",
  },
  apartment: {
    GB: "flat",
    US: "apartment",
    CA: "apartment",
    AU: "unit",
  },
  postcode: {
    GB: "postcode",
    US: "ZIP code",
    CA: "postal code",
    AU: "postcode",
  },
  zipcode: {
    GB: "postcode",
    US: "ZIP code",
    CA: "postal code",
    AU: "postcode",
  },
  colour: {
    GB: "colour",
    US: "color",
    CA: "colour",
    AU: "colour",
  },
  favour: {
    GB: "favour",
    US: "favor",
    CA: "favour",
    AU: "favour",
  },
  analyse: {
    GB: "analyse",
    US: "analyze",
    CA: "analyse",
    AU: "analyse",
  },
  licence: {
    GB: "licence",
    US: "license",
    CA: "licence",
    AU: "licence",
  },
  cheque: {
    GB: "cheque",
    US: "check",
    CA: "cheque",
    AU: "cheque",
  },
  currency: {
    GB: "GBP",
    US: "USD",
    CA: "CAD",
    AU: "AUD",
  },
  currencySymbol: {
    GB: "£",
    US: "$",
    CA: "CA$",
    AU: "A$",
  },
};

export function t(key: TermKey, locale: Locale): string {
  return TERMS[key]?.[locale] ?? TERMS[key]?.US ?? key;
}

export type { TermKey };
export { TERMS };
