// core/models/chat-provider.ts
//
// Fournisseur LLM unique des reponses : Muse (Meta,
// OpenAI-compatible). Noms de variables alignes sur
// core/employee/cli.ts. Verrouille par chat-provider.test.ts :
// `node --test core/models/chat-provider.test.ts`.
export const CHAT_REASONING_EFFORTS = [
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
] as const;

export type ChatReasoningEffort = (typeof CHAT_REASONING_EFFORTS)[number];

export interface ChatLLMConfig {
  baseURL: string;
  apiKey: string;
  model: string;
  reasoningEffort: ChatReasoningEffort;
}

export function resolveChatLLM(
  env: Record<string, string | undefined> = process.env
): ChatLLMConfig {
  const apiKey = env.MUSE_API_KEY;
  if (!apiKey) {
    throw new Error("MUSE_API_KEY is missing (.env.local)");
  }
  const reasoningEffort = env.MUSE_REASONING_EFFORT ?? "minimal";
  if (
    !(CHAT_REASONING_EFFORTS as readonly string[]).includes(reasoningEffort)
  ) {
    throw new Error(
      `MUSE_REASONING_EFFORT must be one of ${CHAT_REASONING_EFFORTS.join(", ")} (got "${reasoningEffort}")`
    );
  }
  return {
    baseURL: env.MUSE_BASE_URL ?? "https://api.meta.ai/v1",
    apiKey,
    model: env.MUSE_MODEL ?? "muse-spark-1.3",
    reasoningEffort: reasoningEffort as ChatReasoningEffort,
  };
}
