// components/engineering/employee-chat.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Employee } from "@/lib/employees/catalog";

interface ChatMessage {
  id: string;
  role: "user" | "employee";
  text: string;
  missionId?: string;
  pending?: boolean;
  startedAt?: number;
  mission?: boolean;
}

export function EmployeeChat({ employee }: { employee: Employee }) {
  const t = useTranslations("employees");
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "greeting",
      role: "employee",
      text: t("chatGreeting", { name: employee.name, role: employee.role }),
    },
  ]);
  const [input, setInput] = useState("");
  const [asMission, setAsMission] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, setTick] = useState(0);
  const idRef = useRef(0);
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      controllerRef.current?.abort();
    };
  }, []);

  const hasPending = messages.some((message) => message.pending === true);

  useEffect(() => {
    if (!hasPending) {
      return;
    }
    const timer = setInterval(() => setTick((tick) => tick + 1), 500);
    return () => clearInterval(timer);
  }, [hasPending]);

  const patchMessage = (id: string, patch: Partial<ChatMessage>) => {
    setMessages((prev) =>
      prev.map((message) =>
        message.id === id ? { ...message, ...patch } : message
      )
    );
  };

  const appendText = (id: string, chunk: string) => {
    setMessages((prev) =>
      prev.map((message) =>
        message.id === id
          ? { ...message, text: message.text + chunk }
          : message
      )
    );
  };

  const dropMessage = (id: string) => {
    setMessages((prev) => prev.filter((message) => message.id !== id));
  };

  const send = async () => {
    const text = input.trim();
    if (!text || sending) return;
    const missionMode = asMission;
    idRef.current += 1;
    const placeholderId = `e${idRef.current}`;
    const controller = new AbortController();
    controllerRef.current = controller;
    setSending(true);
    setError(null);
    setMessages((prev) => [
      ...prev,
      { id: `u${idRef.current}`, role: "user", text },
      {
        id: placeholderId,
        role: "employee",
        text: "",
        pending: true,
        startedAt: Date.now(),
        mission: missionMode,
      },
    ]);
    setInput("");
    try {
      if (missionMode) {
        const response = await fetch(
          `/api/employees/${encodeURIComponent(employee.id)}/chat`,
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ message: text, asMission: true }),
            signal: controller.signal,
          }
        );
        const payload = (await response.json()) as {
          mission?: { id: string };
          summary?: string;
          needsAcceptance?: boolean;
          error?: string;
        };
        if (!response.ok) {
          throw new Error(payload.error ?? `chat failed: ${response.status}`);
        }
        const replyText =
          payload.needsAcceptance === true
            ? t("missionNeedsAcceptance")
            : (payload.summary || t("chatEmptyReply"));
        patchMessage(placeholderId, {
          pending: false,
          text: replyText,
          missionId: payload.mission?.id,
        });
      } else {
        const response = await fetch(
          `/api/employees/${encodeURIComponent(employee.id)}/chat?stream=1`,
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ message: text, asMission: false }),
            signal: controller.signal,
          }
        );
        if (!response.ok || !response.body) {
          throw new Error(`chat stream failed: ${response.status}`);
        }
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let received = "";
        for (;;) {
          const { done, value } = await reader.read();
          if (done) {
            break;
          }
          const chunk = decoder.decode(value, { stream: true });
          if (chunk) {
            received += chunk;
            appendText(placeholderId, chunk);
          }
        }
        if (!received) {
          throw new Error("chat stream returned nothing");
        }
        patchMessage(placeholderId, { pending: false });
      }
    } catch {
      if (controller.signal.aborted) {
        return;
      }
      dropMessage(placeholderId);
      setError(t("chatSendFailed"));
    } finally {
      if (controllerRef.current === controller) {
        controllerRef.current = null;
      }
      setSending(false);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col rounded-xl border border-border/60 bg-card">
      <div className="flex items-center justify-between gap-3 border-b border-border/60 px-4 py-3">
        <div className="min-w-0">
          <p className="truncate text-[14px] font-medium text-foreground">
            {employee.name}
          </p>
          <p className="truncate text-[12px] text-muted-foreground">
            {employee.role}
          </p>
        </div>
        <label className="flex shrink-0 cursor-pointer items-center gap-2 text-[12px] text-muted-foreground">
          <input
            checked={asMission}
            className="size-4 accent-foreground"
            onChange={(event) => setAsMission(event.target.checked)}
            type="checkbox"
          />
          {t("missionLabel")}
        </label>
      </div>

      <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-4">
        {messages.map((message) => (
          <div
            className={cn(
              "max-w-[85%] rounded-lg px-3 py-2 text-[13px] leading-relaxed",
              message.role === "user"
                ? "self-end bg-foreground text-background"
                : "self-start bg-muted text-foreground"
            )}
            key={message.id}
          >
            {message.pending === true && !message.text ? (
              <ThinkingLine
                elapsed={
                  message.startedAt
                    ? Math.max(
                        0,
                        Math.floor((Date.now() - message.startedAt) / 1000)
                      )
                    : 0
                }
                label={
                  message.mission === true
                    ? t("chatMissionRunning")
                    : t("chatThinking", { name: employee.name })
                }
              />
            ) : (
              message.text
            )}
            {message.missionId && (
              <span className="mt-1 block text-[11px] opacity-70">
                {t("missionRef", { id: message.missionId.slice(0, 8) })}
              </span>
            )}
          </div>
        ))}
        {error && (
          <p className="text-[12px] text-red-600 dark:text-red-400">{error}</p>
        )}
      </div>

      <div className="flex gap-2 border-t border-border/60 p-3">
        <input
          aria-label={t("messageLabel")}
          className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-[13px] text-foreground outline-none placeholder:text-muted-foreground focus:border-foreground/40"
          disabled={sending}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void send();
            }
          }}
          placeholder={
            asMission ? t("missionPlaceholder") : t("chatPlaceholder")
          }
          value={input}
        />
        <Button
          disabled={sending || !input.trim()}
          onClick={() => void send()}
          size="sm"
          type="button"
          variant="brand"
        >
          {sending ? "…" : asMission ? t("assignLabel") : t("sendLabel")}
        </Button>
      </div>
    </div>
  );
}

function ThinkingLine({ label, elapsed }: { label: string; elapsed: number }) {
  return (
    <span className="inline-flex items-center gap-2 text-muted-foreground">
      <span aria-hidden="true" className="inline-flex gap-1">
        <span className="size-1.5 animate-pulse rounded-full bg-current" />
        <span
          aria-hidden="true"
          className="size-1.5 animate-pulse rounded-full bg-current [animation-delay:150ms]"
        />
        <span
          aria-hidden="true"
          className="size-1.5 animate-pulse rounded-full bg-current [animation-delay:300ms]"
        />
      </span>
      <span>
        {label} · <span className="tabular-nums">{elapsed}s</span>
      </span>
    </span>
  );
}
