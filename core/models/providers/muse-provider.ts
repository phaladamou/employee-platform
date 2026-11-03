import dotenv from "dotenv";
import { createOpenAI } from "@ai-sdk/openai";
import { generateText } from "ai";

import type {
  LLMProvider,
  LLMRequest,
  LLMResponse,
} from "../llm-provider";
import { resolveChatLLM } from "../chat-provider";

// Charge explicitement .env.local
dotenv.config({
  path: ".env.local",
});

export class MuseProvider implements LLMProvider {
  readonly id = "muse";
  readonly name = "Muse";

  async generate(
    request: LLMRequest
  ): Promise<LLMResponse> {
    // Resolution paresseuse : l'absence de cle ne doit pas faire
    // echouer le chargement du module.
    const llm = resolveChatLLM();
    const client = createOpenAI({
      apiKey: llm.apiKey,
      baseURL: llm.baseURL,
    });

    const result = await generateText({
      model: client.chat(llm.model),

      messages: request.messages.map((message) => ({
        role: message.role,
        content: message.content,
      })),

      temperature: request.temperature,
    });

    return {
      content: result.text,
      model: llm.model,

      usage: result.usage
        ? {
            inputTokens: result.usage.inputTokens,
            outputTokens: result.usage.outputTokens,
          }
        : undefined,
    };
  }
}
