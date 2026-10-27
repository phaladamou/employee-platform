// components/workspace/multimodal-input-websites.tsx
"use client";

import type { UseChatHelpers } from "@ai-sdk/react";
import type { UIMessage } from "ai";
import { ArrowUpIcon, BotIcon, ChevronDownIcon, XIcon } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import {
  type ChangeEvent,
  type Dispatch,
  memo,
  type SetStateAction,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import { useLocalStorage, useWindowSize } from "usehooks-ts";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useActiveChat } from "@/hooks/use-active-chat";
import { getTemplateSystemPrompt } from "@/lib/template-system-prompts";
import type { Attachment, ChatMessage } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  PromptInput,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
} from "../ai-elements/prompt-input";
import { Button } from "../ui/button";
import { StopIcon } from "./icons";
import { type ModeType, PlusMenu } from "./plus-menu";
import { PreviewAttachment } from "./preview-attachment";

const scientiaModels = [
  { id: "fast", label: "Fast" },
  { id: "smart", label: "Smart" },
  { id: "creative", label: "Creative" },
] as const;

function PureWebsiteMultimodalInput({
  chatId,
  input,
  setInput,
  status,
  stop,
  attachments,
  setAttachments,
  messages: _messages,
  setMessages: _setMessages,
  sendMessage,
  editingMessage: _editingMessage,
  onCancelEdit: _onCancelEdit,
  isLoading: _isLoading,
  selectedTemplate,
  onClearTemplate,
}: {
  chatId: string;
  input: string;
  setInput: Dispatch<SetStateAction<string>>;
  status: UseChatHelpers<ChatMessage>["status"];
  stop: () => void;
  attachments: Attachment[];
  setAttachments: Dispatch<SetStateAction<Attachment[]>>;
  messages: UIMessage[];
  setMessages: UseChatHelpers<ChatMessage>["setMessages"];
  sendMessage: UseChatHelpers<ChatMessage>["sendMessage"];
  editingMessage?: ChatMessage | null;
  onCancelEdit?: () => void;
  isLoading?: boolean;
  selectedTemplate?: { src: string; label: string } | null;
  onClearTemplate?: () => void;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { width } = useWindowSize();
  const hasAutoFocused = useRef(false);
  const [mode, setMode] = useState<ModeType | null>(null);
  const [scientiaModel, setScientiaModel] = useState("fast");
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const { modeRef } = useActiveChat();
  const tw = useTranslations("websites");

  useEffect(() => {
    modeRef.current = mode;
  }, [mode, modeRef]);

  useEffect(() => {
    if (!hasAutoFocused.current && width) {
      const timer = setTimeout(() => {
        textareaRef.current?.focus();
        hasAutoFocused.current = true;
      }, 100);
      return () => {
        clearTimeout(timer);
      };
    }
  }, [width]);

  const [localStorageInput, setLocalStorageInput] = useLocalStorage(
    "input",
    ""
  );
  useEffect(() => {
    if (textareaRef.current) {
      const finalValue = textareaRef.current.value || localStorageInput || "";
      setInput(finalValue);
    }
  }, [localStorageInput, setInput]);
  useEffect(() => {
    setLocalStorageInput(input);
  }, [input, setLocalStorageInput]);

  const handleInput = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(event.target.value);
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadQueue, setUploadQueue] = useState<string[]>([]);

  const submitForm = useCallback(() => {
    window.history.pushState(
      {},
      "",
      `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/websites/workspace/${chatId}`
    );

    const systemPrompt = selectedTemplate
      ? getTemplateSystemPrompt(selectedTemplate.label, tw)
      : null;

    const templatePart = systemPrompt
      ? [{ type: "text" as const, text: systemPrompt }]
      : [];

    sendMessage({
      role: "user",
      parts: [
        ...templatePart,
        ...attachments.map((a) => ({
          type: "file" as const,
          url: a.url,
          name: a.name,
          mediaType: a.contentType,
        })),
        { type: "text", text: input },
      ],
    });
    setAttachments([]);
    setLocalStorageInput("");
    setInput("");
    onClearTemplate?.();
    if (width && width > 768) {
      textareaRef.current?.focus();
    }
  }, [
    input,
    setInput,
    attachments,
    sendMessage,
    setAttachments,
    setLocalStorageInput,
    width,
    chatId,
    selectedTemplate,
    onClearTemplate,
    tw,
  ]);

  const uploadFile = useCallback(async (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    try {
      const r = await fetch(
        `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/files/upload`,
        { method: "POST", body: fd }
      );
      if (r.ok) {
        const d = await r.json();
        return { url: d.url, name: d.pathname, contentType: d.contentType };
      }
      toast.error((await r.json()).error);
    } catch {
      toast.error("Failed to upload file");
    }
  }, []);

  const handleFileChange = useCallback(
    async (e: ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      const imageFiles = files.filter((f) => f.type.startsWith("image/"));
      if (imageFiles.length > 0) {
        toast.error(
          "Images are not supported. Please upload PDF, CSV, TXT, JSON, Python, or other document files."
        );
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
        return;
      }
      setUploadQueue(files.map((f) => f.name));
      try {
        const uploaded = (await Promise.all(files.map(uploadFile))).filter(
          (a) => a !== undefined
        );
        setAttachments((c) => [...c, ...uploaded]);
      } catch {
        toast.error("Failed to upload files");
      } finally {
        setUploadQueue([]);
      }
    },
    [setAttachments, uploadFile]
  );

  const placeholder = tw("placeholder");

  return (
    <div className="relative flex w-full flex-col">
      <input
        className="pointer-events-none fixed -top-4 -left-4 size-0.5 opacity-0"
        multiple
        onChange={handleFileChange}
        ref={fileInputRef}
        tabIndex={-1}
        type="file"
      />
      <div className="relative">
        {selectedTemplate && (
          <div
            className="absolute left-4 top-3.5 z-10 w-24 rounded-lg overflow-hidden border border-black/20 dark:border-white/20 -rotate-6"
            style={{ aspectRatio: "16 / 9" }}
          >
            <Image
              alt={selectedTemplate.label}
              className="object-cover"
              fill
              src={selectedTemplate.src}
              unoptimized
            />
            <button
              className="absolute top-0.5 right-0.5 rounded-full bg-black/60 p-0.5 text-white hover:bg-black transition-colors"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onClearTemplate?.();
              }}
              type="button"
            >
              <XIcon className="size-2.5" />
            </button>
          </div>
        )}
        <PromptInput
          className="[&>div]:rounded-2xl [&>div]:border [&>div]:border-black/20 dark:[&>div]:border-white/15 [&>div]:bg-card/70 dark:[&>div]:bg-white/5 [&>div]:shadow-sm"
          onSubmit={() => {
            if (!input.trim() && attachments.length === 0) {
              return;
            }
            if (status === "ready" || status === "error") {
              submitForm();
            } else {
              toast.error("Please wait for the model to finish its response!");
            }
          }}
        >
          {(attachments.length > 0 || uploadQueue.length > 0) && (
            <div
              className="flex w-full self-start flex-row gap-2 overflow-x-auto px-3 pt-3 no-scrollbar"
              data-testid="attachments-preview"
            >
              {attachments.map((a) => (
                <PreviewAttachment
                  attachment={a}
                  key={a.url}
                  onRemove={() => {
                    setAttachments((c) => c.filter((x) => x.url !== a.url));
                    if (fileInputRef.current) {
                      fileInputRef.current.value = "";
                    }
                  }}
                />
              ))}
              {uploadQueue.map((f) => (
                <PreviewAttachment
                  attachment={{ url: "", name: f, contentType: "" }}
                  isUploading
                  key={f}
                />
              ))}
            </div>
          )}
          <PromptInputTextarea
            className={cn(
              "min-h-24 text-[13px] leading-relaxed px-4 pt-3.5 pb-1.5 text-black dark:text-white placeholder:text-black/60 dark:placeholder:text-white/40 caret-black dark:caret-white",
              selectedTemplate && "pl-32"
            )}
            data-testid="multimodal-input"
            onChange={handleInput}
            placeholder={placeholder}
            ref={textareaRef}
            value={input}
          />
          <PromptInputFooter className="px-3 pb-3">
            <PromptInputTools>
              <PlusMenu
                activeMode={mode}
                fileInputRef={fileInputRef}
                isWebsites={true}
                onModeSelect={setMode}
              />
              <Button
                className="h-7 rounded-lg px-2 text-[12px] text-black dark:text-white transition-colors hover:text-foreground gap-1.5"
                onClick={() => setMode(null)}
                variant="ghost"
              >
                <BotIcon className="size-3.5" />
                {mode ? `Agent · ${mode}` : "Agent"}
              </Button>
            </PromptInputTools>
            <div className="flex items-center gap-2">
              <Popover onOpenChange={setModelMenuOpen} open={modelMenuOpen}>
                <PopoverTrigger asChild>
                  <Button
                    className="h-7 rounded-lg px-2 text-[12px] text-black dark:text-white transition-colors hover:text-foreground gap-1"
                    variant="ghost"
                  >
                    {scientiaModels.find((m) => m.id === scientiaModel)
                      ?.label ?? "Fast"}
                    <ChevronDownIcon className="size-3" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  align="end"
                  className="w-40 rounded-xl border border-black/20 dark:border-white/20 bg-card p-1.5 shadow-sm"
                  side="top"
                  sideOffset={8}
                >
                  <div className="flex flex-col gap-0.5">
                    {scientiaModels.map((m) => (
                      <button
                        className={`flex items-center gap-2 rounded-lg px-2.5 py-2 text-[13px] transition-colors hover:bg-muted/60 ${
                          scientiaModel === m.id
                            ? "text-foreground bg-muted/40"
                            : "text-black dark:text-white"
                        }`}
                        key={m.id}
                        onClick={() => {
                          setScientiaModel(m.id);
                          setModelMenuOpen(false);
                        }}
                        type="button"
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
              {status === "submitted" ? (
                <StopButton setMessages={_setMessages} stop={stop} />
              ) : (
                <PromptInputSubmit
                  className={cn(
                    "h-7 w-7 rounded-xl transition-all duration-200",
                    input.trim()
                      ? "bg-black dark:bg-white text-white dark:text-black hover:bg-black/80 dark:hover:bg-white/80 active:scale-95"
                      : "bg-muted text-muted-foreground/25 cursor-not-allowed"
                  )}
                  data-testid="send-button"
                  disabled={!input.trim() || uploadQueue.length > 0}
                  status={status}
                  variant="secondary"
                >
                  <ArrowUpIcon className="size-4" />
                </PromptInputSubmit>
              )}
            </div>
          </PromptInputFooter>
        </PromptInput>
      </div>
    </div>
  );
}

export const WebsiteMultimodalInput = memo(
  PureWebsiteMultimodalInput,
  (prev, next) => {
    if (prev.input !== next.input) {
      return false;
    }
    if (prev.status !== next.status) {
      return false;
    }
    if (prev.isLoading !== next.isLoading) {
      return false;
    }
    if (prev.selectedTemplate !== next.selectedTemplate) {
      return false;
    }
    return true;
  }
);

function PureStopButton({
  stop,
  setMessages,
}: {
  stop: () => void;
  setMessages: UseChatHelpers<ChatMessage>["setMessages"];
}) {
  return (
    <Button
      className="h-7 w-7 rounded-xl bg-foreground p-1 text-background transition-all duration-200 hover:opacity-85 active:scale-95 disabled:bg-muted disabled:text-muted-foreground/25 disabled:cursor-not-allowed"
      data-testid="stop-button"
      onClick={(e) => {
        e.preventDefault();
        stop();
        setMessages((m) => m);
      }}
    >
      <StopIcon size={14} />
    </Button>
  );
}
const StopButton = memo(PureStopButton);
