// components/workspace/empty-state.tsx
"use client";

import type { UseChatHelpers } from "@ai-sdk/react";
import type { Dispatch, SetStateAction } from "react";
import type { Attachment, ChatMessage } from "@/lib/types";
import { Greeting } from "./greeting";
import { MultimodalInput } from "./multimodal-input";
import { SuggestedActions } from "./suggested-actions";
import type { VisibilityType } from "./visibility-selector";

export function EmptyState({
  chatId,
  input,
  setInput,
  status,
  stop,
  attachments,
  setAttachments,
  messages,
  setMessages,
  sendMessage,
  selectedVisibilityType,
  selectedModelId,
  onModelChange,
  isLoading,
  activeCategory,
  setActiveCategory,
  editingMessage,
  onCancelEdit,
}: {
  chatId: string;
  input: string;
  setInput: Dispatch<SetStateAction<string>>;
  status: UseChatHelpers<ChatMessage>["status"];
  stop: () => void;
  attachments: Attachment[];
  setAttachments: Dispatch<SetStateAction<Attachment[]>>;
  messages: ChatMessage[];
  setMessages: UseChatHelpers<ChatMessage>["setMessages"];
  sendMessage:
    | UseChatHelpers<ChatMessage>["sendMessage"]
    | (() => Promise<void>);
  selectedVisibilityType: VisibilityType;
  selectedModelId: string;
  onModelChange?: (modelId: string) => void;
  isLoading?: boolean;
  activeCategory?: string | null;
  setActiveCategory?: (category: string | null) => void;
  editingMessage?: ChatMessage | null;
  onCancelEdit?: () => void;
}) {
    return (
    <div className="flex w-full max-w-3xl flex-col items-center justify-center gap-10 px-4 pb-28">
      <Greeting />

      <div className="w-full">
        <MultimodalInput
          activeCategory={activeCategory}
          attachments={attachments}
          chatId={chatId}
          editingMessage={editingMessage}
          input={input}
          isLoading={isLoading}
          isWebsites={false}
          messages={messages}
          onCancelEdit={onCancelEdit}
          onModelChange={onModelChange}
          selectedModelId={selectedModelId}
          selectedVisibilityType={selectedVisibilityType}
          sendMessage={sendMessage}
          setActiveCategory={setActiveCategory}
          setAttachments={setAttachments}
          setInput={setInput}
          setMessages={setMessages}
          status={status}
          stop={stop}
        />
      </div>

      <SuggestedActions
        chatId={chatId}
        sendMessage={sendMessage}
        selectedVisibilityType={selectedVisibilityType}
        setActiveCategory={setActiveCategory}
      />
    </div>
  );
}