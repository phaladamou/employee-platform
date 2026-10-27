// components/workspace/messages.tsx
import type { UseChatHelpers } from "@ai-sdk/react";
import { ArrowDownIcon } from "lucide-react";
import { useEffect, useRef } from "react";
import { useMessages } from "@/hooks/use-messages";
import type { Vote } from "@/lib/db/schema";
import type { ChatMessage } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useDataStream } from "./data-stream-provider";
import { PreviewMessage, ThinkingMessage } from "./message";
import { ScientificExecutionTrace } from "./scientific-execution-trace";

type MessagesProps = {
  addToolApprovalResponse: UseChatHelpers<ChatMessage>["addToolApprovalResponse"];
  activeCategory?: string | null;
  chatId: string;
  status: UseChatHelpers<ChatMessage>["status"];
  votes: Vote[] | undefined;
  messages: ChatMessage[];
  setMessages: UseChatHelpers<ChatMessage>["setMessages"];
  regenerate: UseChatHelpers<ChatMessage>["regenerate"];
  isReadonly: boolean;
  isArtifactVisible: boolean;
  isLoading?: boolean;
  selectedModelId: string;
  onEditMessage?: (message: ChatMessage) => void;
  isWebsites?: boolean;
  sendMessage: UseChatHelpers<ChatMessage>["sendMessage"];
  setActiveCategory?: (category: string | null) => void;
};

function PureMessages({
  addToolApprovalResponse,
  activeCategory: _activeCategory,
  chatId,
  status,
  votes,
  messages,
  setMessages,
  regenerate,
  isReadonly,
  isArtifactVisible,
  isLoading,
  selectedModelId: _selectedModelId,
  onEditMessage,
  isWebsites: _isWebsites,
  sendMessage: _sendMessage,
  setActiveCategory: _setActiveCategory,
}: MessagesProps) {
  const {
    containerRef,
    endRef,
    isAtBottom,
    scrollToBottom,
    hasSentMessage,
    reset,
  } = useMessages({ status });
  const { scientificTrace } = useDataStream();

  const prevChatIdRef = useRef(chatId);
  useEffect(() => {
    if (prevChatIdRef.current !== chatId) {
      prevChatIdRef.current = chatId;
      reset();
    }
  }, [chatId, reset]);

  const hasMessages = messages.length > 0;

  return (
    <div className="relative flex-1 bg-white dark:bg-background">
      <div
        className="touch-pan-y overflow-y-auto no-scrollbar absolute inset-0 bg-white dark:bg-background"
        ref={containerRef}
        style={isArtifactVisible ? { scrollbarWidth: "none" } : undefined}
      >
        <div className="mx-auto flex min-w-0 max-w-3xl flex-col gap-5 px-2 md:gap-7 md:px-4 min-h-full py-6">
          {messages.map((message, index) => (
            <PreviewMessage
              addToolApprovalResponse={addToolApprovalResponse}
              chatId={chatId}
              isLoading={
                status === "streaming" && messages.length - 1 === index
              }
              isReadonly={isReadonly}
              key={message.id}
              message={message}
              onEdit={onEditMessage}
              regenerate={regenerate}
              requiresScrollPadding={
                hasSentMessage && index === messages.length - 1
              }
              setMessages={setMessages}
              vote={
                votes
                  ? votes.find((v) => v.messageId === message.id)
                  : undefined
              }
            />
          ))}
          {scientificTrace && (
            <div className="-mt-3">
              <ScientificExecutionTrace
                confidence={scientificTrace.confidence}
                duration={scientificTrace.duration}
                engineName={scientificTrace.engineName}
                expression={scientificTrace.expression}
                result={scientificTrace.result}
                steps={scientificTrace.steps}
              />
            </div>
          )}
          {status === "submitted" && messages.at(-1)?.role !== "assistant" && (
            <ThinkingMessage />
          )}
          <div className="min-h-[24px] min-w-[24px] shrink-0" ref={endRef} />
        </div>
      </div>
      {hasMessages && (
        <button
          aria-label="Scroll to bottom"
          className={`absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 items-center rounded-full border border-border/50 bg-card/90 px-3.5 shadow-[var(--shadow-float)] backdrop-blur-lg transition-all duration-200 h-7 text-[10px] ${isAtBottom ? "pointer-events-none scale-90 opacity-0" : "pointer-events-auto scale-100 opacity-100"}`}
          onClick={() => scrollToBottom("smooth")}
          type="button"
        >
          <ArrowDownIcon className="size-3 text-muted-foreground" />
        </button>
      )}
    </div>
  );
}

export const Messages = PureMessages;