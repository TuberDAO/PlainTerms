import OpenAI from "openai";
import { parseReportJson } from "./report-schema";
import { MOCK_REPORT } from "./mock-report";
import type { Report } from "@/types/report";

const MAX_CHUNKS = 8;
const MODEL = "gpt-4o-mini";
const MAX_OUTPUT_TOKENS = 4096;
const TEMPERATURE = 0.2;

export interface AnalysisInput {
  locale?: string;
  title?: string;
  chunks: string[];
  chunkCount: number;
  fingerprint: string;
  sourceType: string;
}

const SYSTEM_PROMPT = `You are PlainTerms, a document analysis assistant that helps ordinary people understand contracts and legal documents. Produce a structured JSON analysis of the provided document text.

IMPORTANT RULES:
- This is NOT legal advice. Use calm, clear, non-alarmist language.
- Output ONLY valid JSON. No markdown fences, no commentary, no text outside the JSON object.
- Every string value must be plain text (no markdown formatting).

OUTPUT SCHEMA — you must return a JSON object with exactly these fields:

{
  "id": "generated",
  "locale": "<GB|US|CA|AU — use the locale provided, or infer from document language>",
  "contractFamily": "<insurance|leases|contracts|finance|employment|telecom|gym|cloud-services — infer from document content>",
  "createdAtISO": "<current ISO 8601 timestamp>",
  "isPreview": false,
  "verdict": {
    "headline": "<one-sentence overall assessment>",
    "summary": "<2-4 sentence summary of the document and key concerns>",
    "severityOverall": "<info|low|medium|high|critical>",
    "scoreOverall": <0-100 integer, where 100 means very safe and 0 means very risky>
  },
  "findings": [
    {
      "id": "<unique id like f-1, f-2>",
      "title": "<short finding title>",
      "severity": "<info|low|medium|high|critical>",
      "score": <0-100 contribution score>,
      "tags": ["<TaxonomyTag values: TimeTrap|EscapeHatch|PenaltyDisguise|SoleDiscretion|SilentWaiver|BurdenShift|SurpriseBilling|DataGrab|AutoRenew|LiabilityWaiver|ForcedArbitration|DamagesCap|ShortenedLimitations|UncappedFees|UnilateralChange>"],
      "shortWhy": "<one sentence explaining why this matters>",
      "relatedClauseIds": ["<clause IDs from clauseCards>"]
    }
  ],
  "paywalledFindingsCount": 0,
  "clauseCards": [
    {
      "clauseId": "<unique id like c-1, c-2>",
      "clauseLabel": "<short clause name>",
      "originalTextExcerpt": "<brief excerpt from the original document>",
      "atFirstGlance": "<what a person might casually think this clause means>",
      "whatItMeans": "<what it actually means in practice>",
      "scenario": "<a realistic scenario showing the impact>",
      "whatToDo": ["<actionable steps>"],
      "goDeeper": "<optional deeper explanation>",
      "risks": ["<optional specific risks>"],
      "negotiation": {
        "suggestedEdit": "<optional suggested contract edit>",
        "fallbackAsk": "<optional fallback negotiation point>"
      }
    }
  ],
  "actions": {
    "recommendedQuestions": ["<questions to ask the other party>"],
    "letterTemplates": [
      {
        "id": "<template id>",
        "title": "<template title>",
        "body": "<template letter body>"
      }
    ]
  }
}

GUIDELINES:
- Produce 3-10 findings sorted by severity (most severe first).
- Produce a corresponding clauseCard for each finding's related clause.
- scoreOverall: 80-100 for low-risk documents, 50-79 for moderate risk, below 50 for high risk.
- Each finding score represents how much that issue contributes to overall risk (higher = more impactful).
- Use the tags taxonomy accurately — only use tags that genuinely apply.
- Produce 2-5 recommended questions and at least 1 letter template.
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

export async function runReportAnalysis(
  input: AnalysisInput,
): Promise<Report> {
  if (process.env.PLAINTERMS_LLM_MODE === "mock") {
    const report: Report = JSON.parse(JSON.stringify(MOCK_REPORT));
    report.id = "generated";
    report.createdAtISO = new Date().toISOString();
    console.log("[llm] mock mode — returning fixture report");
    return report;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  const client = new OpenAI({ apiKey, maxRetries: 2 });

  const chunksToSend = input.chunks.slice(0, MAX_CHUNKS);
  const isPartial = input.chunkCount > MAX_CHUNKS;

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
  if (isPartial) {
    userContent += `Note: This document has ${input.chunkCount} sections but only the first ${MAX_CHUNKS} are provided. Base your analysis on the available text.\n`;
  }
  userContent += `\n--- DOCUMENT TEXT ---\n\n`;
  userContent += chunksToSend.join("\n---\n");

  const completion = await client.chat.completions.create({
    model: MODEL,
    temperature: TEMPERATURE,
    max_tokens: MAX_OUTPUT_TOKENS,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: systemContent },
      { role: "user", content: userContent },
    ],
  });

  const responseText = completion.choices[0]?.message?.content;
  if (!responseText) {
    throw new Error("Empty response from OpenAI.");
  }

  const tokensUsed = completion.usage?.total_tokens ?? 0;
  console.log("[llm]", {
    model: MODEL,
    tokensUsed,
    fingerprintLast4: input.fingerprint.slice(-4),
    chunksSent: chunksToSend.length,
  });

  const report = parseReportJson(responseText);

  report.id = "generated";
  report.createdAtISO = new Date().toISOString();
  report.isPreview = false;
  report.paywalledFindingsCount = 0;

  return report;
}
