
import dotenv from "dotenv";
import { createOpenAI } from "@ai-sdk/openai";
import { generateText } from "ai";

import type {
  LLMProvider,
  LLMRequest,
  LLMResponse,
} from "../llm-provider";

// Charge explicitement .env.local
dotenv.config({
  path: ".env.local",
});

function getClient() {
  // Resolution paresseuse : l'absence de cle ne doit pas faire echouer
  // le chargement du module.
  const apiKey = process.env.DEEPSEEK_API_KEY;

  if (!apiKey) {
    throw new Error(
      "DEEPSEEK_API_KEY is missing. Check Scientia Labs/.env.local."
    );
  }

  return createOpenAI({
    apiKey,
    baseURL:
      process.env.DEEPSEEK_BASE_URL ??
      "https://api.deepseek.com/v1",
  });
}

export class DeepSeekProvider implements LLMProvider {
  readonly id = "deepseek";
  readonly name = "DeepSeek";

  async generate(
    request: LLMRequest
  ): Promise<LLMResponse> {
    const deepseek = getClient();

    const result = await generateText({
      model: deepseek.chat("deepseek-chat"),

      messages: request.messages.map((message) => ({
        role: message.role,
        content: message.content,
      })),

      temperature: request.temperature,
    });

    return {
      content: result.text,
      model: "deepseek-chat",

      usage: result.usage
        ? {
            inputTokens: result.usage.inputTokens,
            outputTokens: result.usage.outputTokens,
          }
        : undefined,
    };
  }
}
