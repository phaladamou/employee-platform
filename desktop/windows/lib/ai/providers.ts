// lib/ai/providers.ts
import { createOpenAI } from "@ai-sdk/openai";
import { customProvider } from "ai";

import { resolveChatLLM } from "@/core/models/chat-provider";
import { isTestEnvironment } from "../constants";

export const myProvider = isTestEnvironment
  ? (() => {
      const { chatModel, titleModel } = require("./models.mock");
      return customProvider({
        languageModels: {
          "chat-model": chatModel,
          "title-model": titleModel,
        },
      });
    })()
  : null;

function createMuseClient() {
  // Client cree a chaque appel : la configuration est lue au moment de
  // l'usage, ce qui permet de changer de cle API sans redemarrer.
  const llm = resolveChatLLM();
  return createOpenAI({
    apiKey: llm.apiKey,
    baseURL: llm.baseURL,
  });
}

export function getLanguageModel(_modelId: string) {
  if (isTestEnvironment && myProvider) {
    return myProvider.languageModel("chat-model");
  }

  return createMuseClient().chat(resolveChatLLM().model);
}

export function getTitleModel() {
  if (isTestEnvironment && myProvider) {
    return myProvider.languageModel("title-model");
  }
  return createMuseClient().chat(resolveChatLLM().model);
}
