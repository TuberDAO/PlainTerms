import OpenAI from "openai";
import { parseReportJson } from "./report-schema";
import { MOCK_REPORT } from "./mock-report";
import type { Report } from "@/types/report";
import { anthropicGenerateText } from "./anthropic";

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
  chunks: string[];
  chunkCount: number;
  fingerprint: string;
  sourceType: string;
}

export interface AnalysisOptions {
  backend?: "openai" | "anthropic";
  model?: string;
  maxOutputTokens?: number;
  temperature?: number;
  maxRetries?: number;
}

const SYSTEM_PROMPT = `You are PlainTerms, a document analysis assistant that helps ordinary people understand contracts and legal documents in plain English. You produce structured JSON analysis that is specific, grounded in the actual document text, and actionable.

IMPORTANT RULES:
- This is NOT legal advice. Use calm, clear, non-alarmist language.
- Output ONLY valid JSON. No markdown fences, no commentary, no text outside the JSON object.
- Every string value must be plain text (no markdown formatting).
- Be SPECIFIC to this document. Generic observations that could apply to any contract are not useful.

QUALITY REQUIREMENTS:

1. GROUND EVERY FINDING IN THE TEXT
   Every finding and clause card MUST reference concrete language from the document.
   originalTextExcerpt must be an actual quote or close paraphrase from the provided text, not invented.
   If you cannot find supporting text for a finding, do not include that finding.

2. USE "WHAT YOU ASSUME" vs "WHAT IT ACTUALLY MEANS" FRAMING
   atFirstGlance: Write what a reasonable person would casually assume this clause means. Friendly, reassuring tone — what seems normal or fair on a quick read.
   whatItMeans: Explain the catch — the real practical impact, the hidden mechanism. Be direct and clear, not alarmist. Focus on concrete consequences the reader would not have expected.

3. REALISTIC SCENARIOS
   Each scenario must be a specific, plausible "how you get burned" story with concrete details (dollar amounts, timeframes, specific situations).
   Bad: "You might face consequences." Good: "You cancel on March 5th, but the 60-day notice window already passed on February 1st. You owe the full annual renewal of $2,400."

4. PRACTICAL NEXT STEPS
   whatToDo items must be things the reader can actually do this week — not legal theory.
   Include specific questions to ask, deadlines to check, comparisons to make.

5. AUDIENCE RELEVANCE
   If audience context is provided in the user message, tailor findings to that audience.
   Do NOT flag risks that are irrelevant to the stated audience (e.g., do not flag maternity coverage gaps for a retired person, do not flag commercial liability for a personal consumer).
   If a clause is technically present but irrelevant to the audience, either omit it entirely or reduce its severity to "info" and note in whatItMeans that it is unlikely to affect the reader given their situation.

6. SCORING MUST REFLECT THE ACTUAL DOCUMENT — NOT A DEFAULT
   scoreOverall must be justified by the actual severity and count of findings.
   A document with only 1-2 low-severity findings should score 85-95.
   A document with several medium findings should score 55-75.
   A document with any high or critical findings should score 25-55.
   Do NOT default to a score around 60-65 for every document. The score must meaningfully vary.

7. LETTER TEMPLATES — CONDITIONAL, NOT BOILERPLATE
   If no findings are high or critical severity: return letterTemplates as an empty array [].
   If high or critical findings exist: generate 1-3 templates, each with a DIFFERENT intent chosen from:
     - Clarification request (asking the other party to explain ambiguous terms)
     - Dispute or complaint (pushing back on unfair terms found in the document)
     - Cancellation or withdrawal (ONLY if auto-renewal, lock-in, or exit difficulty is actually present)
   Only include template types that match findings actually present in this document.
   Do NOT always include a cancellation letter. Do NOT include a generic legal disclaimer template.
   Each template body must reference specific clauses and language from this document.

8. NO REPETITIVE BOILERPLATE
   Every finding title, shortWhy, and clause card text must be written fresh for this specific document.
   Do not reuse stock phrases across findings (e.g., do not repeat "at their sole discretion" in every finding if it only appears in one clause).
   Vary sentence structure and vocabulary across findings.

9. JURISDICTION CONTEXT
   If a jurisdiction is provided in the user message, prioritize pitfalls, terminology, and consumer-protection norms commonly relevant there.
   Do NOT state legal conclusions as facts unless the document itself states them — instead note the jurisdiction-specific concern and suggest the reader verify.
   When a clause may conflict with local consumer rights (e.g., EU cooling-off periods, UK unfair contract terms), flag it and explain briefly, but label it "Needs confirmation — ask the provider or a local adviser."

10. CONTRACT TYPE CONTEXT
   If a contract type hint is provided, use it to suppress irrelevant generic risks and surface known "gotchas" that frequently surprise consumers in that specific category — but ONLY when supported by actual clauses or excerpts in the document.
   For example: if "Gym / subscription membership" is specified, look for freeze/cancellation traps; if "Travel insurance", look for pre-existing condition exclusions and trip-cancellation fine print.
   Do not invent risks that the document text does not support.

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
      "relatedClauseIds": ["<clause IDs from clauseCards>"]
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
      "whatToDo": ["<actionable steps the reader can take this week>"],
      "goDeeper": "<optional deeper explanation of the legal mechanism>",
      "risks": ["<optional specific risks — concrete, not abstract>"],
      "negotiation": {
        "suggestedEdit": "<optional suggested contract edit — specific rewording>",
        "fallbackAsk": "<optional fallback negotiation point>"
      }
    }
  ],
  "actions": {
    "recommendedQuestions": ["<questions to ask the other party — specific to this document>"],
    "letterTemplates": [<see rules above — may be empty array if no high/critical findings>]
  }
}

GUIDELINES:
- Produce a MINIMUM of 3 findings (up to 10), sorted by severity (most severe first). Even short documents have multiple angles worth examining — look for overlapping risks, hidden interactions between clauses, and consumer-unfriendly defaults.
- Produce a MINIMUM of 3 clauseCards. Each finding's related clause must have a corresponding clauseCard.
- Use the tags taxonomy accurately — only use tags that genuinely apply.
- Produce 2-5 recommended questions specific to this document's actual issues.
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

const QC_MIN_FINDINGS_LARGE = 5;
const QC_MIN_FINDINGS_SMALL = 3;
const QC_MIN_CLAUSE_CARDS = 3;
const QC_MIN_FIELD_LENGTH = 20;
const QC_MIN_REPORT_JSON_LENGTH = 4000;
const QC_SMALL_DOC_CHAR_THRESHOLD = 8000;
const QC_RETRY_JSON_CAP = 30_000;

const DEFAULT_MAX_INPUT_CHARS = 96_000;
const DEFAULT_MAX_INPUT_CHARS_OPUS = 288_000;

function getMaxInputChars(backend: string, model?: string): number {
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
      }
    }
    if (Array.isArray(obj.clauseCards)) {
      for (let i = 0; i < obj.clauseCards.length; i++) {
        const c = obj.clauseCards[i];
        if (!c.clauseId) c.clauseId = `c-${i + 1}`;
        if (!Array.isArray(c.whatToDo)) c.whatToDo = [];
      }
    }

    return JSON.stringify(obj);
  } catch {
    return raw;
  }
}

async function callOpenAI(
  messages: OpenAI.ChatCompletionMessageParam[],
  overrides?: { model?: string; maxTokens?: number; temperature?: number },
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured.");
  const model = overrides?.model ?? getOpenAIModel();
  const temperature = overrides?.temperature ?? TEMPERATURE;
  const maxTokens = overrides?.maxTokens ?? MAX_OUTPUT_TOKENS;
  const client = new OpenAI({ apiKey, maxRetries: 2 });
  const completion = await client.chat.completions.create({
    model,
    temperature,
    max_tokens: maxTokens,
    response_format: { type: "json_object" },
    messages,
  });
  const text = completion.choices[0]?.message?.content;
  if (!text) throw new Error("Empty response from OpenAI.");
  console.log("[llm]", {
    backend: "openai",
    model,
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
  isSmallDoc: boolean,
): QualityResult {
  const issues: string[] = [];

  const minFindings = isSmallDoc ? QC_MIN_FINDINGS_SMALL : QC_MIN_FINDINGS_LARGE;
  if (report.findings.length < minFindings) {
    issues.push(
      `Too few findings (${report.findings.length}, expected >= ${minFindings}).`,
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

  if (report.clauseCards.length < QC_MIN_CLAUSE_CARDS) {
    issues.push(
      `Too few clause cards (${report.clauseCards.length}, expected >= ${QC_MIN_CLAUSE_CARDS}).`,
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

  const templates = report.actions.letterTemplates;
  if (templates.length === 1 && report.findings.length > 2) {
    const lower = templates[0].title.toLowerCase();
    if (
      lower.includes("cancel") ||
      lower.includes("withdrawal") ||
      lower.includes("termination")
    ) {
      issues.push(
        "Only letter template is cancellation-oriented despite multiple findings.",
      );
    }
  }

  if (!isSmallDoc) {
    const jsonLen = JSON.stringify(report).length;
    if (jsonLen < QC_MIN_REPORT_JSON_LENGTH) {
      issues.push(
        `Report JSON too short (${jsonLen} chars, expected >= ${QC_MIN_REPORT_JSON_LENGTH}).`,
      );
    }
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

  const systemContent =
    SYSTEM_PROMPT + buildLocaleInstruction(input.locale);

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
  if (isPartial) {
    userContent += `Note: Document was truncated for processing. Included: start+middle+end. Focus on cross-section interactions.\n`;
  }
  userContent += `\n--- DOCUMENT TEXT ---\n\n`;
  userContent += chunksToSend.join("\n---\n");

  let responseText: string;
  if (backend === "anthropic") {
    responseText = await anthropicGenerateText({
      system: systemContent,
      user: userContent,
      maxTokens: effectiveMaxTokens,
      temperature: effectiveTemp,
      model: options?.model,
    });
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

  let report = parseReportJson(patchReportDefaults(responseText));

  const maxRetries = options?.maxRetries ??
    (parseInt(process.env.PLAINTERMS_LLM_MAX_RETRIES ?? "1", 10) || 1);
  const inputCharCount = chunksToSend.reduce((s, c) => s + c.length, 0);
  const isSmallDoc =
    inputCharCount < QC_SMALL_DOC_CHAR_THRESHOLD && !isPartial;
  const quality = validateReportQuality(report, isSmallDoc);

  if (!quality.ok && maxRetries > 0) {
    console.log("[llm] quality gate failed, retrying", {
      issueCount: quality.issues.length,
      issues: quality.issues,
      isSmallDoc,
      inputCharCount,
    });

    const issueBlock =
      `Issues:\n${quality.issues.map((i) => `- ${i}`).join("\n")}`;

    const revisionRules =
      `CRITICAL: Output ONLY a single JSON object. No markdown, no code fences, no explanations, no text before or after the JSON.\n` +
      `Use the previous JSON as the base. Keep the EXACT same field names (camelCase). Do not rename or remove any required fields. Only expand or add items to satisfy the issues listed above.\n` +
      `Minimum targets: at least 3 objects in "findings", at least 3 objects in "clauseCards", each with all required fields populated.\n` +
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
        retryRaw = await anthropicGenerateText({
          system: systemContent,
          user: retryUser,
          maxTokens: effectiveMaxTokens,
          temperature: effectiveTemp,
          model: options?.model,
        });
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

  return report;
}
