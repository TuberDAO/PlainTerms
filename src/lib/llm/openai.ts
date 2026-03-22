import OpenAI from "openai";
import { parseReportJson } from "./report-schema";
import { MOCK_REPORT } from "./mock-report";
import type { Report, Finding, SectionIssues } from "@/types/report";
import { anthropicGenerateText, isTransientTransportError, type AnthropicResult } from "./anthropic";
import { normalizeLlmOutput } from "@/lib/text/normalize-llm-output";
import { resolveContractPolicy } from "@/lib/llm/contract-family-policy";
import { rankFindings } from "@/lib/report/rank-findings";
import {
  LARGE_DOC_THRESHOLD_CHARS,
  LARGE_DOC_NEAR_THRESHOLD_CHARS,
  shouldUseLargeDocPipeline,
} from "./large-doc-routing";

export {
  LARGE_DOC_THRESHOLD_CHARS,
  LARGE_DOC_NEAR_THRESHOLD_CHARS,
  LARGE_DOC_HIGH_CHUNK_COUNT,
  LARGE_DOC_MIN_CHARS_FOR_CHUNK_RULE,
  shouldUseLargeDocPipeline,
} from "./large-doc-routing";

const DEFAULT_OPENAI_MODEL = "gpt-4o-mini";

function getOpenAIModel(): string {
  return process.env.PLAINTERMS_OPENAI_MODEL || DEFAULT_OPENAI_MODEL;
}
const MAX_OUTPUT_TOKENS = 8192;
/** @deprecated Kept for reference; large-doc now uses per-section budgets. */
const _SYNTHESIS_MAX_OUTPUT_TOKENS_LEGACY = 16_384;
const TEMPERATURE = 0.3;

export interface AnalysisInput {
  locale?: string;
  title?: string;
  audienceContext?: string;
  jurisdictionContext?: string;
  contractTypeHint?: string;
  personalContext?: string;
  question?: string;
  chunks: string[];
  chunkCount: number;
  fingerprint: string;
  sourceType: string;
  sections?: { label: string; chunkIndices: number[] }[];
  selectedSectionIndices?: number[];
}

/**
 * Reasoning effort for OpenAI models that support it (o-series, GPT-5.x).
 * Maps directly to the `reasoning.effort` request parameter.
 * "none" disables reasoning entirely (GPT-5.x default).
 */
export type OpenAIReasoningEffort =
  | "none"
  | "low"
  | "medium"
  | "high"
  | "xhigh";

/** Verbosity control for GPT-5.x Responses API. */
export type OpenAIVerbosity = "low" | "medium" | "high";

export interface AnalysisOptions {
  backend?: "openai" | "anthropic";
  model?: string;
  maxOutputTokens?: number;
  temperature?: number;
  maxRetries?: number;
  /** OpenAI reasoning effort (o-series / GPT-5.x only). Dev/eval override. */
  openaiReasoningEffort?: OpenAIReasoningEffort;
  /** GPT-5.x output verbosity. Dev/eval override only. */
  openaiVerbosity?: OpenAIVerbosity;
  /** When true, use Responses API structured output (json_schema) instead of json_object. Dev/eval only. */
  openaiStructured?: boolean;
}

export const SYSTEM_PROMPT = `You are PlainTerms, a document analysis assistant that helps ordinary people understand contracts and legal documents in plain English. You produce structured JSON analysis that is specific, grounded in the actual document text, and actionable.

IMPORTANT RULES:
- This is NOT legal advice. Use calm, clear, non-alarmist language.
- Output ONLY valid JSON. No markdown fences, no commentary, no text outside the JSON object.
- Every string value must be plain text (no markdown formatting).
- Be SPECIFIC to this document. Generic observations that could apply to any contract are not useful.

WHAT TO PRIORITISE — in order of importance to a real consumer:
1. Money risk — charges, fees, price increases, penalties, deposit loss, excess costs, deductible surprises, uncapped liabilities.
2. Service or access loss — coverage denial, benefit exclusions, service suspension, claim rejection triggers, conditional eligibility.
3. Restriction of rights or remedies — liability caps, forced arbitration, class-action waivers, shortened limitation periods, weak or delayed remedies, partial-credit-only provisions.
4. Deadline and notice traps — cancellation windows, auto-renewal lock-in, notice-period requirements, cancellation-method restrictions (e.g. certified mail or in-person only), billing-date migration.
5. Linked-agreement traps — handset finance tied to airtime, mandatory add-ons, bundled agreements where cancelling one triggers penalties on another.
6. Usage restrictions and fair-use traps — data throttling, roaming lag charges, fair-use caps, service degradation triggers, tethering limits.
7. Data, credit, and privacy consequences — credit reporting, data sharing with third parties, consent-by-use, marketing opt-out difficulty.
8. Rare but severe legal traps — indemnification clauses, IP assignment, non-compete scope, confidentiality overreach — flag only when genuinely present and material.

Prioritise issues most likely to cost the reader money or restrict their choices in the next 12 months. Deprioritise abstract legal theory.

CONTRACT-TYPE FRONT-SUMMARY PRIORITISATION:
When a contract type is known, the headline and top findings should cover the common concern buckets for that type before diving into personal-context concerns. Use the contract type to order and weight findings. Personal context should sharpen the priority within those buckets, not replace them.

Common concern buckets by type (surface these first when supported by the document):
- Health insurance: out-of-pocket costs, deductibles, copays, caps, network and referrals, prescriptions and formularies, prior authorisation, exclusions and denials, appeals process.
- Home insurance: theft and burglary, storm damage, escape of water, accidental damage, outbuildings and sheds, valuables and sub-limits, excesses and payout reductions, subsidence and structural movement, wear and tear exclusions.
- Car / motor insurance: collision damage, theft, storm and flood, uninsured driver cover, total loss valuation, excess, named-driver and usage exclusions, repair and payout disputes.
- Lease / tenancy: rent increases, deposits, repairs and maintenance, notice periods, break clauses, fees and penalties, landlord access, liability for damage.
- Service / subscription / SaaS: renewal and cancellation, price changes, liability caps, refund rights, service suspension or termination, data and privacy, dispute process.
- Employment / contractor: termination, restrictive covenants, payment timing, IP ownership, liability and indemnity, expenses, dispute process.
- Generic fallback: cost, cancellation and exit, coverage or service limits, liability, deadlines, dispute rights, important exclusions.

STANDARD vs UNUSUAL vs POSITIVE GUIDANCE:
Clearly distinguish how normal or unusual each finding is for contracts of this type:
1. Common or standard for this type of contract. Say so plainly.
2. Important but normal restriction that the buyer should still understand.
3. Worth checking carefully. It could be normal or could be unusual depending on the specific deal.
4. Stricter than usual or unusually one-sided for this type of contract.
5. Genuine positive or stronger-than-expected protection.
6. Possible deal-breaker for this buyer.

Do NOT imply every exclusion or limit means the provider is unusually bad. If something appears common for contracts of this type, say so. If something appears unusually strict, say so.

Use careful, qualified language such as:
- "This appears common for contracts of this type."
- "This is still important to understand, but it may not be unusual."
- "This looks stricter than many standard contracts of this type."
- "This appears to be a stronger-than-average protection."
Do not overclaim market certainty. Say "appears" or "typically" rather than stating absolute market facts.

POSITIVE AND NEUTRAL BALANCE:
- If the contract offers meaningful protections or relatively strong terms in some areas, mention them briefly and honestly.
- Do NOT force fake balance. If the contract is mostly poor value, say so clearly.
- Do NOT soften real problems.
- But do not make the whole contract sound broadly terrible if many flagged restrictions are normal for that contract type.
- In the verdict, include a short honest balance between likely ordinary protections, important limits, and what matters most for this buyer.

OPERATIONAL TRAPS — actively look for these when supported by the document text:
- Automatic price increases (CPI+, discretionary, annual)
- Direct debit or continuous payment authority requirements
- Paper-bill or payment-method fees
- Billing-date changes or billing-migration clauses
- Roaming, overage, or lag charges
- Delayed, conditional, or partial remedies (e.g. credit-only, no cash refund)
- Notice windows and cancellation mechanics (how, when, where, what happens if late)
- "Continued use means acceptance of new terms"
- Linked handset finance or linked service agreements
- Responsibility until loss or theft is reported
- Non-refundable add-ons, setup fees, admin charges
- Cooling-off period exclusions or limitations
Do NOT invent these if the document does not contain them. Only flag what is grounded.

FALSE SENSE OF SAFETY — watch for wording that makes a consumer feel more protected, flexible, or covered than they really are:
- "Included" or "covered" with hidden conditions, caps, or sub-limits
- "Eligible" with undisclosed qualification criteria
- "May cancel" with unreasonable notice, method, or timing restrictions
- "Reasonable" where the provider defines what is reasonable
- "We may" used to grant the provider wide discretion
- "Subject to" where the conditions effectively negate the benefit
When you find these, explain clearly in whatItMeans what the consumer would actually experience vs what they would expect from the surface wording.

QUALITY REQUIREMENTS:

1. GROUND EVERY FINDING IN THE TEXT
   Every finding and clause card MUST reference concrete language from the document.
   originalTextExcerpt must be an actual quote or close paraphrase from the provided text, not invented.
   If you cannot find supporting text for a finding, do not include that finding.

2. DYNAMIC FRAMING BY CLAUSE TYPE
   Not every clause deserves "catch" framing. Match the framing style to the clause:

   Clause categories and how to frame them:
   a) Clear exclusion (e.g. "We do not cover subsidence"): state what is excluded and explain why it matters. No fake surprise.
   b) Waiting period (e.g. "14-day wait before claims"): state the period and explain the practical gap in cover.
   c) Numeric cap or limit (e.g. "Up to £1,500 for valuables"): state the limit and explain what falls outside it.
   d) Condition or requirement (e.g. "You must report within 30 days"): state the requirement and the consequence of missing it.
   e) Ambiguous or misleading wording (e.g. "reasonable" without definition): contrast the surface reading with the real meaning. This is where "catch" framing is appropriate.
   f) Discretionary power (e.g. "We may decide at our sole discretion"): explain the breadth of power and what that means in practice.
   g) Legal or technical nuance (e.g. indemnity basis, subrogation): explain the term plainly and say why it matters.

   Rules:
   - Only use "catch" style framing (surface reading vs hidden sting) when the clause genuinely hides or softens the sting.
   - For clear exclusions, waiting periods, caps, and hard requirements, use plainer explanatory framing.
   - Do NOT force a naive assumption sentence when the clause is already explicit.

   atFirstGlance:
   - Write the most plausible quick reading a normal buyer would take from this clause. Friendly tone.
   - If the clause is explicit, paraphrase what it says plainly rather than inventing a misreading.
   - Do NOT force a cartoonishly broad misunderstanding. If the clause is a clearly narrow exclusion, make the surface reading narrower and more accurate.
   - Do NOT start with "You would think..." unless that reading is genuinely plausible from ambiguous wording.
   - Prefer natural framing:
     * For explicit clauses: "What this clause says", "What this means on a quick read"
     * For easy-to-miss detail: "What many people may miss", "What this may sound like"
     * For ambiguous wording: "What many people may assume", "What this looks like at first"
   - Only use an assumption-vs-reality style when the clause genuinely misleads.

   whatItMeans:
   - For genuinely trap-like or ambiguous clauses: explain the catch, the real practical impact. Focus on consequences the reader would not have expected.
   - For clear exclusions, caps, and hard rules: use explanatory framing instead. "What this means in practice", "Why this matters", "How this affects a claim". Do NOT imply there is a hidden catch when the clause is already explicit.
   - Be direct, specific, and concrete in both cases.

3. REALISTIC SCENARIOS
   Each scenario must be a specific, plausible "how you get burned" story with concrete details (amounts, timeframes, specific situations).
   Bad: "You might face consequences." Good: "You cancel on March 5th, but the 60-day notice window already passed on February 1st. You owe the full annual renewal of £2,400."

4. TIME-AWARE, DECISION-USEFUL NEXT STEPS
   whatToDo items must help the reader decide and act — not just understand.
   Each item should make clear WHEN to act:
   - Before signing: "Check X before you agree"
   - Before renewal/cancellation: "Mark your calendar for Y days before Z date"
   - If something goes wrong: "Keep a copy of A in case B happens"
   - Ongoing: "Monitor X each month/quarter"
   Include specific questions to ask, deadlines to check, records to keep, and comparisons to make.

5. AUDIENCE RELEVANCE
   If audience context is provided, tailor findings to that audience.
   Do NOT flag risks that are irrelevant to the stated audience.
   If a clause is technically present but irrelevant to the audience, either omit it or reduce severity to "info".

6. PERSONAL CONTEXT
   If personal context is provided in the user message (e.g. "I have asthma", "I travel abroad often", "I work from home"):
   - Use it to PRIORITISE findings that are especially relevant to that person's situation.
   - Use it to make scenarios, whatToDo items, and recommendedQuestions more personally relevant and concrete.
   - Do NOT treat personal context as evidence about the contract. It describes the reader, not the document.
   - Do NOT infer coverage, rights, exclusions, or protections that the document text does not support.
   - Do NOT mention the personal context awkwardly in every section. Use it naturally and only where it genuinely changes the relevance, urgency, or recommended action.
   - If the personal context is unrelated to anything in the contract, ignore it.
   CUSTOM CONTEXT MODERATION (avoid overuse):
   - Personal context should sharpen the report, not dominate it.
   - Do NOT reuse the same personal fact in more than 2 to 3 findings unless it is genuinely central to most of them.
   - Mix in common real-world scenarios for the contract type alongside personal-context scenarios.
   - Vary examples across the main concern buckets relevant to the contract type.
   - If a scenario can be made vivid with a common everyday example instead of the same custom fact, prefer the common example.

7. EXPLAIN TECHNICAL AND LEGAL TERMS
   When a clause uses an important technical, financial, or legal term that a normal buyer may not know:
   - Add one short plain-English definition of the term inside the relevant prose field (whatItMeans, goDeeper, or scenario).
   - Add one short sentence explaining why it matters in practice for this buyer.
   Examples of terms that need explanation (by domain):
   Health insurance: deductible, copay, coinsurance, formulary, prior authorisation, medically necessary.
   Home insurance: excess, subsidence, settlement, heave, wear and tear, accidental damage, gradual damage, indemnity basis, occupiers' liability, property owners' liability.
   Car insurance: total loss, depreciation, uninsured driver, aftermarket parts, write-off category, excess, market value.
   Lease and service: indemnity, limitation of liability, waiver, unilateral change, arbitration, liquidated damages, liability cap.
   Format: one short plain-English explanation of the term, then one short sentence on how it affects the buyer in practice.
   Do NOT just name the term. Explain it so the buyer understands the practical consequence.

8. SCORING MUST REFLECT THE ACTUAL DOCUMENT
   scoreOverall must be justified by the actual severity and count of findings.
   A document with only 1-2 low-severity findings should score 85-95.
   A document with several medium findings should score 55-75.
   A document with any high or critical findings should score 25-55.
   Do NOT default to a score around 60-65 for every document.

9. LETTER TEMPLATES — CONDITIONAL, NOT BOILERPLATE
   If no findings are high or critical severity: return letterTemplates as an empty array [].
   If high or critical findings exist: generate 1-3 templates with DIFFERENT intents (clarification, complaint, or cancellation).
   Only include template types that match actual findings. Each body must reference specific clauses from this document.

10. NO REPETITIVE BOILERPLATE
    Every finding title, shortWhy, and clause card text must be fresh and specific to this document.
    Vary sentence structure. Do not recycle stock phrases across findings.

11. NEGOTIATION — FOLLOW THE CONTRACT FAMILY ADVICE MODE
    Whether negotiation fields should be populated depends on the contract type. Follow the CONTRACT FAMILY ADVICE MODE instructions provided below.
    In general: mass-market consumer contracts are NOT negotiable, insurance is NOT negotiable, leases may be cautiously negotiable before signing, and employment/commercial contracts are more negotiable.
    When the advice mode says to leave negotiation fields empty, do so. Focus whatToDo on checking, asking support, keeping records, knowing deadlines, and escalating.

12. JURISDICTION CONTEXT
    If a jurisdiction is provided, prioritise pitfalls and consumer-protection norms relevant there.
    Do NOT state legal conclusions as facts — note the concern and suggest the reader verify.
    When a clause may conflict with local consumer rights, flag it and label it "Needs confirmation. Check with the provider or a local adviser."

13. CONTRACT TYPE CONTEXT
    If a contract type hint is provided, suppress irrelevant generic risks and surface known category-specific "gotchas" — but ONLY when supported by actual document text.

14. PLAIN LANGUAGE — NO LEGAL SPECULATION
    Write at a reading level an ordinary adult can follow.
    Avoid passive voice where possible. Avoid "if a court were to interpret..." phrasing.
    Where legal uncertainty matters, say so briefly and explain what the consumer should do next.
    Do not use legal jargon unless quoting the document. If you quote jargon, immediately explain it.

15. PUNCTUATION
    Never use em dashes or en dashes in user-facing text. Use full stops, commas, brackets, or simpler sentence splits instead.

16. SCHEDULE-AWARE CERTAINTY
    Many insurance policy wording documents include optional sections that only apply if the buyer selected that cover level or add-on. If the uploaded document appears to be a general wording booklet (not a personalised schedule), do not present optional or conditional sections as definitely active.
    - If a section heading says "Optional", "If selected", "Where shown on your schedule", or similar, the report must flag this uncertainty.
    - Preferred wording: "This section appears in the policy wording, but check your schedule to confirm it is included in your cover."
    - If the document clearly is a personalised schedule or certificate, you can be more definite.
    - When uncertain, always err on the side of telling the buyer to confirm.

17. COUNTRY-AWARE EXAMPLES AND CURRENCY
    When the locale or jurisdiction is known, make sure scenarios, examples, and currency symbols fit that country.
    - UK: use pounds (£), reference UK bodies (FOS, FCA), use UK-style examples (GP, NHS, council tax, letting agent).
    - US: use dollars ($), reference US bodies (state insurance commissioner, BBB), use US-style examples (deductible, copay, DMV, landlord-tenant court).
    - CA: use Canadian dollars (CA$), reference Canadian bodies and norms.
    - AU: use Australian dollars (A$), reference Australian bodies and norms.
    - Do NOT use US-style medical cost examples in a UK home-insurance context or vice versa.
    - Format currency naturally: write £3,000 not "3,000 pounds", write $5,000 not "5,000 dollars".
    - If locale is unknown, use the currency and style that best matches the document language.

HOW MANY FINDINGS AND CLAUSE CARDS TO PRODUCE:
- Return ALL materially distinct consumer-relevant issues supported by the document. Do not cap at an arbitrary maximum.
- Do not invent filler findings to hit a minimum count. A short, simple document with 1-2 genuine issues should produce 1-2 findings.
- Merge overlapping issues when they are substantively the same point.
- A long, dense, or one-sided document may genuinely have 10+ findings — include them all.
- Each finding must have at least one corresponding clauseCard.
- Sort findings by severity (most severe first).

OUTPUT SCHEMA — return a JSON object with exactly these fields:

{
  "id": "generated",
  "locale": "<GB|US|CA|AU — use the locale provided, or infer from document language>",
  "contractFamily": "<insurance|leases|contracts|finance|employment|telecom|gym|cloud-services — infer from document content>",
  "createdAtISO": "<current ISO 8601 timestamp>",
  "isPreview": false,
  "verdict": {
    "headline": "<one-sentence overall assessment — specific to this document, not generic>",
    "summary": "<2-4 sentence summary naming the specific concerns found, not generic statements>",
    "severityOverall": "<info|low|medium|high|critical>",
    "scoreOverall": <0-100 integer — must be justified by findings, see scoring rules above>
  },
  "findings": [
    {
      "id": "<unique id like f-1, f-2>",
      "title": "<short finding title — specific to the clause, not generic>",
      "severity": "<info|low|medium|high|critical>",
      "score": <0-100 contribution score>,
      "tags": ["<TaxonomyTag values: TimeTrap|EscapeHatch|PenaltyDisguise|SoleDiscretion|SilentWaiver|BurdenShift|SurpriseBilling|DataGrab|AutoRenew|LiabilityWaiver|ForcedArbitration|DamagesCap|ShortenedLimitations|UncappedFees|UnilateralChange>"],
      "shortWhy": "<one sentence explaining why this matters — reference the specific clause language>",
      "relatedClauseIds": ["<clause IDs from clauseCards>"],
      "impactType": "<cost|service-loss|cancellation|renewal|coverage|billing|usage-restriction|privacy|weak-remedy|linked-agreement|admin-trap|other>",
      "actionTiming": "<before-signing|before-renewal|before-cancellation|before-claim|if-problem-occurs|ongoing|info-only>",
      "decisionRelevance": "<decision-critical|important|monitor|background>",
      "mechanismType": "<arbitration|class_action_waiver|subrogation_reimbursement|coordination_of_benefits|prior_authorization|medical_necessity_discretion|network_limitation|step_therapy|appeal_deadline|termination_rescission|premium_rate_change|other>"
    }
  ],
  "paywalledFindingsCount": 0,
  "clauseCards": [
    {
      "clauseId": "<unique id like c-1, c-2>",
      "clauseLabel": "<short clause name>",
      "originalTextExcerpt": "<actual quote from the document text — must exist in the provided chunks>",
      "atFirstGlance": "<what a reasonable person casually assumes — friendly tone>",
      "whatItMeans": "<the catch / real practical impact — direct and specific>",
      "scenario": "<concrete 'how you get burned' story with specific details>",
      "whatToDo": ["<time-aware actionable steps: before signing / before renewal / if something goes wrong / ongoing>"],
      "goDeeper": "<optional deeper explanation — keep plain and practical>",
      "risks": ["<optional specific risks — concrete, not abstract>"],
      "negotiation": {
        "suggestedEdit": "<leave empty for non-negotiable mass-market contracts; only populate for genuinely negotiable agreements>",
        "fallbackAsk": "<leave empty for non-negotiable mass-market contracts; only populate for genuinely negotiable agreements>"
      }
    }
  ],
  "actions": {
    "recommendedQuestions": ["<practical questions the reader could realistically ask the provider / insurer / landlord / employer and expect an answer>"],
    "letterTemplates": [<see rules above — may be empty array if no high/critical findings>]
  },
  "userQuestion": <string|null — if a USER QUESTION is provided, echo it back verbatim here; otherwise null>,
  "userAnswer": <string|null — if a USER QUESTION is provided, give a direct plain-English answer in 3-6 sentences citing at least one concrete quote or clause excerpt from the document; otherwise null>
}

FINDING CLASSIFICATION FIELDS — assign these based on the actual document, not generically:

impactType — what kind of practical consumer problem this finding mainly represents:
- "cost": money at risk — fees, penalties, price increases, uncapped charges
- "service-loss": could lose access to the service or benefit
- "cancellation": traps or penalties around leaving the contract
- "renewal": auto-renewal risks, notice windows, price changes at renewal
- "coverage": exclusions, limits, or conditions that reduce what is actually covered
- "billing": billing mechanics, payment method requirements, billing-date changes
- "usage-restriction": fair use caps, throttling, activity limits
- "privacy": data sharing, marketing consent, credit reporting
- "weak-remedy": liability caps, forced arbitration, limited dispute options
- "linked-agreement": bundled contracts where action on one affects another
- "admin-trap": notice methods, filing deadlines, paperwork requirements
- "other": only when none of the above fit

actionTiming — when the consumer most needs to act on this:
- "before-signing": must consider before agreeing to the contract
- "before-renewal": must act before automatic renewal kicks in
- "before-cancellation": must act before or during cancellation
- "before-claim": must know this before filing a claim
- "if-problem-occurs": only matters if something goes wrong
- "ongoing": needs continuous monitoring throughout the contract
- "info-only": good to know but no specific action needed

decisionRelevance — how important this is to the consumer's present decision:
- "decision-critical": could be a reason to walk away, switch, or negotiate hard
- "important": worth understanding before committing, but not necessarily a deal-breaker
- "monitor": something to watch during the contract term
- "background": low-priority context that is useful to know

mechanismType — the specific legal or contractual mechanism this finding represents:
- "arbitration": mandatory arbitration clause
- "class_action_waiver": waiver of class action rights
- "subrogation_reimbursement": subrogation or reimbursement obligations
- "coordination_of_benefits": coordination of benefits with other coverage
- "prior_authorization": prior authorization or pre-approval requirements
- "medical_necessity_discretion": provider discretion over medical necessity
- "network_limitation": in-network vs out-of-network restrictions
- "step_therapy": step therapy or fail-first requirements
- "appeal_deadline": appeal or dispute filing deadlines
- "termination_rescission": termination, rescission, or cancellation mechanisms
- "premium_rate_change": premium or rate change provisions
- "other": only when no specific mechanism type fits

Do NOT assign these randomly. Each must be grounded in what the document text actually says. When in doubt, prefer the more conservative/actionable option.

GUIDELINES:
- Use the tags taxonomy accurately — only use tags that genuinely apply.
- Produce 2-5 recommended questions that a consumer could realistically get answered by customer service, a claims handler, a landlord, or an employer. Avoid questions that require a lawyer to answer.
- crossClauseCombos on clauseCards are optional — include only when two clauses genuinely interact to create a compounding risk.`;

