// components/workspace/message.tsx
"use client";

import type { UseChatHelpers } from "@ai-sdk/react";
import Image from "next/image";
import React, { useEffect, useState } from "react";
import { useArtifact } from "@/hooks/use-artifact";
import type { Vote } from "@/lib/db/schema";
import type { ChatMessage } from "@/lib/types";
import { cn, sanitizeText } from "@/lib/utils";
import { MessageContent, MessageResponse } from "../ai-elements/message";
import { Tool, ToolContent, ToolHeader, ToolOutput } from "../ai-elements/tool";
import { useDataStream } from "./data-stream-provider";
import { DocumentToolResult } from "./document";
import { DocumentPreview } from "./document-preview";
import { MessageActions } from "./message-actions";
import { MessageReasoning } from "./message-reasoning";
import { PreviewAttachment } from "./preview-attachment";
import {
  CalculateTool,
  NewsSearchTool,
  WeatherTool,
  WebSearchTool,
} from "./tools";

const PurePreviewMessage = ({
  addToolApprovalResponse,
  chatId,
  message,
  vote,
  isLoading,
  setMessages: _setMessages,
  regenerate: _regenerate,
  isReadonly,
  requiresScrollPadding: _requiresScrollPadding,
  onEdit,
}: {
  addToolApprovalResponse: UseChatHelpers<ChatMessage>["addToolApprovalResponse"];
  chatId: string;
  message: ChatMessage;
  vote: Vote | undefined;
  isLoading: boolean;
  setMessages: UseChatHelpers<ChatMessage>["setMessages"];
  regenerate: UseChatHelpers<ChatMessage>["regenerate"];
  isReadonly: boolean;
  requiresScrollPadding: boolean;
  onEdit?: (message: ChatMessage) => void;
}) => {
  const attachmentsFromMessage = message.parts.filter(
    (part) => part.type === "file"
  );

  useDataStream();

  const artifactContext = useArtifact();
  const setArtifact = artifactContext ? artifactContext.setArtifact : null;

  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
  }, []);

  const isUser = message.role === "user";
  const isAssistant = message.role === "assistant";

  const hasAnyContent = message.parts?.some(
    (part) =>
      (part.type === "text" && part.text?.trim().length > 0) ||
      (part.type === "reasoning" &&
        "text" in part &&
        part.text?.trim().length > 0) ||
      (part.type as string).startsWith("tool-")
  );
  const isThinking = isAssistant && isLoading && !hasAnyContent;

  const attachments = attachmentsFromMessage.length > 0 && (
    <div
      className="flex flex-row justify-end gap-2"
      data-testid={"message-attachments"}
    >
      {attachmentsFromMessage.map((attachment) => (
        <PreviewAttachment
          attachment={{
            name: attachment.filename ?? "file",
            contentType: attachment.mediaType,
            url: attachment.url,
          }}
          key={attachment.url}
        />
      ))}
    </div>
  );

  const mergedReasoning = message.parts?.reduce(
    (acc, part) => {
      if (part.type === "reasoning" && part.text?.trim().length > 0) {
        return {
          text: acc.text ? `${acc.text}\n\n${part.text}` : part.text,
          isStreaming: "state" in part ? part.state === "streaming" : false,
          rendered: false,
        };
      }
      return acc;
    },
    { text: "", isStreaming: false, rendered: false }
  ) ?? { text: "", isStreaming: false, rendered: false };

  const parts = message.parts?.map((part, index) => {
    const { type } = part;
    const key = `message-${message.id}-part-${index}`;

    if (type === "reasoning") {
      if (!mergedReasoning.rendered && mergedReasoning.text) {
        mergedReasoning.rendered = true;
        return (
          <MessageReasoning
            isLoading={isLoading || mergedReasoning.isStreaming}
            key={key}
            reasoning={mergedReasoning.text}
          />
        );
      }
      return null;
    }

    if (type === "text") {
      const reasoningMatch = part.text?.match(
        /<reasoning>([\s\S]*?)<\/reasoning>/
      );
      const reasoningText = reasoningMatch ? reasoningMatch[1].trim() : "";
      const textWithoutReasoning = part.text
        ?.replace(/<reasoning>[\s\S]*?<\/reasoning>/, "")
        .trim();

      return (
        <React.Fragment key={key}>
          {reasoningText && (
            <MessageReasoning isLoading={false} reasoning={reasoningText} />
          )}
          {textWithoutReasoning && (
            <MessageContent
              className={cn("text-[13px] leading-[1.65]", {
                "w-fit max-w-[min(80%,56ch)] overflow-hidden break-words rounded-2xl rounded-br-lg border border-[#66b5ff]/20 bg-[#66b5ff]/10 px-3.5 py-2 shadow-none":
                  message.role === "user",
                "[&_img]:inline-block [&_img]:max-w-[180px] [&_img]:max-h-[140px] [&_img]:rounded-lg [&_img]:object-cover [&_img]:border [&_img]:border-border/30 [&_img]:shadow-none [&_img]:mr-2 [&_img]:mb-2 [&_img]:align-top":
                  message.role === "assistant",
              })}
              data-testid="message-content"
            >
              <MessageResponse>
                {sanitizeText(textWithoutReasoning)}
              </MessageResponse>
            </MessageContent>
          )}
        </React.Fragment>
      );
    }

    if (type === "tool-getWeather") {
      return (
        <WeatherTool
          addToolApprovalResponse={addToolApprovalResponse}
          key={key}
          part={part}
        />
      );
    }

    if (type === "tool-createDocument") {
      const { toolCallId } = part;

      if (part.output && "error" in part.output) {
        return (
          <div
            className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-500 dark:bg-red-950/50"
            key={toolCallId}
          >
            Error creating document: {String(part.output.error)}
          </div>
        );
      }

      return (
        <DocumentPreview
          isReadonly={isReadonly}
          key={toolCallId}
          result={part.output}
        />
      );
    }

    if (type === "tool-updateDocument") {
      const { toolCallId } = part;

      if (part.output && "error" in part.output) {
        return (
          <div
            className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-500 dark:bg-red-950/50"
            key={toolCallId}
          >
            Error updating document: {String(part.output.error)}
          </div>
        );
      }

      return (
        <div className="relative" key={toolCallId}>
          <DocumentPreview
            args={{ ...part.output, isUpdate: true }}
            isReadonly={isReadonly}
            result={part.output}
          />
        </div>
      );
    }

    if (type === "tool-requestSuggestions") {
      const { toolCallId, state } = part;

      return (
        <Tool
          className="w-[min(100%,450px)]"
          defaultOpen={true}
          key={toolCallId}
        >
          <ToolHeader state={state} type="tool-requestSuggestions" />
          <ToolContent>
            {state === "input-available" && part.input && (
              <div className="space-y-2 overflow-hidden">
                <h4 className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
                  Parameters
                </h4>
                <div className="rounded-md bg-muted/50">
                  <pre className="p-3 text-xs">
                    {JSON.stringify(part.input, null, 2)}
                  </pre>
                </div>
              </div>
            )}
            {state === "output-available" && (
              <ToolOutput
                errorText={undefined}
                output={
                  "error" in part.output ? (
                    <div className="rounded border p-2 text-red-500">
                      Error: {String(part.output.error)}
                    </div>
                  ) : (
                    <DocumentToolResult
                      isReadonly={isReadonly}
                      result={part.output}
                      type="request-suggestions"
                    />
                  )
                }
              />
            )}
          </ToolContent>
        </Tool>
      );
    }

    if (type === "tool-webSearch") {
      return <WebSearchTool key={key} part={part} />;
    }

    if (type === "tool-newsSearch") {
      return <NewsSearchTool key={key} part={part} />;
    }

    if ((type as string) === "tool-calculate") {
      return <CalculateTool key={key} part={part as any} />;
    }

    return null;
  });

  const searchToolPart = message.parts?.find(
    (part) =>
      part.type === "tool-webSearch" && part.state === "output-available"
  );
  const searchOutput = searchToolPart?.output as
    | Record<string, unknown>
    | undefined;
  const sources =
    (searchOutput?.results as Array<{
      title?: string;
      snippet?: string;
      url?: string;
    }>) || [];

  const sourcesBubble = isMounted &&
    setArtifact &&
    !isLoading &&
    sources.length > 0 && (
      <div className="mt-2 flex animate-[fade-up_0.2s_ease-out] flex-col gap-1.5">
        <button
          className="flex w-fit items-center gap-2 rounded-xl border border-border/50 bg-muted/20 px-3 py-1.5 text-xs font-medium text-muted-foreground shadow-sm transition-all duration-150 hover:bg-muted/50 hover:text-foreground"
          onClick={(e) => {
            if (setArtifact) {
              const rect = e.currentTarget.getBoundingClientRect();
              setArtifact({
                boundingBox: {
                  top: rect.top,
                  left: rect.left,
                  width: rect.width,
                  height: rect.height,
                },
                content: JSON.stringify(sources),
                documentId: `search-${message.id}`,
                isVisible: true,
                kind: "search",
                status: "idle",
                title: "Sources explorées",
              });
            }
          }}
          type="button"
        >
          <span className="mr-1 font-semibold text-primary/80">
            Sources consultées :
          </span>
          <div className="flex items-center -space-x-1 overflow-hidden">
            {sources.slice(0, 4).map((source) => {
              let hostname = "";
              try {
                hostname = source.url ? new URL(source.url).hostname : "";
              } catch {
                // ignore
              }

              return (
                <div
                  className="size-4 overflow-hidden rounded-full border border-background bg-muted"
                  key={source.url || hostname || Math.random().toString(36)}
                >
                  <Image
                    alt=""
                    className="size-full object-contain p-0.5"
                    height={16}
                    src={`https://www.google.com/s2/favicons?sz=32&domain=${hostname || "web"}`}
                    unoptimized
                    width={16}
                  />
                </div>
              );
            })}
          </div>
          {sources.length > 4 && (
            <span className="rounded bg-muted px-1 text-[10px] font-bold text-muted-foreground">
              +{sources.length - 4}
            </span>
          )}
        </button>
      </div>
    );

  const newsToolPart = message.parts?.find(
    (part) =>
      part.type === "tool-newsSearch" && part.state === "output-available"
  );
  const newsOutput = newsToolPart?.output as
    | Record<string, unknown>
    | undefined;
  const newsSources =
    (newsOutput?.results as Array<{
      title?: string;
      snippet?: string;
      url?: string;
    }>) || [];

  const newsSourcesBubble = isMounted &&
    setArtifact &&
    !isLoading &&
    newsSources.length > 0 && (
      <div className="mt-2 flex animate-[fade-up_0.2s_ease-out] flex-col gap-1.5">
        <button
          className="flex w-fit items-center gap-2 rounded-xl border border-border/50 bg-muted/20 px-3 py-1.5 text-xs font-medium text-muted-foreground shadow-sm transition-all duration-150 hover:bg-muted/50 hover:text-foreground"
          onClick={(e) => {
            if (setArtifact) {
              const rect = e.currentTarget.getBoundingClientRect();
              setArtifact({
                boundingBox: {
                  top: rect.top,
                  left: rect.left,
                  width: rect.width,
                  height: rect.height,
                },
                content: JSON.stringify(newsSources),
                documentId: `news-${message.id}`,
                isVisible: true,
                kind: "search",
                status: "idle",
                title: "Sources d'actualités",
              });
            }
          }}
          type="button"
        >
          <span className="mr-1 font-semibold text-primary/80">
            Sources d'actualités :
          </span>
          <div className="flex items-center -space-x-1 overflow-hidden">
            {newsSources.slice(0, 4).map((source) => {
              let hostname = "";
              try {
                hostname = source.url ? new URL(source.url).hostname : "";
              } catch {
                // ignore
              }

              return (
                <div
                  className="size-4 overflow-hidden rounded-full border border-background bg-muted"
                  key={source.url || hostname || Math.random().toString(36)}
                >
                  <Image
                    alt=""
                    className="size-full object-contain p-0.5"
                    height={16}
                    src={`https://www.google.com/s2/favicons?sz=32&domain=${hostname || "web"}`}
                    unoptimized
                    width={16}
                  />
                </div>
              );
            })}
          </div>
          {newsSources.length > 4 && (
            <span className="rounded bg-muted px-1 text-[10px] font-bold text-muted-foreground">
              +{newsSources.length - 4}
            </span>
          )}
        </button>
      </div>
    );

  const actions = !isReadonly && (
    <MessageActions
      chatId={chatId}
      isLoading={isLoading}
      key={`action-${message.id}`}
      message={message}
      onEdit={onEdit ? () => onEdit(message) : undefined}
      vote={vote}
    />
  );

  const content = isThinking ? (
    <div className="flex items-center gap-1.5 h-[calc(13px*1.65)] text-[13px] leading-[1.65]">
      <span className="inline-flex items-center gap-0.5">
        <span className="inline-block size-1.5 rounded-full bg-primary animate-bounce [animation-delay:0s] [animation-duration:0.4s]" />
        <span className="inline-block size-1.5 rounded-full bg-primary animate-bounce [animation-delay:0.1s] [animation-duration:0.4s]" />
        <span className="inline-block size-1.5 rounded-full bg-primary animate-bounce [animation-delay:0.2s] [animation-duration:0.4s]" />
      </span>
    </div>
  ) : (
    <>
      {attachments}
      {parts}
      {sourcesBubble}
      {newsSourcesBubble}
      {actions}
    </>
  );

  return (
    <div
      className={cn(
        "group/message w-full",
        !isAssistant && "animate-[fade-up_0.25s_cubic-bezier(0.22,1,0.36,1)]"
      )}
      data-role={message.role}
      data-testid={`message-${message.role}`}
    >
      <div
        className={cn(
          isUser ? "flex flex-col items-end gap-2" : "flex items-start gap-3"
        )}
      >
        {isAssistant ? (
          <div className="flex min-w-0 flex-1 flex-col gap-2">{content}</div>
        ) : (
          content
        )}
      </div>
    </div>
  );
};

export const PreviewMessage = PurePreviewMessage;

export const ThinkingMessage = () => {
  return (
    <div
      className="group/message w-full"
      data-role="assistant"
      data-testid="message-assistant-loading"
    >
      <div className="flex items-start gap-3">
        <div className="flex items-center gap-1.5 h-[calc(13px*1.65)] text-[13px] leading-[1.65]">
          <span className="inline-flex items-center gap-0.5">
            <span className="inline-block size-1.5 rounded-full bg-primary animate-bounce [animation-delay:0s] [animation-duration:0.4s]" />
            <span className="inline-block size-1.5 rounded-full bg-primary animate-bounce [animation-delay:0.1s] [animation-duration:0.4s]" />
            <span className="inline-block size-1.5 rounded-full bg-primary animate-bounce [animation-delay:0.2s] [animation-duration:0.4s]" />
          </span>
        </div>
      </div>
    </div>
  );
};
