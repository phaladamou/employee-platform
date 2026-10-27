
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

const apiKey = process.env.DEEPSEEK_API_KEY;

if (!apiKey) {
  throw new Error(
    "DEEPSEEK_API_KEY is missing. Check Scientia Labs/.env.local."
  );
}

const baseURL =
  process.env.DEEPSEEK_BASE_URL ??
  "https://api.deepseek.com/v1";

const deepseek = createOpenAI({
  apiKey,
  baseURL,
});

export class DeepSeekProvider implements LLMProvider {
  readonly id = "deepseek";
  readonly name = "DeepSeek";

  async generate(
    request: LLMRequest
  ): Promise<LLMResponse> {
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