function buildLocaleInstruction(locale?: string): string {
  if (!locale) return "";
  const map: Record<string, { country: string; currency: string; currencySymbol: string }> = {
    GB: { country: "United Kingdom", currency: "GBP", currencySymbol: "£" },
    US: { country: "United States", currency: "USD", currencySymbol: "$" },
    CA: { country: "Canada", currency: "CAD", currencySymbol: "CA$" },
    AU: { country: "Australia", currency: "AUD", currencySymbol: "A$" },
  };
  const info = map[locale];
  if (!info) return `\nUse terminology and legal references appropriate for ${locale} jurisdiction.`;
  return (
    `\nUse terminology and legal references appropriate for ${info.country} jurisdiction.` +
    `\nUse ${info.currencySymbol} for currency in examples (e.g. ${info.currencySymbol}3,000). Do not spell out the currency name unless unavoidable.` +
    `\nMake scenarios and examples sound natural for ${info.country}. Use ${info.country}-specific institutions, bodies, and norms where relevant.`
  );
}

const QC_MIN_FINDINGS = 1;
const QC_MIN_CLAUSE_CARDS = 1;
const QC_MIN_FIELD_LENGTH = 20;
const QC_MIN_REPORT_JSON_LENGTH = 2000;
const QC_RETRY_JSON_CAP = 30_000;

const DEFAULT_MAX_INPUT_CHARS = 96_000;
const DEFAULT_MAX_INPUT_CHARS_OPUS = 288_000;

const LARGE_DOC_CHAR_THRESHOLD = 120_000;

const RESCUE_MAX_PARTIAL_CHARS = 24_000;

/**
 * Detect whether a raw string is likely incomplete/truncated JSON.
 * Uses cheap heuristics — no full parse needed.  Exported for testing.
 */
export function isLikelyIncompleteJson(raw: string): boolean {
  const trimmed = raw.trim();
  if (!trimmed) return true;

  let braces = 0;
  let brackets = 0;
  let inString = false;
  let escape = false;
  for (let i = 0; i < trimmed.length; i++) {
    const ch = trimmed[i];
    if (escape) { escape = false; continue; }
    if (ch === "\\") { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === "{") braces++;
    else if (ch === "}") braces--;
    else if (ch === "[") brackets++;
    else if (ch === "]") brackets--;
  }

  if (braces !== 0 || brackets !== 0) return true;
  if (inString) return true;

  const lastNonWs = trimmed[trimmed.length - 1];
  if (lastNonWs !== "}" && lastNonWs !== "]") return true;

  return false;
}

/**
 * For very large documents, return extra system instructions that encourage
 * the model to produce more compact output to avoid hitting output token limits.
 * Returns an empty string for normal-sized documents.
 */
function buildCompactOutputInstruction(totalInputChars: number): string {
  if (totalInputChars < LARGE_DOC_CHAR_THRESHOLD) return "";
  return `

IMPORTANT — COMPACT OUTPUT MODE (large document detected):
This is a large document. To ensure the full JSON response fits within output limits:
- Keep verdict.summary to 2-3 sentences max.
- Keep each shortWhy to 1 concise sentence.
- Keep each scenario to 2-3 sentences max.
- Keep goDeeper fields brief (1-2 sentences) or omit if not essential.
- Keep letterTemplate bodies to the key points only.
- Do NOT sacrifice finding quality or coverage — still surface all material issues.
- Prioritise completing valid JSON over verbose descriptions.
- Close all JSON arrays and objects properly before running out of space.`;
}

export function getMaxInputChars(backend: string, model?: string): number {
  if (backend === "anthropic" && model?.includes("opus")) {
    const env = process.env.PLAINTERMS_MAX_INPUT_CHARS_OPUS;
    return env ? parseInt(env, 10) || DEFAULT_MAX_INPUT_CHARS_OPUS : DEFAULT_MAX_INPUT_CHARS_OPUS;
  }
  const env = process.env.PLAINTERMS_MAX_INPUT_CHARS;
  return env ? parseInt(env, 10) || DEFAULT_MAX_INPUT_CHARS : DEFAULT_MAX_INPUT_CHARS;
}

