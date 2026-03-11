/**
 * Contract-family-aware advice policy.
 *
 * Maps a contract family (and optional type hint) to a negotiability class,
 * advice mode, and a concrete LLM instruction block so the model adjusts
 * advice style, negotiation behavior, and recommended-question tone.
 */

export type NegotiabilityClass =
  | "non-negotiable"
  | "rarely-negotiable"
  | "sometimes-negotiable"
  | "often-negotiable";

export type AdviceMode =
  | "consumer-retail"
  | "plan-check"
  | "tenancy"
  | "negotiable";

export interface FamilyPolicy {
  negotiabilityClass: NegotiabilityClass;
  adviceMode: AdviceMode;
  instruction: string;
}

// ---------------------------------------------------------------------------
// Policy definitions
// ---------------------------------------------------------------------------

const CONSUMER_RETAIL_POLICY: FamilyPolicy = {
  negotiabilityClass: "non-negotiable",
  adviceMode: "consumer-retail",
  instruction: `CONTRACT FAMILY ADVICE MODE: MASS-MARKET CONSUMER (NON-NEGOTIABLE)
This is a standard mass-market retail consumer contract. The reader almost certainly cannot negotiate individual terms.

Advice rules for this contract type:
- Do NOT populate negotiation.suggestedEdit or negotiation.fallbackAsk. Leave them empty.
- Do NOT suggest the reader "ask the provider to amend clause X" or "propose alternative wording."
- whatToDo items should focus on: what to check before committing, what to ask customer service, what records to keep, when to cancel or switch providers, how to escalate a complaint, what deadlines or fees to track.
- recommendedQuestions should be practical and answerable by a customer service agent, not a lawyer. Examples: "Can I cancel by phone or does it have to be in writing?", "What happens to my number if I switch?", "Is there a cooling-off period?"
- letterTemplates: only generate if high/critical findings exist, and focus on complaint, cancellation confirmation, or dispute escalation — not contract renegotiation.`,
};

const PLAN_CHECK_POLICY: FamilyPolicy = {
  negotiabilityClass: "non-negotiable",
  adviceMode: "plan-check",
  instruction: `CONTRACT FAMILY ADVICE MODE: INSURANCE / MEDICAL COVERAGE (PLAN-CHECK)
This is an insurance policy or medical coverage document. Consumers do not negotiate individual policy terms.

Advice rules for this contract type:
- Do NOT populate negotiation.suggestedEdit or negotiation.fallbackAsk. Leave them empty.
- Do NOT suggest "ask your insurer to rewrite the exclusion." That is not realistic.
- Prioritise: plan fit, provider/network coverage, formulary/drug list, prior authorization requirements, exclusions and waiting periods, claim-denial and appeal paths, out-of-network exposure, deductible/coinsurance/out-of-pocket interactions, what to verify before treatment or renewal.
- whatToDo items should be practical verification steps: "Confirm your GP/specialist is in-network before your first appointment", "Check whether your medication is on the formulary", "Ask about prior authorization requirements before scheduling elective treatment."
- recommendedQuestions should target the insurer's member services line, the provider's billing office, or the employer's HR/benefits team — not policy drafters. Examples: "Is [specific treatment] covered under this plan?", "What is the appeal process if a claim is denied?", "Will my premium change at renewal?"
- letterTemplates: only for complaint, appeal, or coverage confirmation requests — not for policy renegotiation.`,
};

const TENANCY_POLICY: FamilyPolicy = {
  negotiabilityClass: "sometimes-negotiable",
  adviceMode: "tenancy",
  instruction: `CONTRACT FAMILY ADVICE MODE: TENANCY / LEASE / RENTAL (CAUTIOUSLY NEGOTIABLE)
This is a tenancy, lease, or rental agreement. Some terms may be negotiable before signing, depending on the landlord and local market.

Advice rules for this contract type:
- negotiation.suggestedEdit and negotiation.fallbackAsk MAY be populated for clauses that are realistically negotiable before signing (e.g. break clause terms, notice periods, repair responsibilities, deposit deduction criteria).
- Keep negotiation suggestions proportionate and realistic — not fantasy lawyering. A tenant asking to cap rent increases is reasonable; asking to rewrite the entire agreement is not.
- After signing, advice should shift toward: record-keeping, formal notice procedures, repair/maintenance escalation paths, deposit protection and dispute resolution, understanding break clauses, and knowing local statutory rights.
- recommendedQuestions should be practical for a landlord, letting agent, or housing authority. Examples: "Is the deposit registered in a protection scheme?", "What is the exact notice period for ending the tenancy?", "Who is responsible for boiler servicing?"
- letterTemplates: may include pre-signing clarification requests, repair requests, deposit dispute letters, or formal notice templates.`,
};

