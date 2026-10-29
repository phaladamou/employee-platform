import type {
  EmployeeLLMProvider,
  EmployeeLLMRequest,
  EmployeeLLMResponse,
} from "./llm-provider";

export interface FetchLLMConfig {
  readonly apiKey: string;
  readonly baseUrl: string;
  readonly model: string;
  readonly temperature?: number;
}

/**
 * Fournisseur LLM generique sur HTTP (API compatible OpenAI :
 * DeepSeek, OpenAI, Ollama...). Zero dependance : `fetch` global
 * uniquement. La configuration est injectee (jamais lue depuis
 * l'environnement ici : c'est le role du point d'entree appelant).
 */
export class FetchLLMProvider implements EmployeeLLMProvider {
  readonly id = "fetch-openai-compatible";

  private readonly config: Required<Pick<FetchLLMConfig, "temperature">> &
    FetchLLMConfig;

  constructor(config: FetchLLMConfig) {
    if (!config.apiKey) {
      throw new Error("FetchLLMProvider requires an apiKey");
    }
    if (!config.baseUrl) {
      throw new Error("FetchLLMProvider requires a baseUrl");
    }
    if (!config.model) {
      throw new Error("FetchLLMProvider requires a model");
    }

    this.config = { temperature: 0.3, ...config };
  }

  async generate(
    request: EmployeeLLMRequest
  ): Promise<EmployeeLLMResponse> {
    const url = `${this.config.baseUrl.replace(/\/+$/, "")}/chat/completions`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: this.config.model,
        messages: request.messages.map((message) => ({
          role: message.role,
          content: message.content,
        })),
        temperature: request.temperature ?? this.config.temperature,
      }),
    });

    if (!response.ok) {
      throw new Error(`LLM request failed: HTTP ${response.status}`);
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: unknown } }>;
      model?: unknown;
    };
    const content = data.choices?.[0]?.message?.content;

    if (typeof content !== "string" || !content) {
      throw new Error("LLM returned an empty response");
    }

    return {
      content,
      model:
        typeof data.model === "string" ? data.model : this.config.model,
    };
  }
}