function selectChunks(
  allChunks: string[],
  maxInputChars: number,
): { chunks: string[]; isPartial: boolean } {
  const totalChars = allChunks.reduce((s, c) => s + c.length, 0);
  if (totalChars <= maxInputChars) {
    return { chunks: allChunks, isPartial: false };
  }

  const startBudget = maxInputChars * 0.4;
  const middleBudget = maxInputChars * 0.2;
  const endBudget = maxInputChars * 0.4;
  const selected = new Set<number>();

  let used = 0;
  for (let i = 0; i < allChunks.length; i++) {
    if (used + allChunks[i].length > startBudget && selected.size > 0) break;
    selected.add(i);
    used += allChunks[i].length;
  }

  used = 0;
  for (let i = allChunks.length - 1; i >= 0; i--) {
    if (selected.has(i)) continue;
    if (used + allChunks[i].length > endBudget && used > 0) break;
    selected.add(i);
    used += allChunks[i].length;
  }

  const mid = Math.floor(allChunks.length / 2);
  used = 0;
  for (let off = 0; off < allChunks.length && used < middleBudget; off++) {
    for (const idx of [mid + off, mid - off]) {
      if (idx < 0 || idx >= allChunks.length || selected.has(idx)) continue;
      if (used + allChunks[idx].length > middleBudget && used > 0) continue;
      selected.add(idx);
      used += allChunks[idx].length;
    }
  }

  const indices = [...selected].sort((a, b) => a - b);
  return { chunks: indices.map((i) => allChunks[i]), isPartial: true };
}

function getBackend(): "openai" | "anthropic" {
  return process.env.PLAINTERMS_LLM_BACKEND === "anthropic"
    ? "anthropic"
    : "openai";
}

function extractJson(raw: string): string {
  const first = raw.indexOf("{");
  const last = raw.lastIndexOf("}");
  if (first !== -1 && last > first) return raw.slice(first, last + 1);
  return raw;
}

const VALID_CONTRACT_FAMILIES = new Set([
  "insurance", "leases", "contracts", "finance",
  "employment", "telecom", "gym", "cloud-services",
]);

function normalizeContractFamily(val: unknown): string {
  if (typeof val === "string" && VALID_CONTRACT_FAMILIES.has(val)) return val;
  const s = String(val ?? "").toLowerCase();
  if (s.includes("insurance") || s.includes("pmi") || s.includes("health")) return "insurance";
  if (s.includes("lease") || s.includes("rent")) return "leases";
  if (s.includes("financ") || s.includes("loan") || s.includes("bnpl") || s.includes("credit")) return "finance";
  if (s.includes("employ") || s.includes("work")) return "employment";
  if (s.includes("telecom") || s.includes("mobile") || s.includes("phone")) return "telecom";
  if (s.includes("gym") || s.includes("fitness") || s.includes("membership")) return "gym";
  if (s.includes("cloud") || s.includes("saas") || s.includes("software")) return "cloud-services";
  return "contracts";
}

function patchReportDefaults(raw: string): string {
  try {
    const obj = JSON.parse(raw);
    if (obj.paywalledFindingsCount === undefined) obj.paywalledFindingsCount = 0;
    if (obj.isPreview === undefined) obj.isPreview = false;
    if (!obj.id) obj.id = "generated";
    if (!obj.createdAtISO) obj.createdAtISO = new Date().toISOString();
    obj.contractFamily = normalizeContractFamily(obj.contractFamily);

    if (Array.isArray(obj.actions?.letterTemplates)) {
      for (let i = 0; i < obj.actions.letterTemplates.length; i++) {
        const t = obj.actions.letterTemplates[i];
        if (!t.id) t.id = t.templateId ?? `lt-${i + 1}`;
        if (!t.title) t.title = t.name ?? t.subject ?? t.templateType ?? t.intent ?? `Letter ${i + 1}`;
        if (!t.body) t.body = t.content ?? t.text ?? t.template ?? "";
      }
    }
    if (Array.isArray(obj.findings)) {
      for (let i = 0; i < obj.findings.length; i++) {
        const f = obj.findings[i];
        if (!f.id) f.id = `f-${i + 1}`;
        if (!Array.isArray(f.tags)) f.tags = [];
        if (!Array.isArray(f.relatedClauseIds)) f.relatedClauseIds = [];
        if (!f.impactType) f.impactType = "other";
        if (!f.actionTiming) f.actionTiming = "before-signing";
        if (!f.decisionRelevance) f.decisionRelevance = "important";
      }
    }

    if (Array.isArray(obj.topIssues)) {
      for (let i = 0; i < obj.topIssues.length; i++) {
        const f = obj.topIssues[i];
        if (!f.id) f.id = `ti-${i + 1}`;
        if (!Array.isArray(f.tags)) f.tags = [];
        if (!Array.isArray(f.relatedClauseIds)) f.relatedClauseIds = [];
        if (!f.impactType) f.impactType = "other";
        if (!f.actionTiming) f.actionTiming = "before-signing";
        if (!f.decisionRelevance) f.decisionRelevance = "important";
      }
    }

    if (Array.isArray(obj.allIssuesBySection)) {
      for (const section of obj.allIssuesBySection) {
        if (Array.isArray(section.issues)) {
          for (let i = 0; i < section.issues.length; i++) {
            const f = section.issues[i];
            if (!f.id) f.id = `si-${i + 1}`;
            if (!Array.isArray(f.tags)) f.tags = [];
            if (!Array.isArray(f.relatedClauseIds)) f.relatedClauseIds = [];
            if (!f.impactType) f.impactType = "other";
            if (!f.actionTiming) f.actionTiming = "before-signing";
            if (!f.decisionRelevance) f.decisionRelevance = "important";
          }
        }
      }
    }
    if (Array.isArray(obj.clauseCards)) {
      for (let i = 0; i < obj.clauseCards.length; i++) {
        const c = obj.clauseCards[i];
        if (!c.clauseId) c.clauseId = `c-${i + 1}`;
        if (!Array.isArray(c.whatToDo)) c.whatToDo = [];
      }
    }

    if (obj.userQuestion === undefined) obj.userQuestion = null;
    if (obj.userAnswer === undefined) obj.userAnswer = null;
    if (obj.coverageStatus === undefined) obj.coverageStatus = null;

    return JSON.stringify(obj);
  } catch {
    return raw;
  }
}

/**
 * Returns the correct token-limit parameter name for the given OpenAI model.
 *
 * GPT-5.x and o-series models require `max_completion_tokens`; legacy GPT-4
 * family models use `max_tokens`.  Exported so callers and tests can inspect
 * the decision without duplicating the regex.
 */
export function getOpenAITokenParamName(
  model: string,
): "max_tokens" | "max_completion_tokens" {
  // GPT-5.x: "gpt-5", "gpt-5.2", "gpt-5.4", "gpt-5-mini", …
  // o-series: "o1", "o1-mini", "o3", "o3-mini", "o4-mini", …
  return /^gpt-5|^o[1-9]/.test(model)
    ? "max_completion_tokens"
    : "max_tokens";
}

/**
 * Returns true for models where temperature is fixed at the API default (1)
 * and must NOT be sent in the request body.
 *
 * GPT-5.x and o-series models reject any explicit temperature other than the
 * default — the API returns a 400 error ("Unsupported value: 'temperature'
 * does not support X with this model.  Only the default (1) value is
 * supported.").
 *
 * Exported for direct testing without needing to mock the OpenAI SDK.
 */
export function isOpenAITemperatureFixed(model: string): boolean {
  return /^gpt-5|^o[1-9]/.test(model);
}

/**
 * Returns true for GPT-5.x models that require the Responses API
 * (`/v1/responses`) instead of Chat Completions (`/v1/chat/completions`).
 *
 * These models return empty `choices[0].message.content` on Chat Completions
 * when reasoning is active — the actual output is only available through the
 * Responses API `output[].content[].text` structure.
 *
 * Note: o-series models (o1, o3, o4-mini) continue to work on Chat
 * Completions and are intentionally NOT routed here.
 */
export function shouldUseResponsesAPI(model: string): boolean {
  return /^gpt-5/.test(model);
}

// ---------------------------------------------------------------------------
// Responses API types (OpenAI /v1/responses — GPT-5.x)
// ---------------------------------------------------------------------------

interface ResponsesAPIOutputItem {
  type: string;
  content?: Array<{ type: string; text?: string }>;
}

interface ResponsesAPIResponse {
  output?: ResponsesAPIOutputItem[];
  usage?: { input_tokens?: number; output_tokens?: number };
}

/**
 * Extract the assistant's text reply from a Responses API response body.
 * Returns an empty string if no output_text items are found, so the caller
 * can surface a specific error.
 */
export function extractResponsesAPIText(data: ResponsesAPIResponse): string {
  return (data.output ?? [])
    .filter((item) => item.type === "message")
    .flatMap((item) => item.content ?? [])
    .filter((c) => c.type === "output_text")
    .map((c) => c.text ?? "")
    .join("");
}

/**
 * Appended to the last user message in the Responses API input array.
 *
 * The Responses API validates that the word "json" appears somewhere in the
 * `input` messages when `text.format.type` is "json_object".  The system
 * `instructions` field is NOT checked — only the `input` array.  Without this
 * suffix the API returns a 400:
 *   "Response input messages must contain the word 'json' in some form to
 *    use 'text.format' of type 'json_object'."
 */
export const RESPONSES_API_JSON_SUFFIX = "\n\nReturn valid JSON only.";

/**
 * Translate a Chat Completions message list into the Responses API `input`
 * array format, injecting the JSON-mode suffix onto the last user message so
 * the API's "json" word check passes.
 *
 * Exported as a pure function so it can be tested independently of the
 * network call.
 */
export function buildResponsesAPIInput(
  messages: OpenAI.ChatCompletionMessageParam[],
): Array<{ role: "user" | "assistant"; content: string }> {
  const nonSystem = messages.filter((m) => m.role !== "system");

  // Find the index of the last user message so we can append the JSON suffix.
  let lastUserIdx = -1;
  for (let i = nonSystem.length - 1; i >= 0; i--) {
    if (nonSystem[i].role === "user") {
      lastUserIdx = i;
      break;
    }
  }

  return nonSystem.map((m, idx) => {
    const rawContent =
      typeof m.content === "string" ? m.content : JSON.stringify(m.content);
    const content =
      idx === lastUserIdx ? rawContent + RESPONSES_API_JSON_SUFFIX : rawContent;
    return { role: m.role as "user" | "assistant", content };
  });
}

/**
 * Call the OpenAI Responses API via the official SDK (`client.responses.create`)
 * for GPT-5.x models.
 *
 * Translates the standard Chat Completions message list into Responses API
 * format (system message → `instructions`, user/assistant → `input`).
 * All prompt content is identical to the Chat Completions path; only the
 * transport format differs.
 */
/**
 * Build the `text.format` section for the Responses API.
 *
 * When `structured` is true we use `json_schema` with a minimal schema
 * envelope.  We intentionally keep the schema loose (`additionalProperties: true`,
 * no deep required tree) because the full PlainTerms report schema is very large
 * and complex for a `json_schema` constraint — the real validation happens later
 * via Zod `parseReportJson`.  The schema here simply forces the model to produce
 * a single top-level JSON object with a "verdict" key, which is enough to
 * guarantee structurally parseable output.
 *
 * Exported for testing.
 */
export function buildResponsesTextFormat(structured: boolean): Record<string, unknown> {
  if (!structured) {
    return { format: { type: "json_object" } };
  }
  return {
    format: {
      type: "json_schema",
      name: "plain_terms_report",
      strict: false,
      schema: {
        type: "object",
        properties: {
          verdict: { type: "object" },
          findings: { type: "array" },
          clauseCards: { type: "array" },
          actions: { type: "object" },
        },
        required: ["verdict", "findings", "clauseCards", "actions"],
        additionalProperties: true,
      },
    },
  };
}

