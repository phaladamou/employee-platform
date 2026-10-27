
// app/(chat)/api/chat/route.ts
import { geolocation, ipAddress } from "@vercel/functions";
import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  generateId,
  type ModelMessage,
  stepCountIs,
  streamText,
  type UIMessage,
} from "ai";
import { checkBotId } from "botid/server";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import { after } from "next/server";
import postgres from "postgres";
import { createResumableStreamContext } from "resumable-stream";

import { auth, type UserType } from "@/app/(auth)/auth";

import {
  appCore,
  buildCoreInput,
  createAppCoreHost,
} from "@/lib/core/adapter";

import { entitlementsByUserType } from "@/lib/ai/entitlements";
import {
  allowedModelIds,
  chatModels,
  DEFAULT_CHAT_MODEL,
  getCapabilities,
} from "@/lib/ai/models";
import { type RequestHints, systemPrompt } from "@/lib/ai/prompts";
import { getLanguageModel } from "@/lib/ai/providers";
import { calculate } from "@/lib/ai/tools/calculate";
import { createDocument } from "@/lib/ai/tools/create-document";
import { editDocument } from "@/lib/ai/tools/edit-document";
import { getWeather } from "@/lib/ai/tools/get-weather";
import { newsSearch } from "@/lib/ai/tools/news-search";
import { requestSuggestions } from "@/lib/ai/tools/request-suggestions";
import { updateDocument } from "@/lib/ai/tools/update-document";
import { webSearch } from "@/lib/ai/tools/web-search";
import { isProductionEnvironment } from "@/lib/constants";

import {
  createStreamId,
  deleteChatById,
  getChatById,
  getMessageCountByUserId,
  getMessagesByChatId,
  saveChat,
  saveMessages,
  updateChatTitleById,
  updateMessage,
} from "@/lib/db/queries";

import type { DBMessage } from "@/lib/db/schema";
import { file } from "@/lib/db/schema";
import { ChatbotError } from "@/lib/errors";
import { extractTextFromFile } from "@/lib/files/extract";
import { checkIpRateLimit } from "@/lib/ratelimit";
import type { ChatMessage } from "@/lib/types";
import { convertToUIMessages, generateUUID } from "@/lib/utils";
import { generateTitleFromUserMessage } from "../../actions";
import {
  type PostRequestBody,
  postRequestBodySchema,
} from "./schema";

const client = postgres(process.env.POSTGRES_URL ?? "", {
  max: 10,
  idle_timeout: 30,
  connect_timeout: 10,
});

const db = drizzle(client);

export const maxDuration = 60;

function getStreamContext() {
  try {
    return createResumableStreamContext({
      waitUntil: after,
    });
  } catch (_) {
    return null;
  }
}

async function getFileContent(
  fileId: string,
): Promise<{
  name: string;
  type: string;
  data: string;
} | null> {
  const [result] = await db
    .select()
    .from(file)
    .where(eq(file.id, fileId));

  if (!result) {
    return null;
  }

  return {
    name: result.name,
    type: result.type,
    data: result.data,
  };
}

