// components/chat/website-shell.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useActiveChat } from "@/hooks/use-active-chat";
import {
  initialArtifactData,
  useArtifact,
  useArtifactSelector,
} from "@/hooks/use-artifact";
import type { Attachment, ChatMessage } from "@/lib/types";
import { Artifact } from "./artifact";
import { ChatHeader } from "./workspace-header";
import { DataStreamHandler } from "./data-stream-handler";
import { InspirationGallery } from "./inspiration-gallery";
import { submitEditedMessage } from "./message-editor";
import { Messages } from "./messages";
import { WebsiteMultimodalInput } from "./multimodal-input-websites";
import { SearchArtifactPanel } from "./search-artifact-panel";
import { SuggestedActionsWebsites } from "./suggested-actions-websites";

export function ChatShellWebsites() {
  const {
    chatId,
    messages,
    setMessages,
    sendMessage,
    status,
    stop,
    regenerate,
    addToolApprovalResponse,
    input,
    setInput,
    visibilityType,
    isReadonly,
    isLoading,
    votes,
    currentModelId,
    setCurrentModelId,
    showCreditCardAlert,
    setShowCreditCardAlert,
  } = useActiveChat();

  const [editingMessage, setEditingMessage] = useState<ChatMessage | null>(
    null
  );
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<{
    src: string;
    label: string;
  } | null>(null);

  useEffect(() => {
    console.log("selectedTemplate changed:", selectedTemplate);
  }, [selectedTemplate]);

  const isArtifactVisible = useArtifactSelector((state) => state.isVisible);
  const { artifact, setArtifact } = useArtifact();

  const stopRef = useRef(stop);
  stopRef.current = stop;

  const prevChatIdRef = useRef(chatId);
  useEffect(() => {
    if (prevChatIdRef.current !== chatId) {
      prevChatIdRef.current = chatId;
      stopRef.current();
      setArtifact(initialArtifactData);
      setEditingMessage(null);
      setAttachments([]);
      setActiveCategory(null);
      setSelectedTemplate(null);
    }
  }, [chatId, setArtifact]);

  const isNewEmptyChat =
    !chatId || (chatId && messages.length === 0 && !isLoading);

  return (
    <>
      <div className="flex h-dvh w-full flex-row overflow-hidden">
        <div className="flex min-w-0 flex-1 flex-col bg-white dark:bg-background !border-0">
          <ChatHeader
            chatId={chatId}
            isReadonly={isReadonly}
            selectedVisibilityType={visibilityType}
          />
          <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-white dark:bg-background">
            <Messages
              activeCategory={activeCategory}
              addToolApprovalResponse={addToolApprovalResponse}
              chatId={chatId}
              isArtifactVisible={isArtifactVisible}
              isLoading={isLoading}
              isReadonly={isReadonly}
              isWebsites={true}
              messages={messages}
              onEditMessage={(msg) => {
                const text = msg.parts
                  ?.filter((p) => p.type === "text")
                  .map((p) => p.text)
                  .join("");
                setInput(text ?? "");
                setEditingMessage(msg);
              }}
              regenerate={regenerate}
              selectedModelId={currentModelId}
              sendMessage={sendMessage}
              setActiveCategory={setActiveCategory}
              setMessages={setMessages}
              status={status}
              votes={votes}
            />
            <div
              className={`sticky bottom-0 z-1 mx-auto flex w-full max-w-3xl flex-col gap-2 border-t-0 bg-white dark:bg-background px-2 pb-3 md:px-4 md:pb-4 ${isNewEmptyChat ? "" : "mt-auto"}`}
            >
              {!isReadonly && (
                <WebsiteMultimodalInput
                  attachments={attachments}
                  chatId={chatId}
                  editingMessage={editingMessage}
                  input={input}
                  isLoading={isLoading}
                  messages={messages}
                  onCancelEdit={() => {
                    setEditingMessage(null);
                    setInput("");
                  }}
                  onClearTemplate={() => setSelectedTemplate(null)}
                  selectedTemplate={selectedTemplate}
                  sendMessage={
                    editingMessage
                      ? async () => {
                          const msg = editingMessage;
                          setEditingMessage(null);
                          await submitEditedMessage({
                            message: msg,
                            text: input,
                            setMessages,
                            regenerate,
                          });
                          setInput("");
                        }
                      : sendMessage
                  }
                  setAttachments={setAttachments}
                  setInput={setInput}
                  setMessages={setMessages}
                  status={status}
                  stop={stop}
                />
              )}
              {!editingMessage &&
                !isLoading &&
                messages.length === 0 &&
                attachments.length === 0 && (
                  <SuggestedActionsWebsites sendMessage={sendMessage} />
                )}
              {messages.length === 0 && !isLoading && (
                <InspirationGallery
                  onSelect={setSelectedTemplate}
                  selectedTemplate={selectedTemplate}
                />
              )}
            </div>
          </div>
        </div>
        {artifact.kind === "search" ? (
          <SearchArtifactPanel />
        ) : (
          <Artifact
            addToolApprovalResponse={addToolApprovalResponse}
            attachments={attachments}
            chatId={chatId}
            input={input}
            isReadonly={isReadonly}
            messages={messages}
            regenerate={regenerate}
            selectedModelId={currentModelId}
            selectedVisibilityType={visibilityType}
            sendMessage={sendMessage}
            setAttachments={setAttachments}
            setInput={setInput}
            setMessages={setMessages}
            status={status}
            stop={stop}
            votes={votes}
          />
        )}
      </div>
      <DataStreamHandler />
      <AlertDialog
        onOpenChange={setShowCreditCardAlert}
        open={showCreditCardAlert}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Activate AI Gateway</AlertDialogTitle>
            <AlertDialogDescription>
              This application requires{" "}
              {process.env.NODE_ENV === "production" ? "the owner" : "you"} to
              activate Vercel AI Gateway.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                window.open(
                  "https://vercel.com/d?to=%2F%5Bteam%5D%2F%7E%2Fai%3Fmodal%3Dadd-credit-card",
                  "_blank"
                );
                window.location.href = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/`;
              }}
            >
              Activate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