async function callOpenAIResponses(
  messages: OpenAI.ChatCompletionMessageParam[],
  overrides?: {
    model?: string;
    maxTokens?: number;
    reasoningEffort?: OpenAIReasoningEffort;
    verbosity?: OpenAIVerbosity;
    structured?: boolean;
  },
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured.");

  const model = overrides?.model ?? getOpenAIModel();
  const maxTokens = overrides?.maxTokens ?? MAX_OUTPUT_TOKENS;
  const structured = overrides?.structured ?? false;
  const client = new OpenAI({ apiKey, maxRetries: 2 });

  // Map Chat Completions message list to Responses API format.
  // System message → `instructions` (top-level string).
  // All other messages → `input` array, with JSON-mode suffix on last user msg.
  const systemMsg = messages.find((m) => m.role === "system");
  const instructions =
    systemMsg && typeof systemMsg.content === "string"
      ? systemMsg.content
      : undefined;

  // buildResponsesAPIInput handles the JSON-mode suffix requirement.
  const inputItems = buildResponsesAPIInput(messages);

  // Reasoning effort — "none" is the GPT-5.4 default and disables reasoning entirely.
  const rawEffort = overrides?.reasoningEffort;
  const reasoningBlock: Record<string, unknown> = {};
  if (rawEffort) {
    reasoningBlock.effort = rawEffort;
  }
  if (overrides?.verbosity) {
    reasoningBlock.generate_summary = overrides.verbosity;
  }

  const createBody: Record<string, unknown> = {
    model,
    input: inputItems,
    ...(instructions ? { instructions } : {}),
    max_output_tokens: maxTokens,
    text: buildResponsesTextFormat(structured),
    ...(Object.keys(reasoningBlock).length > 0
      ? { reasoning: reasoningBlock }
      : {}),
    stream: false,
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const response = (await client.responses.create(createBody as any)) as {
    output_text?: string;
    output?: ResponsesAPIOutputItem[];
    usage?: { input_tokens?: number; output_tokens?: number };
  };

  // Prefer response.output_text — the SDK's first-class convenience accessor.
  let text = response.output_text ?? "";

  // Safety fallback: walk output items if output_text is empty.
  if (!text) {
    text = extractResponsesAPIText(response);
  }

  if (!text) {
    const outputTypes =
      (response.output ?? []).map((i) => i.type).join(", ") || "none";
    const outputTextStatus =
      response.output_text !== undefined ? "present but empty" : "absent";
    throw new Error(
      `OpenAI GPT-5 Responses API returned no usable text. ` +
        `output_text: ${outputTextStatus}. ` +
        `Output item types: [${outputTypes}]. ` +
        `reasoning.effort: ${rawEffort ?? "(default)"}. ` +
        `structured: ${structured}. ` +
        `Check model name "${model}" and API key access.`,
    );
  }

  console.log("[llm]", {
    backend: "openai",
    model,
    path: "responses-api-sdk",
    structured: structured || undefined,
    ...(rawEffort ? { reasoningEffort: rawEffort } : {}),
    ...(overrides?.verbosity ? { verbosity: overrides.verbosity } : {}),
    inputTokens: response.usage?.input_tokens ?? 0,
    outputTokens: response.usage?.output_tokens ?? 0,
  });

  return text;
}

async function callOpenAI(
  messages: OpenAI.ChatCompletionMessageParam[],
  overrides?: {
    model?: string;
    maxTokens?: number;
    temperature?: number;
    reasoningEffort?: OpenAIReasoningEffort;
    verbosity?: OpenAIVerbosity;
    structured?: boolean;
  },
): Promise<string> {
  const model = overrides?.model ?? getOpenAIModel();

  // GPT-5.x models require the Responses API — route before anything else.
  if (shouldUseResponsesAPI(model)) {
    return callOpenAIResponses(messages, overrides);
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured.");
  const temperature = overrides?.temperature ?? TEMPERATURE;
  const maxTokens = overrides?.maxTokens ?? MAX_OUTPUT_TOKENS;
  const client = new OpenAI({ apiKey, maxRetries: 2 });

  // GPT-5.x and o-series require max_completion_tokens instead of max_tokens.
  const tokenParamName = getOpenAITokenParamName(model);
  const tokenParam = { [tokenParamName]: maxTokens } as unknown as object;

  // GPT-5.x and o-series only support the default temperature (1).
  // Sending any other value causes a 400 error — omit the parameter entirely.
  const temperatureParam = isOpenAITemperatureFixed(model)
    ? {}
    : { temperature };

  // reasoning_effort is supported on o-series and GPT-5.x models.
  // "xhigh" is treated as "high" since the SDK enum only defines low/medium/high.
  const rawEffort = overrides?.reasoningEffort;
  const sdkEffort = rawEffort === "xhigh" ? "high" : rawEffort;
  const reasoningParam = sdkEffort
    ? ({ reasoning_effort: sdkEffort } as unknown as object)
    : {};

  const completion = await client.chat.completions.create({
    model,
    response_format: { type: "json_object" },
    messages,
    ...temperatureParam,
    ...tokenParam,
    ...reasoningParam,
  });
  const text = completion.choices[0]?.message?.content;
  if (!text) throw new Error("Empty response from OpenAI.");
  console.log("[llm]", {
    backend: "openai",
    model,
    tokenParam: tokenParamName,
    temperatureFixed: isOpenAITemperatureFixed(model) || undefined,
    ...(sdkEffort ? { reasoningEffort: sdkEffort } : {}),
    inputTokens: completion.usage?.prompt_tokens ?? 0,
    outputTokens: completion.usage?.completion_tokens ?? 0,
  });
  return text;
}

interface QualityResult {
  ok: boolean;
  issues: string[];
}

function validateReportQuality(
  report: Report,
): QualityResult {
  const issues: string[] = [];

  if (report.findings.length < QC_MIN_FINDINGS) {
    issues.push(
      `No findings produced — report is empty.`,
    );
  }

  const shallowFindings = report.findings.filter(
    (f) => f.shortWhy.length < QC_MIN_FIELD_LENGTH,
  );
  if (shallowFindings.length > 0) {
    issues.push(
      `${shallowFindings.length} finding(s) have shallow shortWhy (< ${QC_MIN_FIELD_LENGTH} chars).`,
    );
  }

  if (report.findings.length > 0 && report.clauseCards.length < QC_MIN_CLAUSE_CARDS) {
    issues.push(
      `Findings exist but no clause cards were produced.`,
    );
  }

  const shallowExcerpts = report.clauseCards.filter(
    (c) => c.originalTextExcerpt.length < QC_MIN_FIELD_LENGTH,
  );
  if (shallowExcerpts.length > 0) {
    issues.push(
      `${shallowExcerpts.length} clause card(s) have shallow originalTextExcerpt.`,
    );
  }

  const jsonLen = JSON.stringify(report).length;
  if (report.findings.length > 0 && jsonLen < QC_MIN_REPORT_JSON_LENGTH) {
    issues.push(
      `Report JSON suspiciously short (${jsonLen} chars) despite having findings.`,
    );
  }

  if (report.findings.length >= 3) {
    const whys = report.findings.map((f) => f.shortWhy.toLowerCase().trim());
    const counts = new Map<string, number>();
    for (const w of whys) counts.set(w, (counts.get(w) ?? 0) + 1);
    const dupes = [...counts.values()].filter((n) => n >= 3);
    if (dupes.length > 0) {
      issues.push(
        "Findings appear repetitive; increase specificity.",
      );
    }
  }

  return { ok: issues.length === 0, issues };
}

/** True when the short single-pass pipeline should fall back to chunked analysis. */
export function isShortDocTimeoutRecoverable(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  if ((err as Record<string, unknown>).code === "TRUNCATED_OUTPUT") {
    return false;
  }
  const msg = err.message.toLowerCase();
  return isTransientTransportError(err) || msg.includes("timed out");
}

export async function runReportAnalysis(
  input: AnalysisInput,
  options?: AnalysisOptions,
): Promise<Report> {
  if (process.env.PLAINTERMS_LLM_MODE === "mock") {
    const report: Report = JSON.parse(JSON.stringify(MOCK_REPORT));
    report.id = "generated";
    report.createdAtISO = new Date().toISOString();
    console.log("[llm] mock mode — returning fixture report");
    return report;
  }

  const totalDocChars = input.chunks.reduce((s, c) => s + c.length, 0);
  const chunkCount = input.chunkCount ?? input.chunks.length;

  if (shouldUseLargeDocPipeline(totalDocChars, chunkCount)) {
    console.log("[llm] routing to large-doc-mode", {
      totalDocChars,
      threshold: LARGE_DOC_THRESHOLD_CHARS,
      nearThresholdChars: LARGE_DOC_NEAR_THRESHOLD_CHARS,
      chunkCount,
    });
    return runLargeDocAnalysis(input, options);
  }

  const runShortDocPipeline = async (): Promise<Report> => {
  const backend = options?.backend ?? getBackend();
  const effectiveMaxTokens = options?.maxOutputTokens ?? MAX_OUTPUT_TOKENS;
  const effectiveTemp = options?.temperature ?? TEMPERATURE;
  const oaiOverrides = {
    model: options?.model,
    maxTokens: effectiveMaxTokens,
    temperature: effectiveTemp,
    reasoningEffort: options?.openaiReasoningEffort,
    verbosity: options?.openaiVerbosity,
    structured: options?.openaiStructured,
  };

  const resolvedModel = options?.model ??
    (backend === "anthropic"
      ? (process.env.PLAINTERMS_ANTHROPIC_MODEL ?? "claude-opus-4-6")
      : getOpenAIModel());
  const maxInputChars = getMaxInputChars(backend, resolvedModel);
  const { chunks: chunksToSend, isPartial } = selectChunks(
    input.chunks,
    maxInputChars,
  );

  if (isPartial) {
    console.log("[llm] truncation", {
      backend,
      model: resolvedModel,
      totalInputChars: input.chunks.reduce((s, c) => s + c.length, 0),
      maxInputChars,
      chunksTotal: input.chunks.length,
      chunksSent: chunksToSend.length,
    });
  }

  const totalInputChars = chunksToSend.reduce((s, c) => s + c.length, 0);

  const familyPolicy = resolveContractPolicy(
    undefined, // contractFamily is model-inferred — we use the type hint
    input.contractTypeHint,
  );
  const systemContent =
    SYSTEM_PROMPT +
    buildLocaleInstruction(input.locale) +
    "\n\n" +
    familyPolicy.instruction +
    buildCompactOutputInstruction(totalInputChars);

  let userContent = "";
  if (input.title) {
    userContent += `Document title: ${input.title}\n`;
  }
  userContent += `Source type: ${input.sourceType}\n`;
  if (input.locale) {
    userContent += `Locale: ${input.locale}\n`;
  }
  const contextParts: string[] = [];
  if (input.audienceContext) contextParts.push(`Audience: ${input.audienceContext}`);
  if (input.jurisdictionContext) contextParts.push(`Jurisdiction: ${input.jurisdictionContext}`);
  if (input.contractTypeHint) contextParts.push(`Contract type: ${input.contractTypeHint}`);
  if (contextParts.length > 0) {
    userContent += `User context: ${contextParts.join(" | ")}\n`;
  }
  if (input.personalContext) {
    userContent += `Personal context (use to prioritise and tailor, NOT as evidence about the contract): ${input.personalContext}\n`;
  }
  if (input.question) {
    userContent += `USER QUESTION: ${input.question}\n`;
    userContent += `(You MUST populate "userQuestion" with this question verbatim and "userAnswer" with a direct 3-6 sentence answer citing at least one clause excerpt from the document.)\n`;
  }
  if (isPartial) {
    userContent += `Note: Document was truncated for processing. Included: start+middle+end. Focus on cross-section interactions.\n`;
  }
  userContent += `\n--- DOCUMENT TEXT ---\n\n`;
  userContent += chunksToSend.join("\n---\n");

  let responseText: string;
  let anthropicMeta: AnthropicResult | undefined;
  if (backend === "anthropic") {
    const result = await anthropicGenerateText({
      system: systemContent,
      user: userContent,
      maxTokens: effectiveMaxTokens,
      temperature: effectiveTemp,
      model: options?.model,
    });
    responseText = result.text;
    anthropicMeta = result;
  } else {
    responseText = await callOpenAI([
      { role: "system", content: systemContent },
      { role: "user", content: userContent },
    ], oaiOverrides);
  }
  responseText = extractJson(responseText);
  console.log("[llm]", {
    backend,
    fingerprintLast4: input.fingerprint.slice(-4),
    chunksSent: chunksToSend.length,
  });

  let report: Report;
  try {
    report = parseReportJson(patchReportDefaults(responseText));
  } catch (parseErr) {
    // Detect whether this is a truncation/incomplete-JSON situation.
    const likelyIncomplete = isLikelyIncompleteJson(responseText);
    const providerTruncation =
      backend === "anthropic" &&
      (anthropicMeta?.stopReason === "max_tokens" ||
        (anthropicMeta?.usage?.outputTokens != null &&
          anthropicMeta.usage.outputTokens >= effectiveMaxTokens - 50));
    const isTruncation =
      (providerTruncation || likelyIncomplete) &&
      parseErr instanceof SyntaxError;

    if (!isTruncation) {
      const err =
        parseErr instanceof Error ? parseErr : new Error(String(parseErr));
      if (anthropicMeta) {
        (err as unknown as Record<string, unknown>).anthropicDebug = {
          stopReason: anthropicMeta.stopReason,
          ...anthropicMeta.usage,
        };
      }
      throw err;
    }

    // --- JSON RESCUE PASS (cheap, no full document resend) ---
    // Send only the partial JSON to the same model and ask it to
    // complete/repair into valid JSON. This is much cheaper than
    // resending the entire 60K+ token document.
    const partialJson = responseText.slice(0, RESCUE_MAX_PARTIAL_CHARS);
    const rescueMaxTokens = Math.min(effectiveMaxTokens, 8192);

    console.log("[llm] json-rescue", {
      backend,
      model: resolvedModel,
      stopReason: anthropicMeta?.stopReason ?? "syntax_error",
      outputTokens: anthropicMeta?.usage?.outputTokens,
      partialJsonLen: responseText.length,
      rescueInputLen: partialJson.length,
      rescueMaxTokens,
    });

    const rescueSystem =
      "You are a JSON repair assistant. You receive an incomplete JSON object that was truncated mid-output. " +
      "Your ONLY job is to complete it into valid JSON. " +
      "Rules:\n" +
      "- Output ONLY valid JSON. No markdown, no commentary, no text before or after.\n" +
      "- Preserve all existing content exactly as-is.\n" +
      "- Close any open strings, arrays, and objects.\n" +
      "- If arrays were clearly in progress, add a minimal closing entry if needed then close the array.\n" +
      "- Do NOT invent new findings or data — only finish what was started.\n" +
      "- The result must be a single JSON object with keys: verdict, findings, clauseCards, actions.\n" +
      "- Be concise in any text you must generate to close structures.";

    const rescueUser =
      "The following JSON was truncated mid-output. Complete it into valid JSON:\n\n" +
      partialJson;

    try {
      let rescueText: string;
      if (backend === "anthropic") {
        const rescueResult = await anthropicGenerateText({
          system: rescueSystem,
          user: rescueUser,
          maxTokens: rescueMaxTokens,
          temperature: 0,
          model: options?.model,
        });
        rescueText = rescueResult.text;
      } else {
        rescueText = await callOpenAI([
          { role: "system", content: rescueSystem },
          { role: "user", content: rescueUser },
        ], { ...oaiOverrides, maxTokens: rescueMaxTokens, temperature: 0 });
      }

      rescueText = extractJson(rescueText);
      report = parseReportJson(patchReportDefaults(rescueText));
      console.log("[llm] json-rescue succeeded", {
        findings: report.findings.length,
        clauseCards: report.clauseCards.length,
      });
    } catch (rescueErr) {
      const err = new Error(
        `Report generation failed: model output was truncated (${responseText.length} chars) and JSON rescue could not recover. ` +
        `Stop reason: ${anthropicMeta?.stopReason ?? "unknown"}. ` +
        `Output tokens: ${anthropicMeta?.usage?.outputTokens ?? "unknown"}.`,
      );
      (err as unknown as Record<string, unknown>).code = "TRUNCATED_OUTPUT";
      (err as unknown as Record<string, unknown>).rescueError =
        rescueErr instanceof Error ? rescueErr.message : String(rescueErr);
      throw err;
    }
  }

  const maxRetries = options?.maxRetries ??
    (parseInt(process.env.PLAINTERMS_LLM_MAX_RETRIES ?? "1", 10) || 1);
  const quality = validateReportQuality(report);

  if (!quality.ok && maxRetries > 0) {
    console.log("[llm] quality gate failed, retrying", {
      issueCount: quality.issues.length,
      issues: quality.issues,
      inputCharCount: totalInputChars,
    });

    const issueBlock =
      `Issues:\n${quality.issues.map((i) => `- ${i}`).join("\n")}`;

    const revisionRules =
      `CRITICAL: Output ONLY a single JSON object. No markdown, no code fences, no explanations, no text before or after the JSON.\n` +
      `Use the previous JSON as the base. Keep the EXACT same field names (camelCase). Do not rename or remove any required fields. Only expand or add items to satisfy the issues listed above.\n` +
      `Include only materially distinct findings supported by the document text. Do not add filler.\n` +
      `Improve specificity, add grounded excerpts from the document, avoid boilerplate, ` +
      `tailor letter templates to the actual findings, and label uncertain points as "Needs confirmation".`;

    let revisionContent: string;
    if (responseText.length > QC_RETRY_JSON_CAP) {
      revisionContent =
        `The previous report had quality issues. Fix them and return ONLY the revised JSON (same schema).\n\n` +
        `${issueBlock}\n\n` +
        `Previous report summary: ${report.findings.length} findings, ${report.clauseCards.length} clause cards.\n` +
        `Previous JSON omitted due to length; regenerate a corrected report from the document while preserving the schema.\n\n` +
        revisionRules;
    } else {
      revisionContent =
        `The previous report had quality issues. Fix them and return ONLY the revised JSON (same schema).\n\n` +
        `${issueBlock}\n\n` +
        revisionRules + `\n\n` +
        `Previous report JSON:\n${responseText}`;
    }

    let retryRaw: string | undefined;
    try {
      if (backend === "anthropic") {
        const retryUser =
          responseText.length > QC_RETRY_JSON_CAP
            ? `${userContent}\n\n${revisionContent}`
            : `${userContent}\n\n[Previous response]\n${responseText}\n\n${revisionContent}`;
        retryRaw = (await anthropicGenerateText({
          system: systemContent,
          user: retryUser,
          maxTokens: effectiveMaxTokens,
          temperature: effectiveTemp,
          model: options?.model,
        })).text;
      } else {
        const retryMessages: OpenAI.ChatCompletionMessageParam[] =
          responseText.length > QC_RETRY_JSON_CAP
            ? [
                { role: "system", content: systemContent },
                { role: "user", content: userContent },
                { role: "user", content: revisionContent },
              ]
            : [
                { role: "system", content: systemContent },
                { role: "user", content: userContent },
                { role: "assistant", content: responseText },
                { role: "user", content: revisionContent },
              ];
        retryRaw = await callOpenAI(retryMessages, oaiOverrides);
      }
    } catch {
      console.log("[llm] retry call failed, using original report");
    }

    if (retryRaw) {
      console.log("[llm] retry completed");
      const retryExtracted = extractJson(retryRaw);
      try {
        report = parseReportJson(patchReportDefaults(retryExtracted));
      } catch (err: unknown) {
        const isZod =
          err != null &&
          typeof err === "object" &&
          "issues" in err &&
          Array.isArray(
            (err as { issues: unknown[] }).issues,
          );
        let reason = "unknown";
        if (isZod) {
          const issues = (
            err as {
              issues: { path: (string | number)[]; message: string }[];
            }
          ).issues;
          reason =
            issues.length > 0
              ? `${issues[0].path.join(".")}: ${issues[0].message}`
              : "zod validation failed";
        } else if (err instanceof SyntaxError) {
          reason = "invalid JSON";
        }
        console.log("[llm] retry parse failed, using original report", {
          errorType: isZod ? "zod" : "json",
          extractedLength: retryExtracted.length,
          reason,
        });
      }
    }
  }

  report.id = "generated";
  report.createdAtISO = new Date().toISOString();
  report.isPreview = false;
  report.paywalledFindingsCount = 0;

  normalizeReportText(report);
  return report;
  };

  try {
    return await runShortDocPipeline();
  } catch (err) {
    if (!isShortDocTimeoutRecoverable(err)) throw err;
    console.warn(
      "[llm] short-doc path hit timeout or transport error; falling back to large-doc pipeline",
      {
        fingerprintLast4: input.fingerprint.slice(-4),
        totalDocChars,
        chunkCount,
        message: err instanceof Error ? err.message : String(err),
      },
    );
    try {
      return await runLargeDocAnalysis(input, options);
    } catch (fallbackErr) {
      const wrapped = new Error(
        fallbackErr instanceof Error
          ? fallbackErr.message
          : String(fallbackErr),
      );
      (wrapped as Record<string, unknown>).code =
        "ANALYSIS_TIMEOUT_FALLBACK_FAILED";
      (wrapped as Record<string, unknown>).userMessage =
        "We switched to a slower, section by section review, but it still did not finish. Please try again in a little while.";
      throw wrapped;
    }
  }
}

function normalizeReportText(r: Report): void {
  const n = normalizeLlmOutput;
  r.verdict.headline = n(r.verdict.headline);
  r.verdict.summary = n(r.verdict.summary);
  if (r.userAnswer) r.userAnswer = n(r.userAnswer);
  for (const f of r.findings) {
    f.title = n(f.title);
    f.shortWhy = n(f.shortWhy);
  }
  for (const c of r.clauseCards) {
    c.atFirstGlance = n(c.atFirstGlance);
    c.whatItMeans = n(c.whatItMeans);
    c.scenario = n(c.scenario);
    c.originalTextExcerpt = n(c.originalTextExcerpt);
  }
  for (const t of r.actions.letterTemplates) {
    t.body = n(t.body);
  }
}

// ===========================================================================
// LARGE DOCUMENT PIPELINE (2-stage: extract → synthesize)
// ===========================================================================

const EXTRACTION_BATCH_SIZE = 4;
const EXTRACTION_MAX_CONCURRENT = 3;
export const EXTRACTION_MAX_OUTPUT_TOKENS = 3000;
export const EXTRACTION_RETRY_OUTPUT_TOKENS = 5000;
const EXTRACTION_MAX_RETRIES = 2;
const EXTRACTION_BACKOFF_MS = [1000, 3000];
/** @deprecated No longer used as a hard cap. Kept for export/test compatibility. */
export const MAX_CANONICAL_ISSUES_PER_SECTION = 8;

export const TOP_ISSUES_LIMIT = 10;

export function computeTopIssues(findings: Finding[]): Finding[] {
  return rankFindings(findings).slice(0, TOP_ISSUES_LIMIT);
}

export function buildAllIssuesBySection(findings: Finding[]): SectionIssues[] {
  const groups = new Map<string, Finding[]>();
  for (const f of findings) {
    const label = f.sectionLabel ?? "Other";
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label)!.push(f);
  }
  return Array.from(groups.entries()).map(([sectionLabel, issues]) => ({
    sectionLabel,
    issues,
  }));
}

export interface ChunkIssue {
  clauseLabel: string;
  excerpt: string;
  shortWhy: string;
  severity: string;
  tags: string[];
  impactType: string;
  actionTiming: string;
  decisionRelevance: string;
  mechanismType?: string;
}

export interface SectionSummary {
  sectionLabel: string;
  coverageStatus: "complete" | "partial" | "failed";
  sourceChunkCount: number;
  rawIssueCount: number;
  canonicalIssues: Array<{
    title: string;
    severity: "info" | "low" | "medium" | "high" | "critical";
    shortWhy: string;
    clauseLabel: string;
    excerpt: string;
    tags: string[];
    impactType: string;
    actionTiming: string;
    decisionRelevance: string;
    mechanismType?: string;
  }>;
}

const SEVERITY_RANK: Record<string, number> = {
  critical: 5, high: 4, medium: 3, low: 2, info: 1,
};

const RELEVANCE_RANK: Record<string, number> = {
  "decision-critical": 4, important: 3, monitor: 2, background: 1,
};

function normalizeTitle(s: string): string {
  return s.toLowerCase().replace(/[-–—]/g, " ").replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim();
}

export function buildSectionSummaries(
  issuesByBatch: Map<number, ChunkIssue[]>,
  sections: { label: string; chunkIndices: number[] }[] | undefined,
  batchSize: number,
  totalBatches: number,
  failedBatchIndices: Set<number>,
  totalChunkCount: number,
): SectionSummary[] {
  const allIssues: ChunkIssue[] = [];
  for (let bi = 0; bi < totalBatches; bi++) {
    allIssues.push(...(issuesByBatch.get(bi) ?? []));
  }

  if (!sections || sections.length === 0) {
    const cov = failedBatchIndices.size > 0 ? "partial" as const : "complete" as const;
    return [{
      sectionLabel: "Full document",
      coverageStatus: cov,
      sourceChunkCount: totalChunkCount,
      rawIssueCount: allIssues.length,
      canonicalIssues: deduplicateAndCap(allIssues),
    }];
  }

  // Build chunk→batch mapping
  const chunkToBatchIdx = new Map<number, number>();
  let chunkIdx = 0;
  for (let bi = 0; bi < totalBatches; bi++) {
    const batchChunkCount = Math.min(batchSize, totalChunkCount - bi * batchSize);
    for (let c = 0; c < batchChunkCount; c++) {
      chunkToBatchIdx.set(chunkIdx++, bi);
    }
  }

  // Assign each batch to exactly ONE section (the first section that contains
  // any of the batch's chunks). This prevents boundary batches from inflating
  // canonical counts by appearing in multiple sections.
  const batchToSection = new Map<number, number>();
  for (let si = 0; si < sections.length; si++) {
    for (const ci of sections[si].chunkIndices) {
      const bi = chunkToBatchIdx.get(ci);
      if (bi !== undefined && !batchToSection.has(bi)) {
        batchToSection.set(bi, si);
      }
    }
  }

  const summaries: SectionSummary[] = [];
  for (let si = 0; si < sections.length; si++) {
    const section = sections[si];

    // Collect batches assigned to this section
    const sectionBatchIndices = new Set<number>();
    for (const [bi, assignedSi] of batchToSection) {
      if (assignedSi === si) sectionBatchIndices.add(bi);
    }

    const sectionIssues: ChunkIssue[] = [];
    let hasFailed = false;
    let hasSuccess = false;
    for (const bi of sectionBatchIndices) {
      if (failedBatchIndices.has(bi)) {
        hasFailed = true;
      } else {
        hasSuccess = true;
        sectionIssues.push(...(issuesByBatch.get(bi) ?? []));
      }
    }

    // Also check if any chunk in this section belongs to a failed batch
    // that was assigned elsewhere (for coverage status accuracy)
    for (const ci of section.chunkIndices) {
      const bi = chunkToBatchIdx.get(ci);
      if (bi !== undefined && failedBatchIndices.has(bi)) {
        hasFailed = true;
      }
    }

    let cov: "complete" | "partial" | "failed";
    if (!hasSuccess && sectionBatchIndices.size > 0) cov = "failed";
    else if (hasFailed) cov = "partial";
    else if (sectionBatchIndices.size === 0) cov = "failed";
    else cov = "complete";

    summaries.push({
      sectionLabel: section.label,
      coverageStatus: cov,
      sourceChunkCount: section.chunkIndices.length,
      rawIssueCount: sectionIssues.length,
      canonicalIssues: deduplicateAndCap(sectionIssues),
    });
  }

  return summaries;
}

function deduplicateAndCap(issues: ChunkIssue[]): SectionSummary["canonicalIssues"] {
  const seen = new Map<string, SectionSummary["canonicalIssues"][0]>();

  for (const issue of issues) {
    const titlePart = normalizeTitle(issue.clauseLabel || issue.shortWhy);
    if (!titlePart) continue;

    const mechanism = issue.mechanismType || "other";
    const key = `${titlePart}::${mechanism}`;

    const candidate: SectionSummary["canonicalIssues"][0] = {
      title: issue.clauseLabel,
      severity: (issue.severity as SectionSummary["canonicalIssues"][0]["severity"]) || "medium",
      shortWhy: issue.shortWhy,
      clauseLabel: issue.clauseLabel,
      excerpt: issue.excerpt,
      tags: issue.tags ?? [],
      impactType: issue.impactType ?? "other",
      actionTiming: issue.actionTiming ?? "before-signing",
      decisionRelevance: issue.decisionRelevance ?? "important",
      mechanismType: mechanism,
    };

    const existing = seen.get(key);
    if (!existing) {
      seen.set(key, candidate);
    } else {
      if ((SEVERITY_RANK[candidate.severity] ?? 0) > (SEVERITY_RANK[existing.severity] ?? 0)) {
        seen.set(key, candidate);
      }
    }
  }

  const sorted = [...seen.values()].sort((a, b) => {
    const relDiff = (RELEVANCE_RANK[b.decisionRelevance] ?? 0) - (RELEVANCE_RANK[a.decisionRelevance] ?? 0);
    if (relDiff !== 0) return relDiff;
    return (SEVERITY_RANK[b.severity] ?? 0) - (SEVERITY_RANK[a.severity] ?? 0);
  });

  return sorted;
}

const EXTRACTION_SYSTEM_PROMPT = `You are a contract clause extraction assistant. Identify consumer-relevant issues in the provided contract text.

WHAT TO LOOK FOR — priority order:
1. Money risk — charges, fees, price increases, penalties, hidden costs, deductible surprises
2. Service/access loss — coverage denial, benefit exclusions, suspension triggers
3. Rights restrictions — liability caps, forced arbitration, class-action waivers, shortened limitation periods
4. Deadline/notice traps — cancellation windows, auto-renewal, notice-period requirements
5. Linked agreements — bundled contracts, cross-penalty triggers
6. Usage restrictions — fair use caps, throttling, data limits
7. Data/privacy — data sharing, credit reporting, consent-by-use
8. Operational traps — auto price increases, billing changes, "continued use = acceptance"

For each issue output a compact JSON object:
- clauseLabel: short clause name (max 8 words)
- excerpt: relevant quote from the text (max 150 chars, must be from the actual text)
- shortWhy: one sentence — why this matters to a consumer
- severity: info|low|medium|high|critical
- tags: array from [TimeTrap,EscapeHatch,PenaltyDisguise,SoleDiscretion,SilentWaiver,BurdenShift,SurpriseBilling,DataGrab,AutoRenew,LiabilityWaiver,ForcedArbitration,DamagesCap,ShortenedLimitations,UncappedFees,UnilateralChange]
- impactType: cost|service-loss|cancellation|renewal|coverage|billing|usage-restriction|privacy|weak-remedy|linked-agreement|admin-trap|other
- actionTiming: before-signing|before-renewal|before-cancellation|before-claim|if-problem-occurs|ongoing|info-only
- decisionRelevance: decision-critical|important|monitor|background
- mechanismType: arbitration|class_action_waiver|subrogation_reimbursement|coordination_of_benefits|prior_authorization|medical_necessity_discretion|network_limitation|step_therapy|appeal_deadline|termination_rescission|premium_rate_change|other — the specific legal or contractual mechanism. Use "other" only when no specific type fits.

Output ONLY: {"issues":[...]}
No markdown. No commentary. No text outside the JSON.
Skip standard boilerplate. Focus on genuinely problematic or surprising clauses.
If no issues in this text, return {"issues":[]}.`;

interface ExtractionResult {
  issues: ChunkIssue[];
  truncated: boolean;
}

async function extractChunkBatchOnce(
  chunks: string[],
  contextHeader: string,
  backend: "openai" | "anthropic",
  maxTokens: number,
  options?: AnalysisOptions,
): Promise<ExtractionResult> {
  const effectiveTemp = options?.temperature ?? TEMPERATURE;
  const model =
    options?.model ??
    (backend === "anthropic"
      ? (process.env.PLAINTERMS_ANTHROPIC_MODEL ?? "claude-opus-4-6")
      : getOpenAIModel());

  const userContent =
    contextHeader +
    "\n\n--- CONTRACT TEXT ---\n\n" +
    chunks.join("\n---\n");

  let responseText: string;
  let stopReason: string | undefined;

  if (backend === "anthropic") {
    const result = await anthropicGenerateText({
      system: EXTRACTION_SYSTEM_PROMPT,
      user: userContent,
      maxTokens,
      temperature: effectiveTemp,
      model,
    });
    responseText = result.text;
    stopReason = result.stopReason;
  } else {
    responseText = await callOpenAI(
      [
        { role: "system", content: EXTRACTION_SYSTEM_PROMPT },
        { role: "user", content: userContent },
      ],
      {
        model: options?.model,
        maxTokens,
        temperature: effectiveTemp,
        reasoningEffort: options?.openaiReasoningEffort,
      },
    );
  }

  const extracted = extractJson(responseText);
  const truncated = stopReason === "max_tokens" || isLikelyIncompleteJson(extracted);

  if (truncated) {
    const err = new Error(
      `Extraction truncated (stopReason=${stopReason ?? "incomplete_json"}, maxTokens=${maxTokens})`,
    );
    (err as Record<string, unknown>).truncated = true;
    throw err;
  }

  const json = JSON.parse(extracted);
  return { issues: Array.isArray(json.issues) ? json.issues : [], truncated: false };
}

export function classifyExtractionError(err: unknown): "truncation" | "transport" | "parse" | "unknown" {
  if (err instanceof Error) {
    if ((err as Record<string, unknown>).truncated === true) return "truncation";
    if (isTransientTransportError(err)) return "transport";
    if (err instanceof SyntaxError || err.message.includes("JSON")) return "parse";
  }
  return "unknown";
}

async function extractChunkBatchWithRetry(
  chunks: string[],
  contextHeader: string,
  backend: "openai" | "anthropic",
  batchIndex: number,
  options?: AnalysisOptions,
): Promise<{ issues: ChunkIssue[]; failed: boolean }> {
  const maxAttempts = 1 + EXTRACTION_MAX_RETRIES;
  let lastTruncated = false;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const budget = (attempt > 1 && lastTruncated)
      ? EXTRACTION_RETRY_OUTPUT_TOKENS
      : EXTRACTION_MAX_OUTPUT_TOKENS;

    console.log("[llm] stage1 batch attempt", {
      batchIndex,
      attempt,
      maxOutputTokens: budget,
      ...(attempt > 1 && lastTruncated ? { reason: "truncation_retry_with_higher_budget" } : {}),
    });

    try {
      const result = await extractChunkBatchOnce(chunks, contextHeader, backend, budget, options);
      console.log("[llm] stage1 batch result", {
        batchIndex,
        attempt,
        result: "ok",
        issueCount: result.issues.length,
        budget,
      });
      return { issues: result.issues, failed: false };
    } catch (err) {
      const errorClass = classifyExtractionError(err);
      const msg = err instanceof Error ? err.message : "unknown";
      console.log("[llm] stage1 batch result", {
        batchIndex,
        attempt,
        result: "error",
        errorClass,
        error: msg,
        budget,
      });

      if (errorClass === "truncation") {
        lastTruncated = true;
      }

      if (attempt < maxAttempts) {
        const delay = EXTRACTION_BACKOFF_MS[attempt - 1] ?? 3000;
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }
  return { issues: [], failed: true };
}

async function runLargeDocAnalysis(
  input: AnalysisInput,
  options?: AnalysisOptions,
): Promise<Report> {
  const backend = options?.backend ?? getBackend();
  const resolvedModel =
    options?.model ??
    (backend === "anthropic"
      ? (process.env.PLAINTERMS_ANTHROPIC_MODEL ?? "claude-opus-4-6")
      : getOpenAIModel());
  const effectiveTemp = options?.temperature ?? TEMPERATURE;

  // --- Section-based chunk filtering ---
  const sections = input.sections;
  const selectedIdx = input.selectedSectionIndices;
  const allSectionsSelected =
    !sections ||
    !selectedIdx ||
    selectedIdx.length === 0 ||
    selectedIdx.length === sections.length;

  let chunksToAnalyze: string[];
  let coverageStatus: import("@/types/report").CoverageStatus;

  if (sections && !allSectionsSelected) {
    const allowedChunkSet = new Set<number>();
    for (const si of selectedIdx!) {
      if (si >= 0 && si < sections.length) {
        for (const ci of sections[si].chunkIndices) allowedChunkSet.add(ci);
      }
    }
    chunksToAnalyze = input.chunks.filter((_, i) => allowedChunkSet.has(i));

    const analyzedLabels = selectedIdx!
      .filter((si) => si >= 0 && si < sections.length)
      .map((si) => sections[si].label);
    const skippedLabels = sections
      .filter((_, i) => !selectedIdx!.includes(i))
      .map((s) => s.label);

    coverageStatus = {
      mode: "selected-sections",
      analyzedSections: analyzedLabels,
      skippedSections: skippedLabels,
    };
  } else {
    chunksToAnalyze = input.chunks;
    coverageStatus = {
      mode: "full",
      analyzedSections: sections ? sections.map((s) => s.label) : [],
      skippedSections: [],
    };
  }

  const totalChars = chunksToAnalyze.reduce((s, c) => s + c.length, 0);

  console.log("[llm] large-doc-mode started", {
    backend,
    model: resolvedModel,
    totalChunks: chunksToAnalyze.length,
    totalChars,
    coverageMode: coverageStatus.mode,
    analyzedSections: coverageStatus.analyzedSections.length,
    skippedSections: coverageStatus.skippedSections.length,
  });

  // --- Stage 1: chunk-level extraction ---

  const contextParts: string[] = [];
  if (input.audienceContext)
    contextParts.push(`Audience: ${input.audienceContext}`);
  if (input.jurisdictionContext)
    contextParts.push(`Jurisdiction: ${input.jurisdictionContext}`);
  if (input.contractTypeHint)
    contextParts.push(`Contract type: ${input.contractTypeHint}`);

  let contextHeader = "";
  if (contextParts.length > 0) {
    contextHeader = `Context: ${contextParts.join(" | ")}`;
  }
  if (input.personalContext) {
    contextHeader += `\nPersonal context (use for prioritisation only): ${input.personalContext}`;
  }

  const batches: string[][] = [];
  for (let i = 0; i < chunksToAnalyze.length; i += EXTRACTION_BATCH_SIZE) {
    batches.push(chunksToAnalyze.slice(i, i + EXTRACTION_BATCH_SIZE));
  }

  console.log("[llm] large-doc-mode stage-1 started", {
    batchCount: batches.length,
    batchSize: EXTRACTION_BATCH_SIZE,
    maxRetries: EXTRACTION_MAX_RETRIES,
  });

  const issuesByBatch = new Map<number, ChunkIssue[]>();
  let failedBatchCount = 0;
  const failedBatchIndices = new Set<number>();

  for (let i = 0; i < batches.length; i += EXTRACTION_MAX_CONCURRENT) {
    const concurrentSlice = batches.slice(i, i + EXTRACTION_MAX_CONCURRENT);
    const results = await Promise.allSettled(
      concurrentSlice.map((batch, j) =>
        extractChunkBatchWithRetry(batch, contextHeader, backend, i + j, options),
      ),
    );
    for (let j = 0; j < results.length; j++) {
      const batchIdx = i + j;
      const r = results[j];
      if (r.status === "fulfilled") {
        issuesByBatch.set(batchIdx, r.value.issues);
        if (r.value.failed) {
          failedBatchCount++;
          failedBatchIndices.add(batchIdx);
        }
      } else {
        failedBatchCount++;
        failedBatchIndices.add(batchIdx);
        issuesByBatch.set(batchIdx, []);
      }
    }
  }

  const allIssues: ChunkIssue[] = [];
  for (let bi = 0; bi < batches.length; bi++) {
    allIssues.push(...(issuesByBatch.get(bi) ?? []));
  }

  console.log("[llm] large-doc-mode stage-1 completed", {
    batchCount: batches.length,
    failedBatchCount,
    totalCandidates: allIssues.length,
  });

  if (allIssues.length === 0) {
    throw new Error(
      "Large document analysis found no extractable issues. " +
        "The document may not contain identifiable consumer contract terms.",
    );
  }

  // --- Canonical merge: group and deduplicate by section ---

  const sectionSummaries = buildSectionSummaries(
    issuesByBatch,
    sections,
    EXTRACTION_BATCH_SIZE,
    batches.length,
    failedBatchIndices,
    chunksToAnalyze.length,
  );

  const perSectionCanonicalSum = sectionSummaries.reduce(
    (s, sec) => s + sec.canonicalIssues.length, 0,
  );

  // Compute globally unique count: deduplicate across all sections to get
  // a true unique count (no inflation from boundary batches).
  const globalDeduped = deduplicateAndCap(allIssues);
  const totalCanonicalIssues = globalDeduped.length;

  console.log("[llm] large-doc-mode canonical merge", {
    rawCandidates: allIssues.length,
    sectionCount: sectionSummaries.length,
    totalCanonicalIssuesUnique: totalCanonicalIssues,
    perSectionSum: perSectionCanonicalSum,
    inflationCorrected: perSectionCanonicalSum !== totalCanonicalIssues,
    sectionCoverage: sectionSummaries.map((s) => ({
      label: s.sectionLabel,
      status: s.coverageStatus,
      issues: s.canonicalIssues.length,
    })),
  });

  // ==========================================================================
  // Stage 2: HIERARCHICAL SECTION-BASED SYNTHESIS
  // Instead of one giant monolithic synthesis call for all canonical issues,
  // we synthesize per-section, then combine in code, then do one small
  // verdict/actions pass.
  // ==========================================================================

  const familyPolicy = resolveContractPolicy(
    undefined,
    input.contractTypeHint,
  );

  // --- Shared LLM call helper with transport retry + streaming for long requests ---

  async function callSynthesis(
    system: string,
    user: string,
    maxTokens: number,
    label?: string,
  ): Promise<{ text: string; stopReason?: string }> {
    const isLongRequest = maxTokens >= GROUP_SYNTH_STREAM_THRESHOLD;
    const tag = label ?? "synthesis";

    console.log("[llm] stage2 callSynthesis", {
      tag,
      backend,
      maxTokens,
      isLongRequest,
      stream: isLongRequest && backend === "anthropic",
    });

    const attempt = async (): Promise<{ text: string; stopReason?: string }> => {
      if (backend === "anthropic") {
        const result = await anthropicGenerateText({
          system,
          user,
          maxTokens,
          temperature: effectiveTemp,
          model: resolvedModel,
          stream: isLongRequest,
          timeoutMs: isLongRequest ? 300_000 : 120_000,
        });
        return { text: result.text, stopReason: result.stopReason };
      }
      const text = await callOpenAI(
        [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        {
          model: options?.model,
          maxTokens,
          temperature: effectiveTemp,
          reasoningEffort: options?.openaiReasoningEffort,
          verbosity: options?.openaiVerbosity,
          structured: options?.openaiStructured,
        },
      );
      return { text, stopReason: undefined };
    };

    try {
      return await attempt();
    } catch (err) {
      if (isTransientTransportError(err)) {
        const msg = err instanceof Error ? err.message : "unknown";
        console.log("[llm] stage2 transient transport failure, retrying once", {
          tag,
          error: msg,
          isLongRequest,
        });
        await new Promise((r) => setTimeout(r, 2000));
        return await attempt();
      }
      throw err;
    }
  }

  // -----------------------------------------------------------------------
  // Stage 2a: per-section synthesis
  // -----------------------------------------------------------------------

  console.log("[llm] large-doc stage-2a started (per-section synthesis)", {
    sectionCount: sectionSummaries.length,
    totalCanonicalIssues,
  });

  const sectionSynthSystem = buildGroupSynthesisSystemPrompt(
    input.locale,
    familyPolicy.instruction,
  );

  const sectionSynthResults = await runPerSectionSynthesis(
    sectionSummaries,
    sectionSynthSystem,
    {
      title: input.title,
      sourceType: input.sourceType,
      locale: input.locale,
      contextParts,
      personalContext: input.personalContext,
    },
    callSynthesis,
  );

  const mergedFindings: Finding[] = [];
  const mergedClauseCards: import("@/types/report").ClauseCard[] = [];
  let sectionSynthFailures = 0;

  for (const sr of sectionSynthResults) {
    if (sr.findings.length > 0) {
      mergedFindings.push(...sr.findings);
      mergedClauseCards.push(...sr.clauseCards);
    } else {
      sectionSynthFailures++;
    }
  }

  console.log("[llm] large-doc stage-2a completed", {
    sectionsProcessed: sectionSynthResults.length,
    sectionSynthFailures,
    mergedFindings: mergedFindings.length,
    mergedClauseCards: mergedClauseCards.length,
    canonicalIn: totalCanonicalIssues,
  });

  if (mergedFindings.length === 0) {
    throw new Error(
      "Large document hierarchical synthesis produced no findings across all sections. " +
      `Extracted ${allIssues.length} candidates (${totalCanonicalIssues} canonical) but per-section synthesis failed.`,
    );
  }

  // Normalize finding/clause text
  const n = normalizeLlmOutput;
  for (const f of mergedFindings) {
    f.title = n(f.title);
    f.shortWhy = n(f.shortWhy);
  }
  for (const c of mergedClauseCards) {
    c.atFirstGlance = n(c.atFirstGlance);
    c.whatItMeans = n(c.whatItMeans);
    c.scenario = n(c.scenario);
    c.originalTextExcerpt = n(c.originalTextExcerpt);
  }

  // -----------------------------------------------------------------------
  // Stage 2b: lightweight verdict + actions synthesis
  // -----------------------------------------------------------------------

  console.log("[llm] large-doc stage-2b started (verdict synthesis)", {
    findingsCount: mergedFindings.length,
  });

  const verdictResult = await synthesizeVerdict(
    mergedFindings,
    {
      title: input.title,
      sourceType: input.sourceType,
      locale: input.locale,
      contractTypeHint: input.contractTypeHint,
      contextParts,
      personalContext: input.personalContext,
      question: input.question,
    },
    sectionSynthSystem,
    callSynthesis,
  );

  console.log("[llm] large-doc stage-2b completed", {
    hasVerdict: !!verdictResult,
  });

  // -----------------------------------------------------------------------
  // Stage 2c: assemble final report in code
  // -----------------------------------------------------------------------

  const report: Report = {
    id: "generated",
    locale: (input.locale as Report["locale"]) ?? "GB",
    contractFamily: verdictResult?.contractFamily ?? "contracts",
    createdAtISO: new Date().toISOString(),
    isPreview: false,
    verdict: verdictResult?.verdict ?? {
      headline: "Analysis complete — review findings below.",
      summary: `This document was analysed across ${sectionSummaries.length} sections. ${mergedFindings.length} findings were identified.`,
      severityOverall: computeOverallSeverity(mergedFindings),
      scoreOverall: computeOverallScore(mergedFindings),
    },
    findings: mergedFindings,
    paywalledFindingsCount: 0,
    clauseCards: mergedClauseCards,
    actions: {
      recommendedQuestions: verdictResult?.recommendedQuestions ?? [],
      letterTemplates: verdictResult?.letterTemplates ?? [],
    },
    userQuestion: verdictResult?.userQuestion ?? null,
    userAnswer: verdictResult?.userAnswer ?? null,
    coverageStatus,
    topIssues: computeTopIssues(mergedFindings),
    allIssuesBySection: buildAllIssuesBySection(mergedFindings),
  };

  // Normalize verdict text
  report.verdict.headline = n(report.verdict.headline);
  report.verdict.summary = n(report.verdict.summary);
  if (report.userAnswer) report.userAnswer = n(report.userAnswer);
  for (const t of report.actions.letterTemplates) {
    t.body = n(t.body);
  }

  console.log("[llm] large-doc-mode completed", {
    findings: report.findings.length,
    topIssues: report.topIssues!.length,
    allIssuesBySectionCount: report.allIssuesBySection!.length,
    clauseCards: report.clauseCards.length,
    letterTemplates: report.actions.letterTemplates.length,
    recommendedQuestions: report.actions.recommendedQuestions.length,
    candidatesIn: allIssues.length,
    canonicalIn: totalCanonicalIssues,
    sectionSynthFailures,
    coverageMode: coverageStatus.mode,
  });

  return report;
}

// ===========================================================================
// Stage 2 helpers: section-level synthesis + verdict synthesis
// ===========================================================================

/** @deprecated Use GROUP_SYNTH_MAX_OUTPUT_TOKENS. Kept for test import compatibility. */
export const SECTION_SYNTH_MAX_OUTPUT_TOKENS = 6000;
/** @deprecated Use GROUP_SYNTH_RETRY_OUTPUT_TOKENS. Kept for test import compatibility. */
export const SECTION_SYNTH_RETRY_OUTPUT_TOKENS = 8000;

export const ISSUES_PER_SYNTH_GROUP = 6;
export const GROUP_SYNTH_MAX_OUTPUT_TOKENS = 4000;
export const GROUP_SYNTH_RETRY_OUTPUT_TOKENS = 5500;
const GROUP_SYNTH_MAX_CONCURRENT = 3;
const SECTION_SYNTH_MAX_CONCURRENT = 2;
const GROUP_SYNTH_STREAM_THRESHOLD = 5000;
const VERDICT_SYNTH_MAX_OUTPUT_TOKENS = 4000;

/** @internal Exported for test assertions on prompt content. */
export const GROUP_SYNTHESIS_SYSTEM_PROMPT = `You are PlainTerms, producing structured JSON findings and clause cards for a small group of contract issues. Your audience is an ordinary person, not a lawyer, not a policy analyst.

FORMAT RULES:
- Output ONLY valid JSON. No markdown, no commentary.
- Every string value must be plain text (no markdown formatting).
- Be SPECIFIC to the actual document text provided in the excerpts.
- Completing valid JSON is the TOP priority. Finish all arrays and objects.
- Keep every field compact. Short sentences only. Shorter is better.

PLAIN-LANGUAGE RULES (critical for every prose field):
- Write at a reading level a 12-year-old could follow.
- Use short sentences with common everyday words.
- One main idea per sentence.
- Avoid passive voice. Avoid "if a court were to interpret..." phrasing.
- Do not sound like a lawyer, a policy analyst, or a college essay.
- Sound like a calm support worker explaining something stressful to a normal person.
- If a technical or legal term is unavoidable, define it immediately in plain English.
- Good: "This means you may have to pay the full bill yourself."
- Good: "Even after you meet the deductible, you still pay half."
- Bad: "The policyholder may be subject to cost-sharing obligations pursuant to the applicable benefit schedule."
- Never use em dashes or en dashes. Use full stops, commas, brackets, or simpler sentence splits.

DYNAMIC FRAMING BY CLAUSE TYPE:
Not every clause deserves "catch" framing. Match the style to the clause:
- Clear exclusion, waiting period, numeric cap, or hard requirement: use explanatory framing. State what the clause says and explain why it matters. No fake surprise.
- Ambiguous or misleading wording, discretionary power, or hidden sting: use contrast framing (surface reading vs real meaning). This is where "catch" style is appropriate.
- Legal or technical nuance: explain the term plainly and say why it matters.
Only use "catch" framing when the clause genuinely hides or softens the sting.

CLAUSE CARD PROSE RULES:
- atFirstGlance: Write the most plausible quick reading a normal buyer would take. Friendly tone. One sentence.
  * If the clause is explicit, paraphrase what it says rather than inventing a misreading.
  * Do NOT force a cartoonishly broad misunderstanding. If the clause is a clearly narrow exclusion, make the surface reading narrower and more accurate.
  * Do NOT start with "You would think..." unless that reading is genuinely plausible from ambiguous wording.
  * For explicit clauses prefer: "What this clause says", "What this means on a quick read".
  * For easy-to-miss detail prefer: "What many people may miss".
  * For ambiguous wording prefer: "What many people may assume", "What this may sound like".
  * Only use assumption-vs-reality framing when the clause genuinely misleads.
- whatItMeans: One to two sentences, direct and specific.
  * For genuinely trap-like clauses: explain the catch and the real practical impact.
  * For clear exclusions, caps, and hard rules: use explanatory framing. "What this means in practice", "Why this matters", "How this affects a claim". Do NOT imply there is a hidden catch when the clause is already explicit.
  * If this restriction is common for this type of contract, say so. Example: "This is standard for most home insurance policies, but it still means you would not be covered for gradual damp."
  * If this restriction is stricter than usual, say so. Example: "This looks stricter than many standard health plans, which typically cover at least some out-of-network care."
- scenario: A specific, concrete story with real-sounding amounts, timeframes, and situations. One to two sentences.
  * Vary scenarios across the concern buckets for this contract type. Do not reuse the same personal-context fact in every scenario.
  * Mix in common real-world situations that many buyers would face, not just personal-context scenarios.
  * Use country-appropriate currency symbols and institutions when the locale is known.
- whatToDo: Time-aware actionable steps. Each step says WHEN to act (before signing, before renewal, if something goes wrong, ongoing). Two to three items.
- goDeeper: One sentence of additional context, or empty string. If a technical term appeared (e.g. "excess", "deductible", "indemnity basis", "subsidence", "occupiers' liability"), define it here in plain English and explain why it matters.

SCHEDULE-AWARE CERTAINTY:
- If the document appears to be a general policy wording booklet rather than a personalised schedule, do not present optional or conditional sections as definitely active.
- If a section heading says "Optional", "If selected", "Where shown on your schedule", or similar, flag this uncertainty clearly.
- Preferred wording: "This section appears in the policy wording, but check your schedule to confirm it is included in your cover."

STANDARD vs UNUSUAL vs POSITIVE:
- Clearly distinguish how normal or unusual each finding is for contracts of this type.
- If a restriction appears common for this type, say so carefully (e.g. "This appears common for policies of this type").
- If a restriction appears unusually strict, say so carefully (e.g. "This looks stricter than many standard contracts of this type").
- If a clause is a genuine positive or stronger-than-expected protection, say so (e.g. "This appears to be a stronger-than-average protection").
- Do not overclaim market certainty. Use "appears" or "typically" rather than stating absolute market facts.

TECHNICAL TERM EXPLANATION:
- When a clause uses an important technical term a normal buyer may not know:
  1. Add one short plain-English definition of the term inside whatItMeans or goDeeper.
  2. Add one short sentence explaining why it matters in practice.
- Examples: deductible, copay, coinsurance, formulary, prior authorisation, excess, subsidence, indemnity, total loss, depreciation, arbitration, liquidated damages.
- Do NOT just name the distinction. Explain it.

LEGALLY QUALIFIED CLAUSES:
- If the policy text says something harsh but outside law may limit that outcome, distinguish clearly:
  1. What the policy text says.
  2. What the insurer or provider may try to rely on.
  3. Where outside law may limit or qualify it, and what the buyer should do to clarify.
- Do NOT overstate the harshest reading as guaranteed fact when legally uncertain.
- Do NOT soften or hide harsh wording either.
- Make uncertainty actionable: suggest the buyer ask for written clarification or get advice.

PERSONAL CONTEXT:
- If personal context is provided, use it to make scenarios and whatToDo more personally relevant.
- Do NOT treat personal context as evidence about the contract. It describes the reader, not the document.
- Use it naturally, only where it genuinely changes urgency or recommended action.
- MODERATION: Do NOT reuse the same personal fact in more than 2 to 3 findings unless it is genuinely central. Mix in common real-world scenarios for the contract type as well.

OUTPUT SCHEMA (return a JSON object with exactly these fields):
{
  "findings": [
    {
      "id": "<unique id like f-1, f-2>",
      "title": "<short finding title, specific to this clause, not generic>",
      "severity": "<info|low|medium|high|critical>",
      "score": <0-100>,
      "tags": ["<TaxonomyTag values>"],
      "shortWhy": "<one sentence explaining why this matters to the buyer>",
      "relatedClauseIds": ["<clause IDs from clauseCards>"],
      "impactType": "<cost|service-loss|cancellation|renewal|coverage|billing|usage-restriction|privacy|weak-remedy|linked-agreement|admin-trap|other>",
      "actionTiming": "<before-signing|before-renewal|before-cancellation|before-claim|if-problem-occurs|ongoing|info-only>",
      "decisionRelevance": "<decision-critical|important|monitor|background>",
      "mechanismType": "<arbitration|class_action_waiver|subrogation_reimbursement|coordination_of_benefits|prior_authorization|medical_necessity_discretion|network_limitation|step_therapy|appeal_deadline|termination_rescission|premium_rate_change|other>",
      "sectionLabel": "<section label>"
    }
  ],
  "clauseCards": [
    {
      "clauseId": "<unique id like c-1>",
      "clauseLabel": "<short clause name>",
      "originalTextExcerpt": "<brief quote from excerpts, max 2 sentences>",
      "atFirstGlance": "<most plausible surface reading, 1 sentence, friendly tone>",
      "whatItMeans": "<the catch or real practical impact, 1-2 sentences, direct>",
      "scenario": "<concrete story with specific details, 1-2 sentences>",
      "whatToDo": ["<time-aware actionable steps, 2-3 items>"],
      "goDeeper": "<1 sentence or empty string>"
    }
  ]
}

ISSUE PRESERVATION RULES (critical):
- Produce EXACTLY ONE finding per canonical issue provided. No merging. No dropping. No inventing.
- Preserve the mechanismType from each canonical issue.
- Set sectionLabel on every finding.
- Each finding must have exactly one corresponding clauseCard.
- Do NOT pad with filler text.`;

function buildGroupSynthesisSystemPrompt(
  locale?: string,
  familyInstruction?: string,
): string {
  return GROUP_SYNTHESIS_SYSTEM_PROMPT +
    buildLocaleInstruction(locale) +
    (familyInstruction ? "\n\n" + familyInstruction : "");
}

interface SectionSynthInput {
  title?: string;
  sourceType: string;
  locale?: string;
  contextParts: string[];
  personalContext?: string;
}

interface SectionSynthOutput {
  sectionLabel: string;
  findings: Finding[];
  clauseCards: import("@/types/report").ClauseCard[];
  canonicalIssueCount: number;
}

interface VerdictSynthInput {
  title?: string;
  sourceType: string;
  locale?: string;
  contractTypeHint?: string;
  contextParts: string[];
  personalContext?: string;
  question?: string;
}

interface VerdictResult {
  verdict: Report["verdict"];
  contractFamily: Report["contractFamily"];
  recommendedQuestions: string[];
  letterTemplates: import("@/types/report").LetterTemplate[];
  userQuestion: string | null;
  userAnswer: string | null;
}

export function chunkCanonicalIssuesForSynthesis<T>(
  issues: T[],
  maxPerGroup: number = ISSUES_PER_SYNTH_GROUP,
): T[][] {
  const groups: T[][] = [];
  for (let i = 0; i < issues.length; i += maxPerGroup) {
    groups.push(issues.slice(i, i + maxPerGroup));
  }
  return groups;
}

export function estimateGroupTokenBudget(issueCount: number): number {
  const base = Math.max(issueCount * 600, 2000);
  return Math.min(base, GROUP_SYNTH_MAX_OUTPUT_TOKENS);
}

/** @deprecated Use estimateGroupTokenBudget. Kept for test import compatibility. */
export function estimateSectionTokenBudget(issueCount: number): number {
  return estimateGroupTokenBudget(issueCount);
}

type CallSynthesisFn = (
  system: string,
  user: string,
  maxTokens: number,
  label?: string,
) => Promise<{ text: string; stopReason?: string }>;

interface GroupSynthResult {
  findings: Finding[];
  clauseCards: import("@/types/report").ClauseCard[];
}

function parseGroupSynthOutput(
  raw: string,
  sectionLabel: string,
  groupIndex: number,
): GroupSynthResult {
  const parsed = JSON.parse(extractJson(raw));
  const findings: Finding[] = [];
  const clauseCards: import("@/types/report").ClauseCard[] = [];

  if (Array.isArray(parsed.findings)) {
    for (let i = 0; i < parsed.findings.length; i++) {
      const f = parsed.findings[i];
      findings.push({
        id: f.id || `f-${sectionLabel}-g${groupIndex}-${i + 1}`,
        title: f.title ?? "",
        severity: f.severity ?? "medium",
        score: f.score ?? 50,
        tags: Array.isArray(f.tags) ? f.tags : [],
        shortWhy: f.shortWhy ?? "",
        relatedClauseIds: Array.isArray(f.relatedClauseIds) ? f.relatedClauseIds : [],
        impactType: f.impactType ?? "other",
        actionTiming: f.actionTiming ?? "before-signing",
        decisionRelevance: f.decisionRelevance ?? "important",
        mechanismType: f.mechanismType ?? undefined,
        sectionLabel: f.sectionLabel ?? sectionLabel,
      });
    }
  }

  if (Array.isArray(parsed.clauseCards)) {
    for (let i = 0; i < parsed.clauseCards.length; i++) {
      const c = parsed.clauseCards[i];
      clauseCards.push({
        clauseId: c.clauseId || `c-${sectionLabel}-g${groupIndex}-${i + 1}`,
        clauseLabel: c.clauseLabel ?? "",
        originalTextExcerpt: c.originalTextExcerpt ?? "",
        atFirstGlance: c.atFirstGlance ?? "",
        whatItMeans: c.whatItMeans ?? "",
        scenario: c.scenario ?? "",
        whatToDo: Array.isArray(c.whatToDo) ? c.whatToDo : [],
        goDeeper: c.goDeeper ?? undefined,
        risks: Array.isArray(c.risks) ? c.risks : undefined,
        negotiation: c.negotiation ?? undefined,
      });
    }
  }

  return { findings, clauseCards };
}

async function synthesizeIssueGroup(
  sectionLabel: string,
  groupIndex: number,
  groupIssues: SectionSummary["canonicalIssues"],
  systemPrompt: string,
  meta: SectionSynthInput,
  callSynthesis: CallSynthesisFn,
): Promise<GroupSynthResult> {
  const issueCount = groupIssues.length;
  if (issueCount === 0) return { findings: [], clauseCards: [] };

  let userMsg = "";
  if (meta.title) userMsg += `Document title: ${meta.title}\n`;
  userMsg += `Source type: ${meta.sourceType}\n`;
  if (meta.locale) userMsg += `Locale: ${meta.locale}\n`;
  if (meta.contextParts.length > 0) {
    userMsg += `Context: ${meta.contextParts.join(" | ")}\n`;
  }
  if (meta.personalContext) {
    userMsg += `Personal context: ${meta.personalContext}\n`;
  }
  userMsg += `\nSection: "${sectionLabel}" — issue group ${groupIndex + 1} (${issueCount} issues)\n`;
  userMsg += `\n--- CANONICAL ISSUES ---\n\n`;
  userMsg += JSON.stringify(groupIssues);

  const budget = estimateGroupTokenBudget(issueCount);
  const tag = `group-synth:${sectionLabel}:g${groupIndex}`;

  console.log("[llm] stage2a group synthesis started", {
    section: sectionLabel,
    group: groupIndex,
    issues: issueCount,
    budget,
  });

  let synthText: string | undefined;
  let stopReason: string | undefined;

  try {
    const result = await callSynthesis(systemPrompt, userMsg, budget, tag);
    synthText = result.text;
    stopReason = result.stopReason;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown";
    console.log("[llm] stage2a group synthesis failed", {
      section: sectionLabel, group: groupIndex, attempt: 1, error: msg,
    });
  }

  if (synthText && (stopReason === "max_tokens" || isLikelyIncompleteJson(extractJson(synthText)))) {
    const retryBudget = Math.min(issueCount * 800, GROUP_SYNTH_RETRY_OUTPUT_TOKENS);
    console.log("[llm] stage2a group synthesis truncated, retrying", {
      section: sectionLabel, group: groupIndex, retryBudget,
    });
    try {
      const result = await callSynthesis(systemPrompt, userMsg, retryBudget, `${tag}:retry`);
      synthText = result.text;
      stopReason = result.stopReason;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "unknown";
      console.log("[llm] stage2a group synthesis retry failed", {
        section: sectionLabel, group: groupIndex, error: msg,
      });
    }
  }

  if (!synthText) {
    console.log("[llm] stage2a group synthesis no output", {
      section: sectionLabel, group: groupIndex,
    });
    return { findings: [], clauseCards: [] };
  }

  try {
    const result = parseGroupSynthOutput(synthText, sectionLabel, groupIndex);
    console.log("[llm] stage2a group synthesis completed", {
      section: sectionLabel,
      group: groupIndex,
      findings: result.findings.length,
      clauseCards: result.clauseCards.length,
      canonicalIn: issueCount,
      dropCount: issueCount - result.findings.length,
    });
    return result;
  } catch (parseErr) {
    const msg = parseErr instanceof Error ? parseErr.message : "unknown";
    console.log("[llm] stage2a group synthesis parse failed", {
      section: sectionLabel, group: groupIndex,
      error: msg, responseLen: synthText.length,
    });
    return { findings: [], clauseCards: [] };
  }
}

async function synthesizeSingleSection(
  section: SectionSummary,
  systemPrompt: string,
  meta: SectionSynthInput,
  callSynthesis: CallSynthesisFn,
): Promise<SectionSynthOutput> {
  const issueCount = section.canonicalIssues.length;
  if (issueCount === 0) {
    return { sectionLabel: section.sectionLabel, findings: [], clauseCards: [], canonicalIssueCount: 0 };
  }

  const groups = chunkCanonicalIssuesForSynthesis(section.canonicalIssues);

  console.log("[llm] stage2a section started (micro-batched)", {
    section: section.sectionLabel,
    canonicalIssues: issueCount,
    groupCount: groups.length,
    groupSize: ISSUES_PER_SYNTH_GROUP,
  });

  const allFindings: Finding[] = [];
  const allClauseCards: import("@/types/report").ClauseCard[] = [];
  let groupFailures = 0;

  for (let gi = 0; gi < groups.length; gi += GROUP_SYNTH_MAX_CONCURRENT) {
    const concurrentGroups = groups.slice(gi, gi + GROUP_SYNTH_MAX_CONCURRENT);
    const results = await Promise.allSettled(
      concurrentGroups.map((groupIssues, j) =>
        synthesizeIssueGroup(
          section.sectionLabel,
          gi + j,
          groupIssues,
          systemPrompt,
          meta,
          callSynthesis,
        ),
      ),
    );

    for (let j = 0; j < results.length; j++) {
      const r = results[j];
      if (r.status === "fulfilled") {
        allFindings.push(...r.value.findings);
        allClauseCards.push(...r.value.clauseCards);
        if (r.value.findings.length === 0 && concurrentGroups[j].length > 0) {
          groupFailures++;
        }
      } else {
        groupFailures++;
        console.log("[llm] stage2a group rejected", {
          section: section.sectionLabel,
          group: gi + j,
          error: r.reason instanceof Error ? r.reason.message : "unknown",
        });
      }
    }
  }

  console.log("[llm] stage2a section completed", {
    section: section.sectionLabel,
    findings: allFindings.length,
    clauseCards: allClauseCards.length,
    canonicalIn: issueCount,
    groupCount: groups.length,
    groupFailures,
    dropCount: issueCount - allFindings.length,
  });

  return {
    sectionLabel: section.sectionLabel,
    findings: allFindings,
    clauseCards: allClauseCards,
    canonicalIssueCount: issueCount,
  };
}

export async function runPerSectionSynthesis(
  sectionSummaries: SectionSummary[],
  systemPrompt: string,
  meta: SectionSynthInput,
  callSynthesis: CallSynthesisFn,
): Promise<SectionSynthOutput[]> {
  const results: SectionSynthOutput[] = [];

  for (let i = 0; i < sectionSummaries.length; i += SECTION_SYNTH_MAX_CONCURRENT) {
    const batch = sectionSummaries.slice(i, i + SECTION_SYNTH_MAX_CONCURRENT);
    const batchResults = await Promise.allSettled(
      batch.map((section) =>
        synthesizeSingleSection(section, systemPrompt, meta, callSynthesis),
      ),
    );
    for (let j = 0; j < batchResults.length; j++) {
      const r = batchResults[j];
      if (r.status === "fulfilled") {
        results.push(r.value);
      } else {
        const section = batch[j];
        console.log("[llm] stage2a section synthesis rejected", {
          section: section.sectionLabel,
          error: r.reason instanceof Error ? r.reason.message : "unknown",
        });
        results.push({
          sectionLabel: section.sectionLabel,
          findings: [],
          clauseCards: [],
          canonicalIssueCount: section.canonicalIssues.length,
        });
      }
    }
  }

  return results;
}

/** @internal Exported for test assertions on prompt content. */
export const VERDICT_SYNTHESIS_PROMPT = `You are PlainTerms. Given a set of already-synthesized findings from a contract analysis, produce a verdict summary and recommended actions for an ordinary buyer.

Do NOT regenerate findings or clause cards. They already exist.

PLAIN-LANGUAGE RULES:
- Write at a reading level a 12-year-old could follow.
- Short sentences with common everyday words.
- Sound like a calm, practical support worker, not a lawyer or policy analyst.
- Never use em dashes or en dashes. Use full stops, commas, brackets, or simpler sentence splits.

FRONT-SUMMARY PRIORITISATION:
- The headline should quickly tell the buyer whether this is likely a good deal, a risky deal, or somewhere in between.
- The summary must reflect the most important concern buckets for this contract type first, then sharpen with personal context if provided.
- Do NOT let personal context dominate the front summary. It should sharpen the priority, not replace it.
- Name the biggest concrete risks that apply broadly to a buyer of this contract type, then note any personal-context concerns that change the picture.
- If the contract type is known, use the relevant concern buckets to order and weight the summary:
  * Health insurance: out-of-pocket costs, network, formulary, prior auth, exclusions, appeals.
  * Home insurance: theft, storm, water, accidental damage, valuables, excesses, subsidence.
  * Car insurance: collision, theft, total loss, excess, usage exclusions, repair disputes.
  * Lease: rent, deposit, repairs, notice, break clauses, fees, access.
  * Service/subscription: renewal, price changes, liability, refunds, suspension, disputes.
  * Employment: termination, restrictive covenants, payment, IP, indemnity.
  * Generic: cost, cancellation, coverage, liability, deadlines, disputes, exclusions.

STANDARD vs UNUSUAL vs POSITIVE BALANCE:
- The summary should name any genuine positives or strong protections, not just risks.
- If many flagged restrictions are common for contracts of this type, say so. Do not make the whole contract sound broadly terrible when the limits are standard.
- If any findings are unusually strict for this type, highlight those.
- Include a short honest balance between:
  * likely ordinary protections or expected benefits
  * important limits or exclusions
  * what matters most for this buyer
- Do NOT force fake balance. If the contract is mostly poor value, say so clearly. If there are real protections, mention them briefly and honestly.

PERSONAL CONTEXT:
- If personal context is provided, use it to tailor the verdict and questions to that buyer's situation.
- Make recommended questions and letter templates more personally relevant where the context genuinely applies.
- Do NOT mention personal context awkwardly in every field. Use it naturally and only where it changes the advice.
- MODERATION: do not reuse the same personal fact in every recommended question. Vary across the main concern areas.

SCHEDULE-AWARE CERTAINTY:
- If any findings flagged optional or conditional sections that depend on the buyer's schedule, the verdict should remind the buyer to check their schedule or certificate.
- Do not present optional cover as definitely active unless the uploaded document confirms it.

COUNTRY-AWARE EXAMPLES AND CURRENCY:
- When the locale is known, use country-appropriate currency symbols and institutions in the verdict and recommended questions.
- UK: £, FOS, FCA. US: $, state insurance commissioner. CA: CA$. AU: A$.
- Format currency naturally: £3,000 not "3,000 pounds".

LEGALLY QUALIFIED CLAUSES:
- Where findings note legal uncertainty, the verdict should reflect that honestly.
- Do not overstate the harshest reading as guaranteed fact.
- Suggest the buyer get written clarification where it matters.

Output ONLY valid JSON with these fields:
{
  "contractFamily": "<insurance|leases|contracts|finance|employment|telecom|gym|cloud-services>",
  "verdict": {
    "headline": "<one-sentence buyer-facing assessment, specific to this document, tells the buyer what matters most>",
    "summary": "<2-4 sentences naming the biggest concrete risks and any genuine positives, written for a normal person>"
  },
  "severityOverall": "<info|low|medium|high|critical>",
  "scoreOverall": <0-100 integer>,
  "recommendedQuestions": ["<2-5 practical questions the buyer could realistically ask and expect an answer>"],
  "letterTemplates": [<see rules below>],
  "userQuestion": <string|null>,
  "userAnswer": <string|null>
}

LETTER TEMPLATES:
- If no findings are high or critical: return letterTemplates as an empty array [].
- If high or critical findings exist: generate 1-3 targeted templates with DIFFERENT intents (clarification, complaint, or cancellation). Each body must reference specific clauses.
- ALSO include one combined clarification letter (id "lt-combined") that covers the main issues in a single message. Title it something like "Combined clarification letter, all key concerns". The body should list the key questions and concerns from the top findings in one practical letter the buyer could send.
- Make it clear via titles that both targeted and combined options exist.

Letter template shape: { "id": "<lt-1>", "title": "<title>", "body": "<letter body text>" }

SCORING:
- 1-2 low findings: 85-95
- several medium: 55-75
- any high/critical: 25-55

Keep prose concise. Complete valid JSON.`;

async function synthesizeVerdict(
  findings: Finding[],
  meta: VerdictSynthInput,
  _baseSystem: string,
  callSynthesis: (system: string, user: string, maxTokens: number, label?: string) => Promise<{ text: string; stopReason?: string }>,
): Promise<VerdictResult | null> {
  const system = VERDICT_SYNTHESIS_PROMPT + buildLocaleInstruction(meta.locale);

  let userMsg = "";
  if (meta.title) userMsg += `Document title: ${meta.title}\n`;
  userMsg += `Source type: ${meta.sourceType}\n`;
  if (meta.locale) userMsg += `Locale: ${meta.locale}\n`;
  if (meta.contractTypeHint) userMsg += `Contract type: ${meta.contractTypeHint}\n`;
  if (meta.contextParts.length > 0) {
    userMsg += `Context: ${meta.contextParts.join(" | ")}\n`;
  }
  if (meta.personalContext) {
    userMsg += `Personal context: ${meta.personalContext}\n`;
  }
  if (meta.question) {
    userMsg += `USER QUESTION: ${meta.question}\n`;
    userMsg += `(Populate "userQuestion" verbatim and "userAnswer" with 3-6 sentence answer.)\n`;
  }
  userMsg += `\n${findings.length} findings were identified:\n\n`;

  const findingSummary = findings.map((f) => ({
    title: f.title,
    severity: f.severity,
    shortWhy: f.shortWhy,
    mechanismType: f.mechanismType,
    sectionLabel: f.sectionLabel,
    impactType: f.impactType,
    decisionRelevance: f.decisionRelevance,
  }));
  userMsg += JSON.stringify(findingSummary);

  try {
    const result = await callSynthesis(
      system,
      userMsg,
      VERDICT_SYNTH_MAX_OUTPUT_TOKENS,
      "verdict-synthesis",
    );

    const parsed = JSON.parse(extractJson(result.text));

    return {
      verdict: {
        headline: parsed.verdict?.headline ?? "Analysis complete.",
        summary: parsed.verdict?.summary ?? "",
        severityOverall: parsed.verdict?.severityOverall ?? parsed.severityOverall ?? computeOverallSeverity(findings),
        scoreOverall: parsed.verdict?.scoreOverall ?? parsed.scoreOverall ?? computeOverallScore(findings),
      },
      contractFamily: normalizeContractFamily(parsed.contractFamily) as Report["contractFamily"],
      recommendedQuestions: Array.isArray(parsed.recommendedQuestions) ? parsed.recommendedQuestions : [],
      letterTemplates: Array.isArray(parsed.letterTemplates)
        ? parsed.letterTemplates.map((t: Record<string, unknown>, i: number) => ({
            id: (t.id as string) ?? `lt-${i + 1}`,
            title: (t.title as string) ?? (t.name as string) ?? `Letter ${i + 1}`,
            body: (t.body as string) ?? (t.content as string) ?? "",
          }))
        : [],
      userQuestion: (parsed.userQuestion as string) ?? null,
      userAnswer: (parsed.userAnswer as string) ?? null,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown";
    console.log("[llm] verdict synthesis failed, using computed fallback", { error: msg });
    return null;
  }
}

function computeOverallSeverity(findings: Finding[]): Report["verdict"]["severityOverall"] {
  const sevOrder = ["critical", "high", "medium", "low", "info"] as const;
  for (const s of sevOrder) {
    if (findings.some((f) => f.severity === s)) return s;
  }
  return "info";
}

function computeOverallScore(findings: Finding[]): number {
  const hasCritical = findings.some((f) => f.severity === "critical");
  const hasHigh = findings.some((f) => f.severity === "high");
  const medCount = findings.filter((f) => f.severity === "medium").length;

  if (hasCritical) return 25;
  if (hasHigh) return 40;
  if (medCount >= 5) return 55;
  if (medCount >= 2) return 65;
  if (findings.length <= 2) return 90;
  return 75;
}
