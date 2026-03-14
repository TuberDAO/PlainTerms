export interface AnthropicGenerateInput {
  system: string;
  user: string;
  maxTokens: number;
  temperature: number;
  model?: string;
  /** When true, use SSE streaming to avoid long-poll connection drops. */
  stream?: boolean;
  /** Request-level timeout in milliseconds. Default: 120_000 (2 min). */
  timeoutMs?: number;
}

export interface AnthropicResult {
  text: string;
  stopReason?: string;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    cacheReadTokens?: number;
  };
}

const DEFAULT_MODEL = "claude-opus-4-6";
const DEFAULT_TIMEOUT_MS = 120_000;
const LONG_REQUEST_TIMEOUT_MS = 300_000;

/**
 * Returns true when the error looks like a transient network/transport failure
 * (connection reset, DNS, timeout, abort) rather than an API-level or schema error.
 * Exported for use in retry classification.
 */
export function isTransientTransportError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message.toLowerCase();
  return (
    msg.includes("fetch failed") ||
    msg.includes("econnreset") ||
    msg.includes("econnrefused") ||
    msg.includes("etimedout") ||
    msg.includes("socket hang up") ||
    msg.includes("network") ||
    msg.includes("aborted") ||
    msg.includes("upstream connect error") ||
    err.name === "AbortError"
  );
}

function anthropicHeaders(apiKey: string): Record<string, string> {
  return {
    "x-api-key": apiKey,
    "anthropic-version": "2023-06-01",
    "content-type": "application/json",
  };
}

function anthropicRequestBody(
  input: AnthropicGenerateInput,
  model: string,
  stream: boolean,
): string {
  return JSON.stringify({
    model,
    max_tokens: input.maxTokens,
    temperature: input.temperature,
    ...(stream ? { stream: true } : {}),
    system: [
      {
        type: "text",
        text: input.system,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [{ role: "user", content: input.user }],
  });
}

/**
 * Collect full text from an Anthropic SSE stream.
 * Reads `content_block_delta` events for text and `message_delta` for stop_reason/usage.
 */
async function collectAnthropicStream(
  res: Response,
): Promise<{ text: string; stopReason?: string; usage: { inputTokens: number; outputTokens: number; cacheReadTokens: number } }> {
  const reader = res.body?.getReader();
  if (!reader) throw new Error("Anthropic streaming response has no body.");

  const decoder = new TextDecoder();
  let buffer = "";
  const textParts: string[] = [];
  let stopReason: string | undefined;
  let inputTokens = 0;
  let outputTokens = 0;
  let cacheReadTokens = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const payload = line.slice(6).trim();
        if (payload === "[DONE]") continue;

        let event: Record<string, unknown>;
        try {
          event = JSON.parse(payload);
        } catch {
          continue;
        }

        const eventType = event.type as string | undefined;

        if (eventType === "content_block_delta") {
          const delta = event.delta as { type?: string; text?: string } | undefined;
          if (delta?.type === "text_delta" && delta.text) {
            textParts.push(delta.text);
          }
        } else if (eventType === "message_start") {
          const message = event.message as { usage?: { input_tokens?: number; cache_read_input_tokens?: number } } | undefined;
          if (message?.usage) {
            inputTokens = message.usage.input_tokens ?? 0;
            cacheReadTokens = message.usage.cache_read_input_tokens ?? 0;
          }
        } else if (eventType === "message_delta") {
          const delta = event.delta as { stop_reason?: string } | undefined;
          if (delta?.stop_reason) stopReason = delta.stop_reason;
          const usage = event.usage as { output_tokens?: number } | undefined;
          if (usage?.output_tokens) outputTokens = usage.output_tokens;
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  const text = textParts.join("");
  return { text, stopReason, usage: { inputTokens, outputTokens, cacheReadTokens } };
}

export async function anthropicGenerateText(
  input: AnthropicGenerateInput,
): Promise<AnthropicResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY is not configured. Set it in .env.local or environment.",
    );
  }

  const model =
    input.model ?? process.env.PLAINTERMS_ANTHROPIC_MODEL ?? DEFAULT_MODEL;

  const useStream = input.stream ?? false;
  const timeoutMs = input.timeoutMs ??
    (useStream ? LONG_REQUEST_TIMEOUT_MS : DEFAULT_TIMEOUT_MS);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  console.log("[anthropic] request", {
    model,
    maxTokens: input.maxTokens,
    stream: useStream,
    timeoutMs,
  });

  let res: Response;
  try {
    res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: anthropicHeaders(apiKey),
      body: anthropicRequestBody(input, model, useStream),
      signal: controller.signal,
    });
  } catch (fetchErr) {
    clearTimeout(timer);
    if (controller.signal.aborted) {
      const err = new Error(
        `Anthropic request timed out after ${timeoutMs}ms (stream=${useStream}).`,
      );
      err.name = "AbortError";
      throw err;
    }
    throw fetchErr;
  }

  if (!res.ok) {
    clearTimeout(timer);
    const body = await res.text().catch(() => "");
    throw new Error(
      `Anthropic API error ${res.status}: ${body.slice(0, 200)}`,
    );
  }

  let text: string;
  let stopReason: string | undefined;
  let inputTokens = 0;
  let outputTokens = 0;
  let cacheRead = 0;

  if (useStream) {
    try {
      const streamResult = await collectAnthropicStream(res);
      text = streamResult.text;
      stopReason = streamResult.stopReason;
      inputTokens = streamResult.usage.inputTokens;
      outputTokens = streamResult.usage.outputTokens;
      cacheRead = streamResult.usage.cacheReadTokens;
    } catch (streamErr) {
      clearTimeout(timer);
      if (controller.signal.aborted) {
        const err = new Error(
          `Anthropic streaming timed out after ${timeoutMs}ms.`,
        );
        err.name = "AbortError";
        throw err;
      }
      throw streamErr;
    }
  } else {
    let data: Record<string, unknown>;
    try {
      data = await res.json();
    } catch (jsonErr) {
      clearTimeout(timer);
      throw jsonErr;
    }
    text = ((data.content ?? []) as Array<{ type: string; text?: string }>)
      .filter((b) => b.type === "text")
      .map((b) => b.text ?? "")
      .join("");
    inputTokens = (data.usage as Record<string, number> | undefined)?.input_tokens ?? 0;
    outputTokens = (data.usage as Record<string, number> | undefined)?.output_tokens ?? 0;
    cacheRead = (data.usage as Record<string, number> | undefined)?.cache_read_input_tokens ?? 0;
    stopReason = (data.stop_reason as string | undefined) ?? undefined;
  }

  clearTimeout(timer);

  if (!text) {
    throw new Error("Empty response from Anthropic.");
  }

  console.log("[anthropic] response", {
    model,
    stream: useStream,
    inputTokens,
    outputTokens,
    ...(cacheRead > 0 ? { cacheReadTokens: cacheRead } : {}),
    ...(stopReason ? { stopReason } : {}),
  });

  return {
    text,
    stopReason,
    usage: {
      inputTokens,
      outputTokens,
      ...(cacheRead > 0 ? { cacheReadTokens: cacheRead } : {}),
    },
  };
}
