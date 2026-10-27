
export interface LLMMessage {
  readonly role: "system" | "user" | "assistant";
  readonly content: string;
}

export interface LLMRequest {
  readonly messages: readonly LLMMessage[];
  readonly temperature?: number;
  readonly maxTokens?: number;
}

export interface LLMResponse {
  readonly content: string;
  readonly model: string;
  readonly usage?: {
    readonly inputTokens?: number;
    readonly outputTokens?: number;
  };
}

export interface LLMProvider {
  readonly id: string;
  readonly name: string;

  generate(request: LLMRequest): Promise<LLMResponse>;
}