export async function POST(request: Request) {
  let requestBody: PostRequestBody;

  try {
    const json = await request.json();
    requestBody = postRequestBodySchema.parse(json);
  } catch (error) {
    console.error("Schema parse error:", error);
    return new ChatbotError("bad_request:api").toResponse();
  }

  try {
    const {
      id,
      message,
      messages,
      selectedChatModel,
      selectedVisibilityType,
      mode,
    } = requestBody;

    const [, session] = await Promise.all([
      checkBotId().catch((): null => null),
      auth(),
    ]);

    if (!session?.user) {
      return new ChatbotError("unauthorized:chat").toResponse();
    }

    const chatModel = allowedModelIds.has(selectedChatModel)
      ? selectedChatModel
      : DEFAULT_CHAT_MODEL;

    await checkIpRateLimit(ipAddress(request));

    const userType: UserType = session.user.type;

    const messageCount = await getMessageCountByUserId({
      id: session.user.id,
      differenceInHours: 1,
    });

    if (
      messageCount >
      entitlementsByUserType[userType].maxMessagesPerHour
    ) {
      return new ChatbotError("rate_limit:chat").toResponse();
    }

    // -----------------------------------------------------------------------
    // IMPORTANT :
    //
    // La présence de "messages" ne signifie PAS qu'il s'agit d'un
    // tool approval flow. Le frontend peut envoyer l'historique dans
    // une requête normale.
    //
    // L'ancien streamText() ne doit être utilisé que lorsqu'une véritable
    // réponse d'approbation d'outil est présente.
    // -----------------------------------------------------------------------

    const isToolApprovalFlow =
      Array.isArray(messages) &&
      messages.some((m) =>
        Array.isArray(m.parts) &&
        m.parts.some(
          (part: Record<string, unknown>) =>
            part.state === "approval-responded" ||
            part.state === "output-denied",
        ),
      );

    const chat = await getChatById({ id });

    let messagesFromDb: DBMessage[] = [];
    let titlePromise: Promise<string> | null = null;

    if (chat) {
      if (chat.userId !== session.user.id) {
        return new ChatbotError("forbidden:chat").toResponse();
      }

      messagesFromDb = await getMessagesByChatId({ id });
    } else if (message?.role === "user") {
      await saveChat({
        id,
        userId: session.user.id,
        title: "New chat",
        visibility: selectedVisibilityType,
      });

      titlePromise = generateTitleFromUserMessage({
        message: message as UIMessage,
      });
    }

    let uiMessages: ChatMessage[];

    if (isToolApprovalFlow && messages) {
      const dbMessages = convertToUIMessages(messagesFromDb);

      const approvalStates = new Map(
        messages.flatMap(
          (m) =>
            m.parts
              ?.filter(
                (p: Record<string, unknown>) =>
                  p.state === "approval-responded" ||
                  p.state === "output-denied",
              )
              .map((p: Record<string, unknown>) => [
                String(p.toolCallId ?? ""),
                p,
              ]) ?? [],
        ),
      );

      uiMessages = dbMessages.map((msg) => ({
        ...msg,
        parts: msg.parts.map((part) => {
          if (
            "toolCallId" in part &&
            approvalStates.has(String(part.toolCallId))
          ) {
            return {
              ...part,
              ...approvalStates.get(String(part.toolCallId)),
            };
          }

          return part;
        }),
      })) as ChatMessage[];
    } else {
      uiMessages = [
        ...convertToUIMessages(messagesFromDb),
        message as ChatMessage,
      ];
    }

    // -----------------------------------------------------------------------
    // Extraction du texte des fichiers attachés
    // -----------------------------------------------------------------------

    let enhancedUserText = "";

    const fileParts =
      message?.parts?.filter((p) => p.type === "file") ?? [];

    if (fileParts.length > 0) {
      const fileContents: string[] = [];

      const baseUrl =
        process.env.NEXT_PUBLIC_BASE_URL ||
        "http://localhost:3000";

      for (const part of fileParts) {
        const fileId = (part.url as string).split("/").pop();

        if (!fileId) {
          continue;
        }

        const fileData = await getFileContent(fileId);

        if (!fileData) {
          continue;
        }

        const extracted = await extractTextFromFile(
          fileData.data,
          fileData.type,
        );

        fileContents.push(
          `<document name="${part.name || fileData.name}" type="${part.mediaType || fileData.type}" url="${baseUrl}${part.url}">\n${extracted}\n</document>`,
        );
      }

      if (fileContents.length > 0) {
        enhancedUserText =
          `Documents joints :\n\n${fileContents.join(
            "\n\n",
          )}\n\n---\n\n`;
      }
    }

    const textPart = message?.parts?.find(
      (p) => p.type === "text",
    );

    const userText =
      (textPart && "text" in textPart ? textPart.text : "") || "";

    enhancedUserText += userText;

    const { longitude, latitude, city, country } =
      geolocation(request);

    const requestHints: RequestHints = {
      longitude,
      latitude,
      city,
      country,
    };

    // -----------------------------------------------------------------------
    // Persistence du message utilisateur
    // -----------------------------------------------------------------------

    if (message?.role === "user") {
      await saveMessages({
        messages: [
          {
            chatId: id,
            id: message.id,
            role: "user",
            parts: message.parts,
            attachments: message.attachments ?? [],
            createdAt: new Date(),
          },
        ],
      });
    }

    const modelConfig = chatModels.find(
      (m) => m.id === chatModel,
    );

    const modelCapabilities = await getCapabilities();

    const capabilities = modelCapabilities[chatModel];

    const isReasoningModel =
      capabilities?.reasoning === true;

    const supportsTools =
      capabilities?.tools === true;

    const sendReasoning =
      isReasoningModel || mode === "reasoning";

    // -----------------------------------------------------------------------
    // Préparation des anciens messages
    //
    // Ces données restent utiles au flux tool approval.
    // Le chat normal passe par Core.
    // -----------------------------------------------------------------------

    const enhancedUiMessages = uiMessages.map((msg, index) => {
      if (
        index === uiMessages.length - 1 &&
        msg.role === "user"
      ) {
        return {
          ...msg,
          parts: msg.parts.map((part) => {
            if (part.type === "text") {
              return {
                ...part,
                text: enhancedUserText,
              };
            }

            return part;
          }),
        };
      }

      return msg;
    });

    const modelMessages =
      await convertToModelMessages(enhancedUiMessages);

    const filteredMessages = modelMessages.map((msg) => ({
      ...msg,

      content: Array.isArray(
        (msg as { content: unknown }).content,
      )
        ? (
            msg as {
              content: { type: string }[];
            }
          ).content.filter(
            (part: { type: string }) =>
              part.type === "text",
          )
        : (msg as { content: unknown }).content,
    })) as ModelMessage[];

    // -----------------------------------------------------------------------
    // Ancienne logique site/reasoning.
    //
    // Elle reste utilisée uniquement par le flux tool approval.
    // -----------------------------------------------------------------------

    const siteKeywords = [
      "site",
      "landing page",
      "page web",
      "website",
      "landingpage",
      "créer un site",
      "créer une page",
    ];

    const isSiteRequest = siteKeywords.some((kw) =>
      userText.toLowerCase().includes(kw),
    );

    if (isSiteRequest && supportsTools) {
      filteredMessages.push({
        role: "system",
        content:
          `CRITICAL: You MUST call createDocument with kind='site' and title='${userText.slice(
            0,
            100,
          )}'. Do NOT write HTML in chat. Do NOT use kind='code'. Call the tool NOW and then STOP.`,
      } as ModelMessage);
    }

    if (mode === "reasoning") {
      filteredMessages.push({
        role: "system",
        content:
          "CRITICAL: You MUST begin your response with <reasoning> tags. Write your step-by-step reasoning inside, then provide your final answer. Format: <reasoning>your reasoning here</reasoning> then your answer.",
      } as ModelMessage);
    }

    // -----------------------------------------------------------------------
    // UI STREAM
    // -----------------------------------------------------------------------

    const stream = createUIMessageStream({
      originalMessages: isToolApprovalFlow
        ? uiMessages
        : undefined,

      execute: async ({ writer: dataStream }) => {
        // ================================================================
        // TOOL APPROVAL FLOW
        //
        // L'ancien chemin reste disponible uniquement pour une véritable
        // approbation/refus d'outil.
        // ================================================================

        if (isToolApprovalFlow) {
          const result = streamText({
            model: getLanguageModel(chatModel),

            system: systemPrompt({
              requestHints,
              supportsTools,
              mode,
            }),

            messages: filteredMessages,

            stopWhen: stepCountIs(5),

            toolChoice: "auto",

            experimental_activeTools:
              isReasoningModel && !supportsTools
                ? []
                : [
                    "calculate",
                    "getWeather",
                    "webSearch",
                    "newsSearch",
                    "createDocument",
                    "editDocument",
                    "updateDocument",
                    "requestSuggestions",
                  ],

            providerOptions: {
              ...(modelConfig?.gatewayOrder && {
                gateway: {
                  order: modelConfig.gatewayOrder,
                },
              }),

              ...(modelConfig?.reasoningEffort && {
                openai: {
                  reasoningEffort:
                    modelConfig.reasoningEffort,
                },
              }),
            },

            tools: {
              calculate: calculate({ dataStream }),

              getWeather,

              webSearch,

              newsSearch,

              createDocument: createDocument({
                session,
                dataStream,
                modelId: chatModel,
                chatId: id,
              }),

              editDocument: editDocument({
                dataStream,
                session,
                chatId: id,
              }),

              updateDocument: updateDocument({
                session,
                dataStream,
                modelId: chatModel,
                chatId: id,
              }),

              requestSuggestions: requestSuggestions({
                session,
                dataStream,
                modelId: chatModel,
              }),
            },

            experimental_telemetry: {
              isEnabled: isProductionEnvironment,
              functionId: "stream-text",
            },
          });

          dataStream.merge(
            result.toUIMessageStream({
              sendReasoning,
            }),
          );

          return;
        }

        // ================================================================
        // NORMAL CHAT FLOW
        //
        // APP → CORE → ORCHESTRATOR → AGENT
        // ================================================================

        console.log(
          "[APP → CORE] Sending mission:",
          enhancedUserText,
        );

        const coreInput = buildCoreInput({
          userId: session.user.id,

          chatId: id,

          message: {
            id: message?.id ?? generateUUID(),
            text: enhancedUserText,
            parts: message?.parts ?? [],
            attachments: message?.attachments ?? [],
          },

          mode,

          modelId: chatModel,

          visibility: selectedVisibilityType,
        });

        const coreHost = createAppCoreHost();

        const textId = generateUUID();

        dataStream.write({
          type: "text-start",
          id: textId,
        });

        try {
          await appCore.request(
            coreInput,
            coreHost,
            (event) => {
              console.log("[Core → App]", event);

              switch (event.type) {
                case "text_delta": {
                  dataStream.write({
                    type: "text-delta",
                    id: textId,
                    delta: event.text,
                  });

                  break;
                }

                case "reasoning_delta": {
                  console.log(
                    "[Core] reasoning delta",
                  );

                  break;
                }

                case "status": {
                  console.log(
                    `[Core] ${event.message}`,
                  );

                  break;
                }

                case "tool_started": {
                  console.log(
                    `[Core] Tool started: ${event.toolName}`,
                  );

                  break;
                }

                case "tool_result": {
                  console.log(
                    `[Core] Tool completed: ${event.toolCallId}`,
                  );

                  break;
                }

                case "environment_result": {
                  console.log(
                    "[Core] Environment result",
                  );

                  break;
                }

                case "artifact": {
                  console.log(
                    `[Core] Artifact: ${event.artifact.title}`,
                  );

                  break;
                }

                case "error": {
                  console.error(
                    `[Core] ${event.message}`,
                  );

                  break;
                }

                case "done": {
                  break;
                }
              }
            },
          );

          dataStream.write({
            type: "text-end",
            id: textId,
          });
        } catch (error) {
          dataStream.write({
            type: "text-end",
            id: textId,
          });

          throw error;
        }

        // ---------------------------------------------------------------
        // Titre du chat
        // ---------------------------------------------------------------

        if (titlePromise) {
          const title = await titlePromise;

          dataStream.write({
            type: "data-chat-title",
            data: title,
          });

          await updateChatTitleById({
            chatId: id,
            title,
          });
        }
      },

      generateId: generateUUID,

      // -------------------------------------------------------------------
      // Persistence des messages produits par le stream
      // -------------------------------------------------------------------

      onFinish: async ({
        messages: finishedMessages,
      }) => {
        if (isToolApprovalFlow) {
          for (const finishedMsg of finishedMessages) {
            const existingMsg = uiMessages.find(
              (m) => m.id === finishedMsg.id,
            );

            if (existingMsg) {
              await updateMessage({
                id: finishedMsg.id,
                parts: finishedMsg.parts,
              });
            } else {
              await saveMessages({
                messages: [
                  {
                    id: finishedMsg.id,
                    role: finishedMsg.role,
                    parts: finishedMsg.parts,
                    createdAt: new Date(),
                    attachments: [] as any[],
                    chatId: id,
                  },
                ],
              });
            }
          }
        } else if (finishedMessages.length > 0) {
          await saveMessages({
            messages: finishedMessages.map(
              (currentMessage) => ({
                id: currentMessage.id,
                role: currentMessage.role,
                parts: currentMessage.parts,
                createdAt: new Date(),
                attachments: [] as any[],
                chatId: id,
              }),
            ),
          });
        }
      },

      onError: (error) => {
        if (
          error instanceof Error &&
          error.message?.includes(
            "AI Gateway requires a valid credit card on file to service requests",
          )
        ) {
          return "AI Gateway requires a valid credit card on file to service requests. Please visit https://vercel.com/d?to=%2F%5Bteam%5D%2F%7E%2Fai%3Fmodal%3Dadd-credit-card to add a card and unlock your free credits.";
        }

        return "Oops, an error occurred!";
      },
    });

    return createUIMessageStreamResponse({
      stream,

      async consumeSseStream({ stream: sseStream }) {
        if (!process.env.REDIS_URL) {
          return;
        }

        try {
          const streamContext = getStreamContext();

          if (streamContext) {
            const streamId = generateId();

            await createStreamId({
              streamId,
              chatId: id,
            });

            await streamContext.createNewResumableStream(
              streamId,
              () => sseStream,
            );
          }
        } catch (_) {
          /* non-critical */
        }
      },
    });
  } catch (error) {
    const vercelId =
      request.headers.get("x-vercel-id");

    if (error instanceof ChatbotError) {
      return error.toResponse();
    }

    if (
      error instanceof Error &&
      error.message?.includes(
        "AI Gateway requires a valid credit card on file to service requests",
      )
    ) {
      return new ChatbotError(
        "bad_request:activate_gateway",
      ).toResponse();
    }

    console.error(
      "Unhandled error in chat API:",
      error,
      { vercelId },
    );

    return new ChatbotError(
      "offline:chat",
    ).toResponse();
  }
}

export async function DELETE(request: Request) {
  const { searchParams } =
    new URL(request.url);

  const id = searchParams.get("id");

  if (!id) {
    return new ChatbotError(
      "bad_request:api",
    ).toResponse();
  }

  const session = await auth();

  if (!session?.user) {
    return new ChatbotError(
      "unauthorized:chat",
    ).toResponse();
  }

  const chat = await getChatById({ id });

  if (chat?.userId !== session.user.id) {
    return new ChatbotError(
      "forbidden:chat",
    ).toResponse();
  }

  const deletedChat =
    await deleteChatById({ id });

  return Response.json(deletedChat, {
    status: 200,
  });
}
