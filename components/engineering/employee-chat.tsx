// components/engineering/employee-chat.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Employee } from "@/lib/employees/catalog";
import {
  mapSessionHistory,
  type SessionHistoryMessage,
  type SessionHistoryRow,
} from "@/lib/employees/session-history";
import { MissionExecutionPanel } from "./mission-execution-panel";
import type { useMissionStream } from "./use-mission-stream";

type ChatMessage = SessionHistoryMessage;

export function EmployeeChat({
  employee,
  sessionId,
  mission,
  onSessionResolved,
  onFailedSend,
}: {
  employee: Employee;
  sessionId: string | null;
  mission: ReturnType<typeof useMissionStream>;
  onSessionResolved: (sessionId: string) => void;
  onFailedSend: () => void;
}) {
  const t = useTranslations("employees");
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "greeting",
      role: "employee",
      text: t("chatGreeting", { name: employee.name, role: employee.role }),
    },
  ]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const idRef = useRef(0);
  // Epoques d'envoi : un telechargement d'historique qui se
  // termine APRES le debut d'un envoi est perime (il ecraserait
  // les messages optimistes) et doit etre ignore.
  const sendEpochRef = useRef(0);
  const sessionIdRef = useRef(sessionId);
  sessionIdRef.current = sessionId;

  const greeting = (): ChatMessage => ({
    id: "greeting",
    role: "employee",
    text: t("chatGreeting", { name: employee.name, role: employee.role }),
  });

  // Historique persistant : recharge la session ciblee depuis
  // la base. Sans session (page /atlas) = nouvelle session
  // vierge, jamais la derniere rouverte. Ne recharge que quand la
  // cible (employe/session) change : les re-rendus du parent ne
  // doivent jamais ecraser la discussion visible. Le nettoyage
  // libere la cle : en dev (StrictMode), le double montage ne
  // doit pas avaler le seul telechargement.
  const loadedKeyRef = useRef<string | null>(null);
  useEffect(() => {
    const loadedKey = `${employee.id}:${sessionId ?? ""}`;
    if (loadedKeyRef.current === loadedKey) {
      return;
    }
    loadedKeyRef.current = loadedKey;
    const fetchEpoch = sendEpochRef.current;
    let cancelled = false;
    if (!sessionId) {
      setMessages([greeting()]);
      setHistoryLoading(false);
      return;
    }
    setHistoryLoading(true);
    const url = `/api/employees/${encodeURIComponent(employee.id)}/chat?session=${encodeURIComponent(sessionId)}`;
    fetch(url)
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`history failed: ${response.status}`);
        }
        return (await response.json()) as {
          messages?: SessionHistoryRow[];
        };
      })
      .then((payload) => {
        // Perime : annule (navigation, demontage) ou depasse par
        // un envoi parti entre-temps (l'envoi est proprietaire de
        // la discussion visible jusqu'a son terme).
        if (cancelled || fetchEpoch !== sendEpochRef.current) {
          return;
        }
        const rows = Array.isArray(payload.messages)
          ? payload.messages
          : [];
        const mapped = mapSessionHistory(rows, {
          emptyReply: t("chatEmptyReply"),
          needsAcceptance: t("missionNeedsAcceptance"),
        });
        setMessages(mapped.length > 0 ? mapped : [greeting()]);
      })
      .catch(() => {
        // Historique indisponible : on garde la salutation, le
        // chat reste utilisable (l'envoi re-tentera la base).
      })
      .finally(() => {
        if (!cancelled) {
          setHistoryLoading(false);
        }
      });
    return () => {
      cancelled = true;
      if (loadedKeyRef.current === loadedKey) {
        loadedKeyRef.current = null;
      }
    };
  }, [employee.id, employee.name, employee.role, sessionId, t]);

  const appendMessage = (message: Omit<ChatMessage, "id">) => {
    idRef.current += 1;
    const id = `m${idRef.current}`;
    setMessages((prev) => [...prev, { ...message, id }]);
  };

  // Envoi unique (plus de double mode) : chaque message passe par
  // la boucle agentique (plan ecrit, puis execution). Pas de bulle
  // d'attente : le panneau d'execution montre le live, la reponse
  // conclut la discussion. Partage avec Retry (meme flux). Chaque
  // envoi perime les telechargements d'historique anterieurs (ils
  // ecraseraient les messages optimistes) et, s'il se termine
  // apres une navigation, ne touche ni a la vue ni a l'URL.
  const sendMissionMessage = async (text: string) => {
    if (sending) {
      return;
    }
    sendEpochRef.current += 1;
    const sendSessionId = sessionId;
    setSending(true);
    setError(null);
    appendMessage({ role: "user", text });
    try {
      const result = await mission.run({
        employeeId: employee.id,
        sessionId: sendSessionId,
        message: text,
      });
      if (
        sendSessionId !== null &&
        sessionIdRef.current !== sendSessionId
      ) {
        // Navigation entre-temps : la reponse est en base, la
        // liste se rafraichit, la vue visitee reste intacte.
        onFailedSend();
        return;
      }
      onSessionResolved(result.sessionId);
      appendMessage({
        role: "employee",
        text:
          result.needsAcceptance === true
            ? t("missionNeedsAcceptance")
            : (result.summary || t("chatEmptyReply")),
        missionId: result.missionId,
      });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        return;
      }
      setError(t("chatSendFailed"));
      // Le message est peut-etre quand meme en base (session
      // creee avant l'echec) : il doit apparaitre dans la liste.
      onFailedSend();
    } finally {
      setSending(false);
    }
  };

  const send = async () => {
    const text = input.trim();
    if (!text || sending) {
      return;
    }
    setInput("");
    await sendMissionMessage(text);
  };

  const showExecution =
    mission.running ||
    mission.progress.steps.length > 0 ||
    mission.progress.thinkingStep !== null ||
    mission.progress.failed !== null ||
    mission.progress.plan.length > 0 ||
    mission.outcome !== null;

  // Ordre chronologique : le panneau d'execution vit APRES le
  // message qui l'a declenche, dans le meme defilement. Le flux
  // reste colle au bas pendant un run, sauf si l'utilisateur est
  // remonte lire l'historique (on ne lui arrache jamais la
  // lecture).
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickToBottomRef = useRef(true);

  useEffect(() => {
    const node = scrollRef.current;
    if (!node || !stickToBottomRef.current) {
      return;
    }
    node.scrollTop = node.scrollHeight;
  }, [mission.running, mission.progress, mission.outcome, messages.length]);

  const handleScroll = () => {
    const node = scrollRef.current;
    if (!node) {
      return;
    }
    stickToBottomRef.current =
      node.scrollHeight - node.scrollTop - node.clientHeight < 120;
  };

  return (
    <div className="flex h-full min-h-0 flex-col rounded-xl border border-border/60 bg-card">
      <div className="border-b border-border/60 px-4 py-3">
        <p className="truncate text-[14px] font-medium text-foreground">
          {employee.name}
        </p>
        <p className="truncate text-[12px] text-muted-foreground">
          {employee.role}
        </p>
      </div>

      <div
        className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-4"
        data-testid="employee-messages"
        onScroll={handleScroll}
        ref={scrollRef}
      >
        {historyLoading && (
          <p className="text-[12px] text-muted-foreground">
            {t("chatHistoryLoading")}
          </p>
        )}
        {messages.map((message) => (
          <div
            className={cn(
              "max-w-[85%] rounded-lg px-3 py-2 text-[13px] leading-relaxed",
              message.role === "user"
                ? "self-end bg-foreground text-background"
                : "self-start bg-muted text-foreground"
            )}
            data-testid={`employee-message-${message.role}`}
            key={message.id}
          >
            {message.text}
            {message.missionId && (
              <span className="mt-1 block text-[11px] opacity-70">
                {t("missionRef", { id: message.missionId.slice(0, 8) })}
              </span>
            )}
          </div>
        ))}
        {showExecution && (
          <div className="w-full border-t border-border/60 pt-3">
            <MissionExecutionPanel
              mission={mission}
              onRetry={() => {
                if (!sending && mission.lastPrompt) {
                  void sendMissionMessage(mission.lastPrompt);
                }
              }}
            />
          </div>
        )}
        {error && (
          <p
            className="text-[12px] text-red-600 dark:text-red-400"
            data-testid="employee-send-error"
          >
            {error}
          </p>
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
          placeholder={t("missionPlaceholder")}
          value={input}
        />
        <Button
          disabled={sending || !input.trim()}
          onClick={() => void send()}
          size="sm"
          type="button"
          variant="brand"
        >
          {sending ? "…" : t("assignLabel")}
        </Button>
      </div>
    </div>
  );
}
