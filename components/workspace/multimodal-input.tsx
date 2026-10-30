// components/workspace/multimodal-input.tsx
"use client";

import type { UseChatHelpers } from "@ai-sdk/react";
import type { UIMessage } from "ai";
import equal from "fast-deep-equal";
import { ArrowUpIcon, BotIcon, ChevronDownIcon, XIcon } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
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
import { useWindowSize } from "usehooks-ts";
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
import { useDraftInput } from "./use-draft-input";
import { useStickySession } from "./use-sticky-session";
import { PreviewAttachment } from "./preview-attachment";
import {
  type SlashCommand,
  SlashCommandMenu,
  useSlashCommands,
} from "./slash-commands";
import type { VisibilityType } from "./visibility-selector";

const scientiaModels = [
  { id: "fast", label: "Fast" },
  { id: "smart", label: "Smart" },
  { id: "creative", label: "Creative" },
] as const;

function PureMultimodalInput({
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
  className,
  selectedVisibilityType,
  selectedModelId: _selectedModelId,
  onModelChange: _onModelChange,
  editingMessage,
  onCancelEdit,
  isLoading: _isLoading,
  isWebsites,
  activeCategory,
  setActiveCategory: _setActiveCategory,
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
  sendMessage:
    | UseChatHelpers<ChatMessage>["sendMessage"]
    | (() => Promise<void>);
  className?: string;
  selectedVisibilityType: VisibilityType;
  selectedModelId: string;
  onModelChange?: (modelId: string) => void;
  editingMessage?: ChatMessage | null;
  onCancelEdit?: () => void;
  isLoading?: boolean;
  isWebsites?: boolean;
  activeCategory?: string | null;
  setActiveCategory?: (category: string | null) => void;
  selectedTemplate?: { src: string; label: string } | null;
  onClearTemplate?: () => void;
}) {
  const router = useRouter();
  const { setTheme, resolvedTheme } = useTheme();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { width } = useWindowSize();
  const hasAutoFocused = useRef(false);
  const [mode, setMode] = useState<ModeType | null>(null);
  const [scientiaModel, setScientiaModel] = useState("fast");
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const { modeRef } = useActiveChat();
  const t = useTranslations("chat");
  const tw = useTranslations("websites");
  const slashCommands = useSlashCommands();

  useEffect(() => {
    modeRef.current = mode;
  }, [mode, modeRef]);

  useEffect(() => {
    if (!hasAutoFocused.current && width) {
      const timer = setTimeout(() => {
        textareaRef.current?.focus();
        hasAutoFocused.current = true;
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [width]);

  // Brouillon lie au compte (jamais partage entre comptes).
  const { user: stickyUser } = useStickySession();
  const [localStorageInput, setLocalStorageInput] = useDraftInput(
    stickyUser?.id
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
    const val = event.target.value;
    setInput(val);
    if (val.startsWith("/") && !val.includes(" ")) {
      setSlashOpen(true);
      setSlashQuery(val.slice(1));
      setSlashIndex(0);
    } else {
      setSlashOpen(false);
    }
  };

  const handleSlashSelect = (cmd: SlashCommand) => {
    setSlashOpen(false);
    setInput("");
    switch (cmd.action) {
      case "new":
        router.push("/workspace");
        break;
      case "clear":
        setMessages(() => []);
        break;
      case "rename":
        toast("Rename is available from the sidebar chat menu.");
        break;
      case "model":
        document
          .querySelector<HTMLButtonElement>("[data-testid='model-selector']")
          ?.click();
        break;
      case "theme":
        setTheme(resolvedTheme === "dark" ? "light" : "dark");
        break;
      case "delete":
        toast("Delete this chat?", {
          action: {
            label: "Delete",
            onClick: () => {
              fetch(
                `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/chat?id=${chatId}`,
                { method: "DELETE" }
              );
              router.push("/workspace");
              toast.success("Chat deleted");
            },
          },
        });
        break;
      case "purge":
        toast("Delete all chats?", {
          action: {
            label: "Delete all",
            onClick: () => {
              fetch(`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/history`, {
                method: "DELETE",
              });
              router.push("/workspace");
              toast.success("All chats deleted");
            },
          },
        });
        break;
    }
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadQueue, setUploadQueue] = useState<string[]>([]);
  const [slashOpen, setSlashOpen] = useState(false);
  const [slashQuery, setSlashQuery] = useState("");
  const [slashIndex, setSlashIndex] = useState(0);

  const submitForm = useCallback(() => {
    window.history.pushState(
      {},
      "",
      `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/workspace/${chatId}`
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
    if (width && width > 768) textareaRef.current?.focus();
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
        if (fileInputRef.current) fileInputRef.current.value = "";
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

  const handlePaste = useCallback(async (e: ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    const imgs = Array.from(items).filter((i) => i.type.startsWith("image/"));
    if (imgs.length > 0) {
      e.preventDefault();
      toast.error(
        "Images are not supported. Please paste text or upload document files."
      );
      return;
    }
  }, []);

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.addEventListener("paste", handlePaste);
    return () => ta.removeEventListener("paste", handlePaste);
  }, [handlePaste]);

  const placeholder = editingMessage
    ? t("editMessage")
    : isWebsites
      ? tw("placeholder")
      : activeCategory
        ? t(`${activeCategory.toLowerCase()}Placeholder`) || t("askAnything")
        : t("askAnything");

  return (
    <div className={cn("relative flex w-full flex-col gap-4", className)}>
      {editingMessage && onCancelEdit && (
        <div className="flex items-center gap-2 text-[12px] text-black dark:text-white">
          <span>{t("editingMessage")}</span>
          <button
            className="rounded px-1.5 py-0.5 text-black/50 dark:text-white/50 transition-colors hover:bg-muted hover:text-black dark:hover:text-white"
            onMouseDown={(e) => {
              e.preventDefault();
              onCancelEdit();
            }}
            type="button"
          >
            {t("cancel")}
          </button>
        </div>
      )}
      <input
        className="pointer-events-none fixed -top-4 -left-4 size-0.5 opacity-0"
        multiple
        onChange={handleFileChange}
        ref={fileInputRef}
        tabIndex={-1}
        type="file"
      />
      <div className="relative">
        {slashOpen && (
          <SlashCommandMenu
            commands={slashCommands}
            onClose={() => setSlashOpen(false)}
            onSelect={handleSlashSelect}
            query={slashQuery}
            selectedIndex={slashIndex}
          />
        )}
      </div>
      <div className="relative">
        {selectedTemplate && (
          <div
            className="absolute left-4 top-3.5 z-10 w-24 rounded-lg overflow-hidden border border-black/20 dark:border-white/20 -rotate-3"
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
          className="[&>div]:rounded-2xl [&>div]:border [&>div]:border-black/20 dark:[&>div]:border-white/15 [&>div]:bg-card/70 dark:[&>div]:bg-white/5 [&>div]:shadow-[var(--shadow-composer)] [&>div]:shadow-sm"
          onSubmit={() => {
            if (input.startsWith("/")) {
              const q = input.slice(1).trim();
              const c = slashCommands.find((x) => x.name === q);
              if (c) {
                handleSlashSelect(c);
                return;
              }
            }
            if (!input.trim() && attachments.length === 0) return;
            if (status === "ready" || status === "error") submitForm();
            else
              toast.error("Please wait for the model to finish its response!");
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
                    if (fileInputRef.current) fileInputRef.current.value = "";
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
              "min-h-20 text-[13px] leading-relaxed px-4 pt-3 pb-1 text-black dark:text-white placeholder:text-black/60 dark:placeholder:text-white/40 caret-black dark:caret-white",
              selectedTemplate && "pl-32"
            )}
            data-testid="multimodal-input"
            onChange={handleInput}
            onKeyDown={(e) => {
              if (slashOpen) {
                const f = slashCommands.filter((c) =>
                  c.name.startsWith(slashQuery.toLowerCase())
                );
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setSlashIndex((i) => Math.min(i + 1, f.length - 1));
                  return;
                }
                if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setSlashIndex((i) => Math.max(i - 1, 0));
                  return;
                }
                if (e.key === "Enter" || e.key === "Tab") {
                  e.preventDefault();
                  if (f[slashIndex]) handleSlashSelect(f[slashIndex]);
                  return;
                }
                if (e.key === "Escape") {
                  e.preventDefault();
                  setSlashOpen(false);
                  return;
                }
              }
              if (e.key === "Escape" && editingMessage && onCancelEdit) {
                e.preventDefault();
                onCancelEdit();
              }
            }}
            placeholder={placeholder}
            ref={textareaRef}
            value={input}
          />
          <PromptInputFooter className="px-3 pb-3">
            <PromptInputTools>
              <PlusMenu
                activeMode={mode}
                fileInputRef={fileInputRef}
                isWebsites={isWebsites}
                onModeSelect={setMode}
              />
              <Button
                className="h-7 rounded-lg px-2 text-[12px] text-black dark:text-white transition-colors hover:text-foreground gap-1.5"
                onClick={() => setMode(null)}
                variant="ghost"
              >
                <BotIcon className="size-3.5" />
                {mode ? `Agent · ${t(mode)}` : "Agent"}
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
                  className="w-40 rounded-xl border border-black/20 dark:border-white/20 bg-card p-1.5 shadow-[var(--shadow-float)]"
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
                <StopButton setMessages={setMessages} stop={stop} />
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

export const MultimodalInput = memo(PureMultimodalInput, (prev, next) => {
  if (prev.input !== next.input) return false;
  if (prev.status !== next.status) return false;
  if (!equal(prev.attachments, next.attachments)) return false;
  if (prev.selectedVisibilityType !== next.selectedVisibilityType) return false;
  if (prev.editingMessage !== next.editingMessage) return false;
  if (prev.isLoading !== next.isLoading) return false;
  if (prev.messages.length !== next.messages.length) return false;
  if (prev.activeCategory !== next.activeCategory) return false;
  if (prev.setActiveCategory !== next.setActiveCategory) return false;
  if (prev.selectedTemplate !== next.selectedTemplate) return false;
  if (prev.onClearTemplate !== next.onClearTemplate) return false;
  return true;
});

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