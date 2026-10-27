// lib/ai/providers.ts
import { createOpenAI } from "@ai-sdk/openai";
import { customProvider } from "ai";
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

function createDeepSeekClient() {
  // Client cree a chaque appel : la configuration est lue au moment de
  // l'usage, ce qui permet de changer de cle API sans redemarrer.
  return createOpenAI({
    apiKey: process.env.DEEPSEEK_API_KEY,
    baseURL: process.env.OPENAI_BASE_URL || "https://api.deepseek.com/v1",
  });
}

export function getLanguageModel(modelId: string) {
  if (isTestEnvironment && myProvider) {
    return myProvider.languageModel(modelId);
  }

  const deepseek = createDeepSeekClient();

  const deepseekModelId = modelId.includes("/")
    ? modelId.split("/")[1]
    : modelId;

  const finalModelId = modelId.includes("deepseek")
    ? deepseekModelId
    : "deepseek-chat";

  return deepseek.chat(finalModelId);
}

export function getTitleModel() {
  if (isTestEnvironment && myProvider) {
    return myProvider.languageModel("title-model");
  }
  return createDeepSeekClient().chat("deepseek-chat");
}
