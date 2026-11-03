// components/engineering/employee-chat.tsx
"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Employee } from "@/lib/employees/catalog";

interface ChatMessage {
  role: "user" | "employee";
  text: string;
  missionId?: string;
}

export function EmployeeChat({ employee }: { employee: Employee }) {
  const t = useTranslations("employees");
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "employee",
      text: t("chatGreeting", { name: employee.name, role: employee.role }),
    },
  ]);
  const [input, setInput] = useState("");
  const [asMission, setAsMission] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setSending(true);
    setError(null);
    setMessages((prev) => [...prev, { role: "user", text }]);
    setInput("");
    try {
      const response = await fetch(
        `/api/employees/${encodeURIComponent(employee.id)}/chat`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ message: text, asMission }),
        }
      );
      const payload = (await response.json()) as {
        reply?: string;
        mission?: { id: string };
        error?: string;
      };
      if (!response.ok) {
        throw new Error(payload.error ?? `chat failed: ${response.status}`);
      }
      setMessages((prev) => [
        ...prev,
        {
          role: "employee",
          text: payload.reply ?? t("chatEmptyReply"),
          missionId: payload.mission?.id,
        },
      ]);
    } catch {
      setError(t("chatSendFailed"));
    } finally {
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
        {messages.map((message, index) => (
          <div
            className={cn(
              "max-w-[85%] rounded-lg px-3 py-2 text-[13px] leading-relaxed",
              message.role === "user"
                ? "self-end bg-foreground text-background"
                : "self-start bg-muted text-foreground"
            )}
            key={`${index}-${message.role}`}
          >
            {message.text}
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
