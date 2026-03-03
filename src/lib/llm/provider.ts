/**
 * LLM provider interface — Phase B stub.
 * No actual LLM calls are made in Phase A.
 */

export interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LLMResponse {
  content: string;
  tokensUsed: number;
  model: string;
}

export interface LLMProvider {
  name: string;
  chat(messages: LLMMessage[]): Promise<LLMResponse>;
  estimateTokens(text: string): number;
}

export class OpenAIProvider implements LLMProvider {
  name = "openai";

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async chat(_messages: LLMMessage[]): Promise<LLMResponse> {
    throw new Error(
      "LLM calls are not enabled in Phase A. This is a stub provider."
    );
  }

  estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function createProvider(_name: string = "openai"): LLMProvider {
  return new OpenAIProvider();
}
