import type {
  EmployeeLLMProvider,
  EmployeeLLMRequest,
  EmployeeLLMResponse,
  LLMCallUsage,
} from "./llm-provider";
import { pipeSSEToText } from "./openai-sse";

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
      usage?: {
        prompt_tokens?: unknown;
        completion_tokens?: unknown;
        total_tokens?: unknown;
      };
    };
    const content = data.choices?.[0]?.message?.content;

    if (typeof content !== "string" || !content) {
      throw new Error("LLM returned an empty response");
    }

    return {
      content,
      model:
        typeof data.model === "string" ? data.model : this.config.model,
      ...onlyUsage(data.usage),
    };
  }

  async generateStream(
    request: EmployeeLLMRequest,
    onToken: (text: string) => void | Promise<void>
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
        stream: true,
      }),
    });

    if (!response.ok) {
      throw new Error(`LLM request failed: HTTP ${response.status}`);
    }
    if (!response.body) {
      throw new Error("LLM returned an empty response");
    }

    const reader = pipeSSEToText(response.body).getReader();
    const decoder = new TextDecoder();
    let content = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      const text = decoder.decode(value, { stream: true });
      if (text) {
        content += text;
        await onToken(text);
      }
    }
    content += decoder.decode();

    if (!content) {
      throw new Error("LLM returned an empty response");
    }

    // Pas de compteurs en flux (l'API ne les envoie pas par defaut
    // en SSE) : absence mesuree, jamais zero invente.
    return { content, model: this.config.model };
  }
}

function asTokenCount(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : undefined;
}

/**
 * Traduit le compteur `usage` OpenAI (Meta Muse inclus) vers le
 * format interne. Champs absents ou invalides = omis (jamais 0 :
 * l'absence de mesure ne doit pas passer pour une mesure nulle).
 */
function onlyUsage(usage: {
  prompt_tokens?: unknown;
  completion_tokens?: unknown;
  total_tokens?: unknown;
} | null | undefined): { usage?: LLMCallUsage } {
  if (typeof usage !== "object" || usage === null) {
    return {};
  }
  const parsed: LLMCallUsage = {
    inputTokens: asTokenCount(usage.prompt_tokens),
    outputTokens: asTokenCount(usage.completion_tokens),
    totalTokens: asTokenCount(usage.total_tokens),
  };
  if (
    parsed.inputTokens === undefined &&
    parsed.outputTokens === undefined &&
    parsed.totalTokens === undefined
  ) {
    return {};
  }
  return {
    usage: {
      ...(parsed.inputTokens !== undefined
        ? { inputTokens: parsed.inputTokens }
        : {}),
      ...(parsed.outputTokens !== undefined
        ? { outputTokens: parsed.outputTokens }
        : {}),
      ...(parsed.totalTokens !== undefined
        ? { totalTokens: parsed.totalTokens }
        : {}),
    },
  };
}