const NEGOTIABLE_POLICY: FamilyPolicy = {
  negotiabilityClass: "often-negotiable",
  adviceMode: "negotiable",
  instruction: `CONTRACT FAMILY ADVICE MODE: NEGOTIABLE (EMPLOYMENT / COMMERCIAL / BESPOKE)
This contract is likely individually negotiated or negotiable before signing.

Advice rules for this contract type:
- negotiation.suggestedEdit and negotiation.fallbackAsk SHOULD be populated where useful for clauses that are practically adjustable.
- Keep suggestions proportionate to the context — an employment offer can often adjust notice periods, non-compete scope, or IP clauses; a vendor agreement can adjust liability caps or SLA terms.
- whatToDo items may include both negotiation steps and practical compliance steps.
- recommendedQuestions may target the other party's legal team, HR, or procurement, as appropriate.
- letterTemplates: may include counter-proposal letters, clarification requests, or amendment requests.`,
};

// ---------------------------------------------------------------------------
// Fallback for unknown or ambiguous types
// ---------------------------------------------------------------------------

const FALLBACK_POLICY: FamilyPolicy = {
  negotiabilityClass: "rarely-negotiable",
  adviceMode: "consumer-retail",
  instruction: `CONTRACT FAMILY ADVICE MODE: UNKNOWN / GENERAL
The contract type is unclear. Default to cautious consumer-protection advice.

Advice rules for this contract type:
- Prefer practical checking and escalation advice over speculative negotiation edits.
- Only populate negotiation fields if the document text itself suggests the terms are individually agreed (e.g. "as agreed between the parties", bespoke schedules, named parties with specific terms).
- If the contract looks like a standard form: leave negotiation fields empty and focus whatToDo on checking, asking support, keeping records, and knowing deadlines.
- recommendedQuestions should be answerable by whoever issued the contract.`,
};

// ---------------------------------------------------------------------------
// Mapping
// ---------------------------------------------------------------------------

const FAMILY_MAP: Record<string, FamilyPolicy> = {
  telecom: CONSUMER_RETAIL_POLICY,
  gym: CONSUMER_RETAIL_POLICY,
  "cloud-services": CONSUMER_RETAIL_POLICY,
  insurance: PLAN_CHECK_POLICY,
  leases: TENANCY_POLICY,
  employment: NEGOTIABLE_POLICY,
};

/**
 * Additional pattern matching for contractTypeHint strings that are more
 * specific than the broad contractFamily enum.
 */
const TYPE_HINT_PATTERNS: [RegExp, FamilyPolicy][] = [
  [/\b(telecom|mobile|broadband|phone|internet)\b/i, CONSUMER_RETAIL_POLICY],
  [/\b(gym|fitness|membership|subscription|streaming)\b/i, CONSUMER_RETAIL_POLICY],
  [/\b(utilit|electric|gas|water|energy)\b/i, CONSUMER_RETAIL_POLICY],
  [/\b(bnpl|buy.now|store.card|credit.card|consumer.loan)\b/i, CONSUMER_RETAIL_POLICY],
  [/\b(health.insurance|medical|pmi|coverage|dental|vision)\b/i, PLAN_CHECK_POLICY],
  [/\b(home.insurance|car.insurance|travel.insurance|cyber.insurance|property.insurance)\b/i, PLAN_CHECK_POLICY],
  [/\b(insurance|indemnity.polic|assurance)\b/i, PLAN_CHECK_POLICY],
  [/\b(tenanc|lease|rental|rent|letting)\b/i, TENANCY_POLICY],
  [/\b(employ|offer.letter|work.contract|service.agreement)\b/i, NEGOTIABLE_POLICY],
  [/\b(commercial|vendor|enterprise|master.service|consulting)\b/i, NEGOTIABLE_POLICY],
];

/**
 * Resolve the contract-family advice policy from the available signals.
 *
 * Priority:
 *  1. contractTypeHint (most specific — user told us what it is)
 *  2. contractFamily (from schema enum — often model-inferred)
 *  3. fallback
 */
export function resolveContractPolicy(
  contractFamily?: string,
  contractTypeHint?: string,
): FamilyPolicy {
  // Try type hint first — it's the most specific signal
  if (contractTypeHint) {
    const hint = contractTypeHint.trim();
    for (const [pattern, policy] of TYPE_HINT_PATTERNS) {
      if (pattern.test(hint)) return policy;
    }
  }

  // Then try the contract family enum
  if (contractFamily) {
    const mapped = FAMILY_MAP[contractFamily];
    if (mapped) return mapped;
  }

  // "contracts" and "finance" are broad buckets — check type hint more loosely
  if (contractFamily === "finance") return CONSUMER_RETAIL_POLICY;
  if (contractFamily === "contracts") return FALLBACK_POLICY;

  return FALLBACK_POLICY;
}
