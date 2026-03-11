import OpenAI from "openai";
import { parseReportJson } from "./report-schema";
import { MOCK_REPORT } from "./mock-report";
import type { Report } from "@/types/report";
import { anthropicGenerateText, type AnthropicResult } from "./anthropic";
import { normalizeLlmOutput } from "@/lib/text/normalize-llm-output";
import { resolveContractPolicy } from "@/lib/llm/contract-family-policy";

const DEFAULT_OPENAI_MODEL = "gpt-4o-mini";

function getOpenAIModel(): string {
  return process.env.PLAINTERMS_OPENAI_MODEL || DEFAULT_OPENAI_MODEL;
}
const MAX_OUTPUT_TOKENS = 8192;
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

const SYSTEM_PROMPT = `You are PlainTerms, a document analysis assistant that helps ordinary people understand contracts and legal documents in plain English. You produce structured JSON analysis that is specific, grounded in the actual document text, and actionable.

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

2. USE "WHAT YOU ASSUME" vs "WHAT IT ACTUALLY MEANS" FRAMING
   atFirstGlance: Write what a reasonable person would casually assume this clause means. Friendly, reassuring tone.
   whatItMeans: Explain the catch — the real practical impact. Be direct, specific, and concrete. Focus on consequences the reader would not have expected.

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

7. SCORING MUST REFLECT THE ACTUAL DOCUMENT
   scoreOverall must be justified by the actual severity and count of findings.
   A document with only 1-2 low-severity findings should score 85-95.
   A document with several medium findings should score 55-75.
   A document with any high or critical findings should score 25-55.
   Do NOT default to a score around 60-65 for every document.

8. LETTER TEMPLATES — CONDITIONAL, NOT BOILERPLATE
   If no findings are high or critical severity: return letterTemplates as an empty array [].
   If high or critical findings exist: generate 1-3 templates with DIFFERENT intents (clarification, complaint, or cancellation).
   Only include template types that match actual findings. Each body must reference specific clauses from this document.

9. NO REPETITIVE BOILERPLATE
   Every finding title, shortWhy, and clause card text must be fresh and specific to this document.
   Vary sentence structure. Do not recycle stock phrases across findings.

10. NEGOTIATION — FOLLOW THE CONTRACT FAMILY ADVICE MODE
    Whether negotiation fields should be populated depends on the contract type. Follow the CONTRACT FAMILY ADVICE MODE instructions provided below.
    In general: mass-market consumer contracts are NOT negotiable, insurance is NOT negotiable, leases may be cautiously negotiable before signing, and employment/commercial contracts are more negotiable.
    When the advice mode says to leave negotiation fields empty, do so. Focus whatToDo on checking, asking support, keeping records, knowing deadlines, and escalating.

11. JURISDICTION CONTEXT
    If a jurisdiction is provided, prioritise pitfalls and consumer-protection norms relevant there.
    Do NOT state legal conclusions as facts — note the concern and suggest the reader verify.
    When a clause may conflict with local consumer rights, flag it and label it "Needs confirmation — check with the provider or a local adviser."

12. CONTRACT TYPE CONTEXT
    If a contract type hint is provided, suppress irrelevant generic risks and surface known category-specific "gotchas" — but ONLY when supported by actual document text.

13. PLAIN LANGUAGE — NO LEGAL SPECULATION
    Write at a reading level an ordinary adult can follow.
    Avoid passive voice where possible. Avoid "if a court were to interpret..." phrasing.
    Where legal uncertainty matters, say so briefly and explain what the consumer should do next.
    Do not use legal jargon unless quoting the document. If you quote jargon, immediately explain it.

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
      "decisionRelevance": "<decision-critical|important|monitor|background>"
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

Do NOT assign these randomly. Each must be grounded in what the document text actually says. When in doubt, prefer the more conservative/actionable option.

GUIDELINES:
- Use the tags taxonomy accurately — only use tags that genuinely apply.
- Produce 2-5 recommended questions that a consumer could realistically get answered by customer service, a claims handler, a landlord, or an employer. Avoid questions that require a lawyer to answer.
- crossClauseCombos on clauseCards are optional — include only when two clauses genuinely interact to create a compounding risk.`;

