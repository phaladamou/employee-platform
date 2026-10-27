// components/workspace/workspace-shell.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
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
import { CapabilitiesCarousel } from "./capabilities-carousel";
import { EmptyState } from "./empty-state";
import { ChatHeader } from "./workspace-header";
import { DataStreamHandler } from "./data-stream-handler";
import { submitEditedMessage } from "./message-editor";
import { Messages } from "./messages";
import { MultimodalInput } from "./multimodal-input";
import { SearchArtifactPanel } from "./search-artifact-panel";

export function ChatShellChat() {
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

  const [editingMessage, setEditingMessage] = useState<ChatMessage | null>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [carouselDismissed, setCarouselDismissed] = useState(false);
  const isArtifactVisible = useArtifactSelector((state) => state.isVisible);
  const { artifact, setArtifact } = useArtifact();
  const router = useRouter();

  const stopRef = useRef(stop);
  stopRef.current = stop;

  const searchParams = useSearchParams();
  const documentParam = searchParams.get("document");
  const hasLoadedDocument = useRef(false);
  const [showArtifact, setShowArtifact] = useState(false);
  const [artifactDocId, setArtifactDocId] = useState("");

  const prevChatIdRef = useRef(chatId);
  useEffect(() => {
    if (prevChatIdRef.current !== chatId) {
      prevChatIdRef.current = chatId;
      stopRef.current();
      hasLoadedDocument.current = false;
      setShowArtifact(false);
      setArtifactDocId("");
      setArtifact(initialArtifactData);
      setEditingMessage(null);
      setAttachments([]);
      setActiveCategory(null);
      setCarouselDismissed(false);
    }
  }, [chatId, setArtifact]);

  const isNewEmptyChat =
    !chatId || (chatId && messages.length === 0 && !isLoading);

  useEffect(() => {
    if (documentParam && !hasLoadedDocument.current) {
      hasLoadedDocument.current = true;
      fetch(`/api/document?id=${documentParam}`)
        .then((res) => res.json())
        .then((data) => {
          const doc = Array.isArray(data) ? data[0] : data;
          if (doc) {
            setArtifact({
              documentId: doc.id,
              content: doc.content ?? "",
              kind: doc.kind ?? "text",
              title: doc.title ?? "",
              status: "idle",
              isVisible: true,
              boundingBox: initialArtifactData.boundingBox,
            });
            setArtifactDocId(doc.id);
            setShowArtifact(true);
          }
        })
        .catch(console.error);
    }
  }, [documentParam, setArtifact]);

  if (isLoading && messages.length === 0) {
    return (
      <div className="flex h-dvh w-full items-center justify-center bg-white dark:bg-background">
        <svg
          className="size-10"
          fill="none"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <circle
            className="text-muted/30"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <path
            className="text-primary"
            d="M12 2a10 10 0 0 1 10 10"
            stroke="currentColor"
            strokeLinecap="round"
            strokeWidth="1.5"
          >
            <animateTransform
              attributeName="transform"
              dur="0.8s"
              from="0 12 12"
              repeatCount="indefinite"
              to="360 12 12"
              type="rotate"
            />
          </path>
        </svg>
      </div>
    );
  }

  return (
    <>
      <div className="flex h-dvh w-full flex-row overflow-hidden">
        <div className="flex min-w-0 flex-1 flex-col bg-white dark:bg-background !border-0">
          <ChatHeader
            chatId={chatId}
            isReadonly={isReadonly}
            selectedVisibilityType={visibilityType}
          />
          {isNewEmptyChat ? (
            <div className="relative flex min-h-0 flex-1 flex-col items-center justify-center overflow-hidden bg-white dark:bg-background">
              <EmptyState
                activeCategory={activeCategory}
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
                onModelChange={setCurrentModelId}
                selectedModelId={currentModelId}
                selectedVisibilityType={visibilityType}
                sendMessage={sendMessage}
                setActiveCategory={setActiveCategory}
                setAttachments={setAttachments}
                setInput={setInput}
                setMessages={setMessages}
                status={status}
                stop={stop}
              />
            </div>
          ) : (
            <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-white dark:bg-background">
              <Messages
                activeCategory={activeCategory}
                addToolApprovalResponse={addToolApprovalResponse}
                chatId={chatId}
                isArtifactVisible={isArtifactVisible}
                isLoading={isLoading}
                isReadonly={isReadonly}
                isWebsites={false}
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
              <div className="sticky bottom-0 z-1 mx-auto flex w-full max-w-3xl flex-col gap-2 border-t-0 bg-white dark:bg-background px-2 pb-3 md:px-4 md:pb-4 mt-auto">
                {!isReadonly && (
                  <MultimodalInput
                    activeCategory={activeCategory}
                    attachments={attachments}
                    chatId={chatId}
                    editingMessage={editingMessage}
                    input={input}
                    isLoading={isLoading}
                    isWebsites={false}
                    messages={messages}
                    onCancelEdit={() => {
                      setEditingMessage(null);
                      setInput("");
                    }}
                    onModelChange={setCurrentModelId}
                    selectedModelId={currentModelId}
                    selectedVisibilityType={visibilityType}
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
                    setActiveCategory={setActiveCategory}
                    setAttachments={setAttachments}
                    setInput={setInput}
                    setMessages={setMessages}
                    status={status}
                    stop={stop}
                  />
                )}
              </div>
            </div>
          )}
        </div>
        {artifact.kind === "search" ? (
          <SearchArtifactPanel />
        ) : showArtifact ? (
          <Artifact
            key={artifactDocId}
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
        ) : null}
      </div>
      <DataStreamHandler />
      {!carouselDismissed && messages.length === 0 && !isLoading && (
        <div className="fixed bottom-4 left-0 right-0 z-10">
          <CapabilitiesCarousel onDismiss={() => setCarouselDismissed(true)} />
        </div>
      )}
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
