export interface AnthropicGenerateInput {
  system: string;
  user: string;
  maxTokens: number;
  temperature: number;
  model?: string;
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

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: input.maxTokens,
      temperature: input.temperature,
      system: [
        {
          type: "text",
          text: input.system,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [{ role: "user", content: input.user }],
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `Anthropic API error ${res.status}: ${body.slice(0, 200)}`,
    );
  }

  const data = await res.json();
  const text = (data.content ?? [])
    .filter((b: { type: string }) => b.type === "text")
    .map((b: { text: string }) => b.text)
    .join("");

  if (!text) {
    throw new Error("Empty response from Anthropic.");
  }

  const inputTokens = data.usage?.input_tokens ?? 0;
  const outputTokens = data.usage?.output_tokens ?? 0;
  const cacheRead = data.usage?.cache_read_input_tokens ?? 0;
  const stopReason: string | undefined = data.stop_reason ?? undefined;
  console.log("[llm]", {
    backend: "anthropic",
    model,
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