function buildLocaleInstruction(locale?: string): string {
  if (!locale) return "";
  const map: Record<string, string> = {
    GB: "United Kingdom",
    US: "United States",
    CA: "Canada",
    AU: "Australia",
  };
  const country = map[locale] ?? locale;
  return `\nUse terminology and legal references appropriate for ${country} jurisdiction.`;
}

const QC_MIN_FINDINGS = 1;
const QC_MIN_CLAUSE_CARDS = 1;
const QC_MIN_FIELD_LENGTH = 20;
const QC_MIN_REPORT_JSON_LENGTH = 2000;
const QC_RETRY_JSON_CAP = 30_000;

const DEFAULT_MAX_INPUT_CHARS = 96_000;
const DEFAULT_MAX_INPUT_CHARS_OPUS = 288_000;

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
    if (Array.isArray(obj.clauseCards)) {
      for (let i = 0; i < obj.clauseCards.length; i++) {
        const c = obj.clauseCards[i];
        if (!c.clauseId) c.clauseId = `c-${i + 1}`;
        if (!Array.isArray(c.whatToDo)) c.whatToDo = [];
      }
    }

    if (obj.userQuestion === undefined) obj.userQuestion = null;
    if (obj.userAnswer === undefined) obj.userAnswer = null;

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

  const familyPolicy = resolveContractPolicy(
    undefined, // contractFamily is model-inferred — we use the type hint
    input.contractTypeHint,
  );
  const systemContent =
    SYSTEM_PROMPT +
    buildLocaleInstruction(input.locale) +
    "\n\n" +
    familyPolicy.instruction;

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
    const isTruncation =
      backend === "anthropic" &&
      parseErr instanceof SyntaxError &&
      (anthropicMeta?.stopReason === "max_tokens" ||
        (anthropicMeta?.usage?.outputTokens != null &&
          anthropicMeta.usage.outputTokens >= effectiveMaxTokens - 50));

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

    const newMaxTokens = Math.min(Math.max(effectiveMaxTokens * 4, 3500), 8000);
    console.log("[llm] anthropic truncation retry", {
      model: resolvedModel,
      previousMaxTokens: effectiveMaxTokens,
      newMaxTokens,
      stopReason: anthropicMeta?.stopReason,
      outputTokens: anthropicMeta?.usage?.outputTokens,
    });

    const truncRetryUser =
      userContent +
      "\n\nYour previous output was truncated mid-JSON. Redo the FULL response with these rules:" +
      "\n- Output ONLY a single JSON object. No markdown, no commentary." +
      "\n- You MUST output valid JSON (no trailing commas, no ellipses)." +
      "\n- If output length is a risk, shorten string fields (e.g. shortWhy) but FINISH the JSON." +
      "\n- Include all materially distinct findings supported by the document. Do not pad with filler." +
      "\n- Keep exact schema field names (camelCase).";

    try {
      const retryResult = await anthropicGenerateText({
        system: systemContent,
        user: truncRetryUser,
        maxTokens: newMaxTokens,
        temperature: effectiveTemp,
        model: options?.model,
      });
      responseText = extractJson(retryResult.text);
      report = parseReportJson(patchReportDefaults(responseText));
    } catch (retryErr) {
      const err =
        retryErr instanceof Error ? retryErr : new Error(String(retryErr));
      (err as unknown as Record<string, unknown>).anthropicDebug = {
        stopReason: anthropicMeta?.stopReason,
        ...anthropicMeta?.usage,
        retryMaxTokens: newMaxTokens,
      };
      throw err;
    }
  }

  const maxRetries = options?.maxRetries ??
    (parseInt(process.env.PLAINTERMS_LLM_MAX_RETRIES ?? "1", 10) || 1);
  const inputCharCount = chunksToSend.reduce((s, c) => s + c.length, 0);
  const quality = validateReportQuality(report);

  if (!quality.ok && maxRetries > 0) {
    console.log("[llm] quality gate failed, retrying", {
      issueCount: quality.issues.length,
      issues: quality.issues,
      inputCharCount,
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
