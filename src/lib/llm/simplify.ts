import OpenAI from "openai";

// ---------------------------------------------------------------------------
// Model selection
// ---------------------------------------------------------------------------

/**
 * Dedicated env var for the simplification model.
 * Fallback chain: PLAINTERMS_SIMPLIFY_MODEL → PLAINTERMS_OPENAI_MODEL → "gpt-4o-mini"
 *
 * Simplification intentionally always uses OpenAI (cheap, fast, controllable).
 * It does NOT follow PLAINTERMS_LLM_BACKEND because Anthropic is unnecessary here.
 */
export function getSimplifyModel(): string {
  return (
    process.env.PLAINTERMS_SIMPLIFY_MODEL ??
    process.env.PLAINTERMS_OPENAI_MODEL ??
    "gpt-4o-mini"
  );
}

// ---------------------------------------------------------------------------
// Prompt
// ---------------------------------------------------------------------------

const SIMPLIFY_SYSTEM_PROMPT = `You are a plain-English rewriter. Your only job is to rewrite a short piece of text using simpler, more everyday words.

STRICT RULES — you must follow every rule below:

WHAT YOU MUST DO:
- Rewrite using simpler words and shorter sentences.
- Break long sentences into two or three shorter ones.
- Replace jargon with everyday equivalents. If a technical term must stay, add a plain-word explanation right after it.
- Preserve every caveat, condition, and limitation that exists in the original.
- Keep the output roughly the same length as the input, or shorter. Do not pad.
- Return ONLY the rewritten text. No introduction, no label, no commentary.

WHAT YOU MUST NOT DO — these are absolute prohibitions:
- Do NOT add examples or "for example" phrases that were not in the original text.
- Do NOT add "such as" with items not already listed in the original.
- Do NOT add numbers, percentages, amounts, dates, or timeframes not present in the original.
- Do NOT introduce outcomes, scenarios, or consequences not stated in the original.
- Do NOT expand the scope of what the original says — do not imply broader or narrower coverage.
- Do NOT add legal analysis, legal advice, practical recommendations, or warnings beyond what is already stated.
- Do NOT add caveats or disclaimers not already present.
- Do NOT remove important caveats or conditions that ARE present.
- Do NOT paraphrase in a way that changes what the text actually says.
- Do NOT add "this means that..." elaborations that go beyond the original.
- Keep the tone calm and neutral. Do not make the text sound more alarming or more reassuring than the original.

IF IN DOUBT: use the original words rather than risk adding meaning. Simplify what you can; leave the rest unchanged.`;

const RETRY_PREFIX =
  "IMPORTANT: Your previous rewrite added content that was not in the original text.\n" +
  "This is NOT allowed. You must ONLY rewrite the words already there — do not add anything new.\n\n" +
  "Issues detected:\n";

// ---------------------------------------------------------------------------
// Public constants
// ---------------------------------------------------------------------------

/** Max characters accepted from the caller. Enforced in the API route too. */
export const SIMPLIFY_MAX_INPUT_CHARS = 1500;

/** Max output tokens for the simplified version. */
const SIMPLIFY_MAX_OUTPUT_TOKENS = 400;

// ---------------------------------------------------------------------------
// Invention detection heuristic
// ---------------------------------------------------------------------------

/**
 * Returns a list of signals suggesting the simplified text added content
 * that was NOT present in the original. An empty array means no signals detected.
 *
 * Exported so it can be unit-tested without an API key.
 */
