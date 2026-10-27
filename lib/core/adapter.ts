
import type {
  CoreAttachment,
  CoreInput,
  CoreMessagePart,
} from "@/core/contracts/input";
import type {
  CoreHost,
  HostConversation,
  HostDocument,
  HostDocumentInput,
  HostDocumentResult,
  HostMemory,
  HostMessage,
  HostNewsResult,
  HostSearchResult,
  HostWeather,
} from "@/core/contracts/host";

import { createCore } from "@/core/runtime/bootstrap";
import { getMessagesByChatId } from "@/lib/db/queries";

const coreSystem = createCore();

export const appCore = coreSystem.core;

function notImplemented(name: string): never {
  throw new Error(`CoreHost.${name} is not implemented yet.`);
}

function normalizeParts(
  parts: readonly unknown[] | undefined,
): CoreMessagePart[] {
  if (!Array.isArray(parts)) {
    return [];
  }

  return parts.map((part): CoreMessagePart => {
    if (
      typeof part !== "object" ||
      part === null ||
      !("type" in part)
    ) {
      return {
        type: "unknown",
      };
    }

    const value = part as Record<string, unknown>;

    if (typeof value.type !== "string") {
      return {
        type: "unknown",
      };
    }

    return {
      type: value.type,
      ...(typeof value.text === "string"
        ? { text: value.text }
        : {}),
      ...(typeof value.url === "string"
        ? { url: value.url }
        : {}),
      ...(typeof value.name === "string"
        ? { name: value.name }
        : {}),
      ...(typeof value.mediaType === "string"
        ? { mediaType: value.mediaType }
        : {}),
    };
  });
}

function normalizeAttachments(
  attachments: readonly unknown[] | undefined,
): CoreAttachment[] {
  if (!Array.isArray(attachments)) {
    return [];
  }

  return attachments.flatMap((attachment): CoreAttachment[] => {
    if (
      typeof attachment !== "object" ||
      attachment === null
    ) {
      return [];
    }

    const value = attachment as Record<string, unknown>;

    if (
      typeof value.url !== "string" ||
      typeof value.name !== "string" ||
      typeof value.contentType !== "string"
    ) {
      return [];
    }

    return [
      {
        url: value.url,
        name: value.name,
        contentType: value.contentType,
      },
    ];
  });
}

export function createAppCoreHost(): CoreHost {
  return {
    async getConversation(chatId: string): Promise<HostMessage[]> {
      const messages = await getMessagesByChatId({ id: chatId });

      return messages.map((message): HostMessage => ({
        id: message.id,
        role: message.role as HostMessage["role"],
        parts: normalizeParts(
          Array.isArray(message.parts)
            ? message.parts
            : [],
        ),
        createdAt: new Date(message.createdAt),
      }));
    },

    async getUserConversations(
      _userId: string,
    ): Promise<HostConversation[]> {
      return notImplemented("getUserConversations");
    },

    async searchConversations(
      _query: string,
      _userId: string,
    ): Promise<HostConversation[]> {
      return notImplemented("searchConversations");
    },

    async getDocument(
      _id: string,
    ): Promise<HostDocument | null> {
      return notImplemented("getDocument");
    },

    async createDocument(
      _input: HostDocumentInput,
    ): Promise<HostDocumentResult> {
      return notImplemented("createDocument");
    },

    async updateDocument(
      _id: string,
      _content: string,
    ): Promise<HostDocumentResult> {
      return notImplemented("updateDocument");
    },

    async editDocument(
      _id: string,
      _changes: string,
    ): Promise<HostDocumentResult> {
      return notImplemented("editDocument");
    },

    async searchWeb(
      _query: string,
    ): Promise<HostSearchResult[]> {
      return notImplemented("searchWeb");
    },

    async getWeather(
      _location: string,
    ): Promise<HostWeather> {
      return notImplemented("getWeather");
    },

    async newsSearch(
      _query: string,
    ): Promise<HostNewsResult[]> {
      return notImplemented("newsSearch");
    },

    async saveMemory(
      _memory: Omit<HostMemory, "id" | "createdAt">,
    ): Promise<void> {
      return notImplemented("saveMemory");
    },

    async getMemories(
      _userId: string,
      _query?: string,
    ): Promise<HostMemory[]> {
      return notImplemented("getMemories");
    },

    async searchMemory(
      _userId: string,
      _query: string,
    ): Promise<HostMemory[]> {
      return notImplemented("searchMemory");
    },
  };
}

export function buildCoreInput({
  userId,
  chatId,
  message,
  mode,
  modelId,
  visibility,
}: {
  userId: string;
  chatId: string;

  message: {
    id: string;
    text: string;
    parts: readonly unknown[];
    attachments?: readonly unknown[];
  };

  mode?: CoreInput["mode"];
  modelId?: string;
  visibility?: CoreInput["visibility"];
}): CoreInput {
  return {
    userId,
    sessionId: chatId,
    currentChatId: chatId,

    message: {
      id: message.id,
      role: "user",
      text: message.text,
      parts: normalizeParts(message.parts),
      attachments: normalizeAttachments(message.attachments),
    },

    mode,
    modelId,
    visibility,

    capabilities: {
      tools: false,
      vision: false,
      reasoning: mode === "reasoning",
    },
  };
}
