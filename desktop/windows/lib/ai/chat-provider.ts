// lib/ai/chat-provider.ts
//
// Fabrique du modele de chat : Muse, fournisseur unique.
// La resolution env vit dans core/models/chat-provider.ts
// (source unique, testee).
import { createOpenAI } from "@ai-sdk/openai";

import { resolveChatLLM } from "@/core/models/chat-provider";
import { isTestEnvironment } from "@/lib/constants";

export function getChatLanguageModel() {
  // Bureau/CI (electron/e2e-chat.mjs) : modele simule, aucun appel LLM
  // reel. Meme declencheur que isTestEnvironment (PLAYWRIGHT/CI_PLAYWRIGHT).
  if (isTestEnvironment) {
    const { chatModel } = require("./models.mock");
    return chatModel;
  }
  const llm = resolveChatLLM();
  return createOpenAI({ apiKey: llm.apiKey, baseURL: llm.baseURL }).chat(
    llm.model
  );
}
