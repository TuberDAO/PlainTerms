/**
 * Cheap heuristic relevance check for document text.
 * Detects whether the document is likely a contract, policy, or legal terms
 * document -- the kind PlainTerms is designed to analyse.
 *
 * Returns { relevant: true } for anything plausibly contract-like.
 * Only returns { relevant: false } when confidence is very high that
 * the document is NOT a contract/policy (bias toward allowing).
 */

const CONTRACT_KEYWORDS: string[] = [
  "agreement",
  "terms and conditions",
  "terms of service",
  "terms of use",
  "contract",
  "policy",
  "shall",
  "hereby",
  "whereas",
  "liability",
  "indemnify",
  "indemnification",
  "coverage",
  "premium",
  "deductible",
  "exclusion",
  "exclusions",
  "cancellation",
  "termination",
  "renewal",
  "arbitration",
  "governing law",
  "jurisdiction",
  "warranty",
  "warranties",
  "confidential",
  "confidentiality",
  "obligation",
  "obligations",
  "benefit",
  "benefits",
  "claim",
  "claims",
  "policyholder",
  "insured",
  "insurer",
  "tenant",
  "landlord",
  "employer",
  "employee",
  "subscriber",
  "provider",
  "party",
  "parties",
  "schedule of benefits",
  "co-payment",
  "co-insurance",
  "coinsurance",
  "prior authorization",
  "pre-existing",
  "waiting period",
  "notice period",
  "cooling off",
  "force majeure",
  "severability",
  "entire agreement",
  "amendment",
  "waiver",
  "binding",
  "enforceable",
  "breach",
  "remedy",
  "remedies",
  "penalty",
  "penalties",
  "fee",
  "fees",
  "charge",
  "charges",
  "refund",
  "non-refundable",
  "auto-renew",
  "direct debit",
  "payment terms",
  "billing",
];

const SCAN_CHARS = 50_000;
const MIN_DISTINCT_KEYWORDS = 3;

export interface RelevanceResult {
  relevant: boolean;
  confidence: number;
  distinctKeywordsFound: number;
}

export function checkDocumentRelevance(chunks: string[]): RelevanceResult {
  let text = "";
  for (const chunk of chunks) {
    text += chunk + " ";
    if (text.length >= SCAN_CHARS) break;
  }
  text = text.slice(0, SCAN_CHARS).toLowerCase();

  const found = new Set<string>();
  for (const kw of CONTRACT_KEYWORDS) {
    if (text.includes(kw)) {
      found.add(kw);
    }
  }

  const distinctCount = found.size;

  if (distinctCount >= MIN_DISTINCT_KEYWORDS) {
    return { relevant: true, confidence: Math.min(distinctCount / 10, 1), distinctKeywordsFound: distinctCount };
  }

  return {
    relevant: false,
    confidence: 1 - distinctCount / MIN_DISTINCT_KEYWORDS,
    distinctKeywordsFound: distinctCount,
  };
}