export function detectInvention(
  original: string,
  simplified: string,
): string[] {
  const issues: string[] = [];
  const origLower = original.toLowerCase();
  const simpLower = simplified.toLowerCase();

  // --- "for example" / "e.g." added ----------------------------------------
  if (
    !origLower.includes("for example") &&
    (simpLower.includes("for example") || simpLower.includes("e.g."))
  ) {
    issues.push(
      'Simplified text added "for example" or "e.g." not present in the original.',
    );
  }

  // --- "such as" with new elaboration added ---------------------------------
  if (!origLower.includes("such as") && simpLower.includes("such as")) {
    issues.push(
      'Simplified text added "such as" elaboration not present in the original.',
    );
  }

  // --- New multi-digit numbers introduced -----------------------------------
  // Extract sequences of 2+ digits that look like amounts/quantities.
  const origNumbers = new Set(
    (original.match(/\b\d{2,}(?:[.,]\d+)?\b/g) ?? []).map((n) =>
      n.replace(/,/g, ""),
    ),
  );
  const simpNumbers = (simplified.match(/\b\d{2,}(?:[.,]\d+)?\b/g) ?? []).map(
    (n) => n.replace(/,/g, ""),
  );
  for (const n of simpNumbers) {
    if (!origNumbers.has(n)) {
      issues.push(
        `Simplified text added a number not in the original: "${n}".`,
      );
      break; // Report only once per check to avoid noise
    }
  }

  // --- Output substantially longer than input (> 160% by word count) --------
  const origWords = original.trim().split(/\s+/).length;
  const simpWords = simplified.trim().split(/\s+/).length;
  if (simpWords > Math.ceil(origWords * 1.6)) {
    issues.push(
      `Simplified text is significantly longer than the original (${simpWords} words vs ${origWords} words — exceeds 160% threshold).`,
    );
  }

  return issues;
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export interface SimplifyResult {
  simplified: string;
  model: string;
  inventionIssues: string[];
  retried: boolean;
}

/**
 * Rewrites a short block of PlainTerms-generated text in simpler language.
 *
 * Uses the OpenAI model configured by PLAINTERMS_SIMPLIFY_MODEL
 * (or PLAINTERMS_OPENAI_MODEL, or "gpt-4o-mini" as final fallback).
 *
 * Runs a lightweight invention-detection heuristic after the first attempt.
 * If issues are detected, retries ONCE with a stricter prompt (temp 0.0).
 * If the retry also has issues, it is returned anyway — never blocks the user.
 */
export async function simplifyText(text: string): Promise<SimplifyResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured.");

  const model = getSimplifyModel();
  const client = new OpenAI({ apiKey, maxRetries: 1 });

  // First attempt — low temperature for faithfulness.
  const first = await client.chat.completions.create({
    model,
    temperature: 0.1,
    max_tokens: SIMPLIFY_MAX_OUTPUT_TOKENS,
    messages: [
      { role: "system", content: SIMPLIFY_SYSTEM_PROMPT },
      { role: "user", content: text },
    ],
  });

  const firstResult = first.choices[0]?.message?.content?.trim();
  if (!firstResult) throw new Error("Empty response from simplification model.");

  const firstIssues = detectInvention(text, firstResult);

  console.log("[simplify]", {
    model,
    inputChars: text.length,
    outputChars: firstResult.length,
    inputTokens: first.usage?.prompt_tokens ?? 0,
    outputTokens: first.usage?.completion_tokens ?? 0,
    inventionIssues: firstIssues.length,
  });

  // No issues — return immediately.
  if (firstIssues.length === 0) {
    return {
      simplified: firstResult,
      model,
      inventionIssues: [],
      retried: false,
    };
  }

  // Issues detected — retry ONCE at temperature 0 with explicit correction.
  const issueList = firstIssues.map((i) => `- ${i}`).join("\n");
  const retryUserContent =
    RETRY_PREFIX + issueList + "\n\nORIGINAL TEXT TO SIMPLIFY:\n" + text;

  console.log("[simplify] invention detected, retrying", {
    model,
    issues: firstIssues,
  });

  let retryResult: string | null = null;
  let retryIssues: string[] = [];

  try {
    const retry = await client.chat.completions.create({
      model,
      temperature: 0.0,
      max_tokens: SIMPLIFY_MAX_OUTPUT_TOKENS,
      messages: [
        { role: "system", content: SIMPLIFY_SYSTEM_PROMPT },
        { role: "user", content: retryUserContent },
      ],
    });

    retryResult = retry.choices[0]?.message?.content?.trim() ?? null;

    if (retryResult) {
      retryIssues = detectInvention(text, retryResult);
      console.log("[simplify] retry completed", {
        model,
        outputChars: retryResult.length,
        inventionIssuesAfterRetry: retryIssues.length,
        inputTokens: retry.usage?.prompt_tokens ?? 0,
        outputTokens: retry.usage?.completion_tokens ?? 0,
      });
    }
  } catch (err) {
    // Retry failed — fall back to first result, log and continue.
    console.warn(
      "[simplify] retry call failed, using first result:",
      err instanceof Error ? err.message : "unknown",
    );
  }

  // Prefer retry result if we got one; otherwise fall back to first.
  const finalResult = retryResult ?? firstResult;
  const finalIssues = retryResult ? retryIssues : firstIssues;

  return {
    simplified: finalResult,
    model,
    inventionIssues: finalIssues,
    retried: true,
  };
}
