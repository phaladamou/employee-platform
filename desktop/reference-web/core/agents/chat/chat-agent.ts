import { createOpenAI } from "@ai-sdk/openai";
import {
  jsonSchema,
  stepCountIs,
  streamText,
  tool,
  type ModelMessage,
} from "ai";

import type { Agent } from "../agent";
import type { AgentContext } from "../agent-context";

import type { CoreEvent } from "../../contracts/output";

import { systemPrompt } from "./prompts";
import type { ChatAgentContext } from "./chat-types";

export class ChatAgent implements Agent {
  readonly id = "chat";
  readonly type = "chat";

  private context: AgentContext | null = null;

  async initialize(context: AgentContext): Promise<void> {
    this.context = context;
  }

  async execute(_input: unknown): Promise<{ text: string }> {
    if (!this.context) {
      throw new Error("ChatAgent has not been initialized");
    }

    const { input, host, emit } = this.context;

    if (!input) {
      throw new Error(
        "ChatAgent requires CoreInput in its execution context."
      );
    }

    if (!host) {
      throw new Error(
        "ChatAgent requires CoreHost in its execution context."
      );
    }

    if (!emit) {
      throw new Error(
        "ChatAgent requires an event emitter in its execution context."
      );
    }

    try {
      emit({
        type: "status",
        message: "Préparation du contexte...",
      });

      const history = await host.getConversation(
        input.currentChatId
      );

      const supportsTools =
        input.capabilities?.tools ?? true;

      const agentContext: ChatAgentContext = {
        input,
        history,
        systemPrompt: systemPrompt({
          supportsTools,
          mode: input.mode,
        }),
        activeTools: supportsTools
          ? ["webSearch"]
          : [],
      };

      const modelMessages =
        this.buildModelMessages(agentContext);

      const deepseek = createOpenAI({
        apiKey: process.env.DEEPSEEK_API_KEY,
        baseURL:
          process.env.DEEPSEEK_BASE_URL ??
          "https://api.deepseek.com/v1",
      });

      emit({
        type: "status",
        message: "Réflexion en cours...",
      });

      const result = streamText({
        model: deepseek.chat("deepseek-chat"),
        system: agentContext.systemPrompt,
        messages: modelMessages,
        stopWhen: stepCountIs(5),
        toolChoice: "auto",
        tools: supportsTools
          ? this.buildTools()
          : {},
      });

      let accumulatedText = "";

      for await (const part of result.fullStream) {
        const textDelta = this.handleStreamPart(part, emit);
        if (textDelta) {
          accumulatedText += textDelta;
        }
      }

      emit({
        type: "done",
      });

      return { text: accumulatedText };
    } catch (error) {
      console.error(
        "🧠 [ChatAgent] ERREUR:",
        error
      );

      const message =
        error instanceof Error
          ? error.message
          : "Erreur inconnue";

      emit({
        type: "error",
        message,
      });

      throw error;
    }
  }

  async shutdown(): Promise<void> {
    this.context = null;
  }

  private buildModelMessages(
    ctx: ChatAgentContext
  ): ModelMessage[] {
    const messages: ModelMessage[] = [];

    for (const msg of ctx.history) {
      messages.push({
        role:
          msg.role === "system"
            ? "system"
            : msg.role,
        content:
          this.extractTextFromParts(
            msg.parts
          ),
      });
    }

    messages.push({
      role: "user",
      content: ctx.input.message.text,
    });

    return messages;
  }

  private extractTextFromParts(
    parts: readonly unknown[]
  ): string {
    const texts: string[] = [];

    for (const part of parts) {
      if (
        typeof part === "object" &&
        part !== null &&
        "type" in part &&
        (part as { type: string }).type ===
          "text" &&
        "text" in part
      ) {
        texts.push(
          String(
            (part as { text: unknown })
              .text
          )
        );
      }
    }

    return texts.join("\n");
  }

  private buildTools() {
    return {
      webSearch: tool({
        description:
          "Search the web for current information, news, and recent events.",

        inputSchema:
          jsonSchema<{ query: string }>({
            type: "object",
            properties: {
              query: {
                type: "string",
                description:
                  "The search query",
              },
            },
            required: ["query"],
          }),

        execute: async ({ query }) => {
          if (!this.context) {
            throw new Error(
              "ChatAgent has not been initialized"
            );
          }

          const capability =
            this.context.capabilities.get(
              "web-search"
            );

          return capability.execute({
            query,
          });
        },
      }),
    };
  }

  /**
   * Traite une part de `streamText().fullStream`.
   *
   * Retourne le delta de texte accumulable si la part est un
   * text-delta, sinon `undefined`.
   *
   * Forme constatée en AI SDK v6 :
   *   { type: "text-delta", id: "0", text: "Bon" }
   *   { type: "text-start", id: "0" }
   *   { type: "text-end",   id: "0" }
   *   { type: "start" }
   *   { type: "start-step", request: {...}, warnings: [] }
   *   { type: "finish-step", finishReason, usage, ... }
   *   { type: "finish", finishReason, totalUsage }
   */
  private handleStreamPart(
    part: unknown,
    emit: (event: CoreEvent) => void
  ): string | undefined {
    if (
      typeof part !== "object" ||
      part === null
    ) {
      return undefined;
    }

    const p = part as {
      type: string;
      [key: string]: unknown;
    };

    switch (p.type) {
      case "text-delta": {
        const delta =
          typeof p.text === "string"
            ? p.text
            : typeof p.delta === "string"
              ? p.delta
              : typeof p.textDelta === "string"
                ? p.textDelta
                : undefined;

        if (delta !== undefined && delta.length > 0) {
          emit({
            type: "text_delta",
            text: delta,
          });

          return delta;
        }

        return undefined;
      }

      case "reasoning": {
        const delta =
          typeof p.text === "string"
            ? p.text
            : typeof p.delta === "string"
              ? p.delta
              : typeof p.textDelta === "string"
                ? p.textDelta
                : undefined;

        if (delta !== undefined && delta.length > 0) {
          emit({
            type: "reasoning_delta",
            text: delta,
          });
        }

        return undefined;
      }

      case "tool-call":
        emit({
          type: "tool_started",
          toolName: String(p.toolName),
          toolCallId: String(p.toolCallId),
          input: p.args,
        });
        return undefined;

      case "tool-result":
        emit({
          type: "tool_result",
          toolCallId: String(p.toolCallId),
          output: p.result,
        });
        return undefined;

      case "error":
        emit({
          type: "error",
          message:
            typeof p.error === "string"
              ? p.error
              : "Erreur lors du streaming",
        });
        return undefined;

      default:
        return undefined;
    }
  }
}