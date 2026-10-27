/**
 * CoreInput
 *
 * Représente une mission envoyée au Core.
 * Ne contient QUE le contexte immédiat.
 * Le Core va chercher lui-même ce dont il a besoin via CoreHost.
 */

export type CoreMode =
  | "research"
  | "reasoning"
  | "course"
  | "search"
  | null;

export type CoreMessagePart = {
  type: string;
  text?: string;
  url?: string;
  name?: string;
  mediaType?: string;
};

export type CoreAttachment = {
  url: string;
  name: string;
  contentType: string;
};

export type CoreMessage = {
  id: string;
  role: "user";
  text: string;
  parts: readonly CoreMessagePart[];
  attachments: readonly CoreAttachment[];
};

export type CoreCapabilities = {
  tools: boolean;
  vision: boolean;
  reasoning: boolean;
};

export type CoreInput = {
  readonly userId: string;
  readonly sessionId: string;
  readonly currentChatId: string;

  readonly message: CoreMessage;

  readonly mode?: CoreMode;
  readonly modelId?: string;
  readonly visibility?: "public" | "private";

  readonly capabilities?: CoreCapabilities;
};