// lib/ai/chat-provider.ts
//
// Fabrique du modele de chat : Muse, fournisseur unique.
// La resolution env vit dans core/models/chat-provider.ts
// (source unique, testee).
import { createOpenAI } from "@ai-sdk/openai";

import { resolveChatLLM } from "@/core/models/chat-provider";

export function getChatLanguageModel() {
  const llm = resolveChatLLM();
  return createOpenAI({ apiKey: llm.apiKey, baseURL: llm.baseURL }).chat(
    llm.model
  );
}
