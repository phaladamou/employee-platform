// lib/ai/providers.ts
import { createOpenAI } from "@ai-sdk/openai";
import { customProvider } from "ai";
import { isTestEnvironment } from "../constants";

const deepseek = createOpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL || "https://api.deepseek.com/v1",
});

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

export function getLanguageModel(modelId: string) {
  if (isTestEnvironment && myProvider) {
    return myProvider.languageModel(modelId);
  }

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
  return deepseek.chat("deepseek-chat");
}
