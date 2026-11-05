// components/engineering/employee-chat.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Employee } from "@/lib/employees/catalog";
import {
  parseStoredPlan,
  progressFromRecords,
} from "@/lib/employees/mission-events";
import {
  cacheSessionMessages,
  readSessionMessages,
} from "@/lib/employees/session-message-cache";
import {
  mapSessionHistory,
  type SessionHistoryMessage,
  type SessionHistoryRow,
} from "@/lib/employees/session-history";
import { toToolCallRecords } from "@/lib/server/employee-conversation-mapping";
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
  const freshGreeting: ChatMessage = {
    id: "greeting",
    role: "employee",
    text: t("chatGreeting", { name: employee.name, role: employee.role }),
  };
  // Remontage post-envoi (navigation vers la route session) : la
  // discussion connue s'affiche aussitot, sans flash (ni
  // salutation seule, ni temoin de chargement) ; la base revalide
  // en silence derriere (effet d'historique ci-dessous).
  const [messages, setMessages] = useState<ChatMessage[]>(() =>
    sessionId === null
      ? [{ ...freshGreeting }]
      : (readSessionMessages(employee.id, sessionId) ?? [
          { ...freshGreeting },
        ])
  );
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(
    () =>
      sessionId !== null &&
      readSessionMessages(employee.id, sessionId) === null
  );
  const [error, setError] = useState<string | null>(null);
  const idRef = useRef(0);
  // Epoques d'envoi : un telechargement d'historique qui se
  // termine APRES le debut d'un envoi est perime (il ecraserait
  // les messages optimistes) et doit etre ignore.
  const sendEpochRef = useRef(0);
  const sessionIdRef = useRef(sessionId);
  sessionIdRef.current = sessionId;
  // Miroir synchrone de la liste (les effets et le nettoyage le
  // lisent : l'etat lui-meme serait perime dans leurs fermetures).
  const messagesRef = useRef<ChatMessage[]>(messages);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // Demontage (navigation post-envoi, changement de session) : la
  // discussion visible est memorisee sous la session visitee, la
  // vue suivante s'en sert pour s'afficher sans flash.
  const cacheEmployeeId = employee.id;
  useEffect(
    () => () => {
      const atId = sessionIdRef.current;
      if (atId !== null) {
        cacheSessionMessages(cacheEmployeeId, atId, messagesRef.current);
      }
    },
    [cacheEmployeeId]
  );

  const greeting = (): ChatMessage => ({
    id: "greeting",
    role: "employee",
    text: t("chatGreeting", { name: employee.name, role: employee.role }),
  });

  // Changement de session sans remontage : le brouillon et
  // l'erreur appartiennent a la session quittee (l'historique
  // recharge via l'effet ci-dessous).
  useEffect(() => {
    setInput("");
    setError(null);
  }, [sessionId]);

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
      // Vue neuve : le seau d'attente ne montre plus le run
      // termine de la precedente vue neuve.
      mission.resetPending();
      return;
    }
    const cached = readSessionMessages(employee.id, sessionId);
    if (cached) {
      // Discussion connue (remontage, retour de navigation) : elle
      // s'affiche aussitot, le GET ne fait que la confirmer en
      // silence (ni flash, ni temoin de chargement).
      setMessages(cached);
    } else {
      setHistoryLoading(true);
    }
    const url = `/api/employees/${encodeURIComponent(employee.id)}/chat?session=${encodeURIComponent(sessionId)}`;
    fetch(url)
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`history failed: ${response.status}`);
        }
        return (await response.json()) as {
          messages?: SessionHistoryRow[];
          lastMission?: {
            id: unknown;
            status: unknown;
            summary: unknown;
            needsAcceptance: unknown;
            toolCalls: unknown;
            plan: unknown;
          } | null;
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
        // Le processus fait partie de la reponse : plan, etapes
        // et fichiers restaures dans le panneau (no-op si un run
        // est en cours : le live gagne sur le restaure).
        const last = payload.lastMission;
        if (
          last &&
          typeof last.id === "string" &&
          typeof last.status === "string" &&
          typeof last.summary === "string"
        ) {
          const records = toToolCallRecords(last.toolCalls);
          mission.restore({
            sessionId,
            progress: {
              ...progressFromRecords(records),
              plan: parseStoredPlan(last.plan),
            },
            outcome: {
              missionId: last.id,
              summary: last.summary,
              needsAcceptance: last.needsAcceptance === true,
              sessionId,
              status: last.status,
            },
          });
        }
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

  const appendMessage = (message: Omit<ChatMessage, "id">): ChatMessage => {
    idRef.current += 1;
    const full: ChatMessage = { ...message, id: `m${idRef.current}` };
    setMessages((prev) => [...prev, full]);
    return full;
  };

  // Envoi unique (plus de double mode) : chaque message passe par
  // la boucle agentique (plan ecrit, puis execution). Pas de bulle
  // d'attente : le panneau d'execution montre le live, la reponse
  // conclut la discussion. Partage avec Retry (meme flux). Chaque
  // envoi perime les telechargements d'historique anterieurs (ils
  // ecraseraient les messages optimistes) et, s'il se termine
  // apres une navigation, ne touche ni a la vue ni a l'URL.
  const sendMissionMessage = async (text: string, forceMission = false) => {
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
        // Vue neuve : l'accueil affiche persiste en premier
        // (le serveur ne le garde que si la session est vierge).
        greeting:
          sendSessionId === null ? greeting().text : undefined,
        // Secours routage : le serveur force la boucle outillee.
        forceMission: forceMission === true ? true : undefined,
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
      const reply = appendMessage({
        role: "employee",
        text:
          result.needsAcceptance === true
            ? t("missionNeedsAcceptance")
            : (result.summary || t("chatEmptyReply")),
        missionId: result.missionId,
      });
      // La navigation qui suit remonte le chat : la discussion
      // complete est memorisee sous la session resolue pour que la
      // vue suivante s'affiche sans flash (le miroir ne contient
      // pas encore la reponse, ajoutee explicitement ici).
      cacheSessionMessages(employee.id, result.sessionId, [
        ...messagesRef.current,
        reply,
      ]);
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
  }, [
    mission.running,
    mission.progress,
    mission.outcome,
    mission.draft,
    messages.length,
  ]);

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
        {messages.map((message, index) => (
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
            {message.role === "employee" &&
              !message.missionId &&
              message.id !== "greeting" &&
              messages
                .slice(0, index)
                .some((row) => row.role === "user") && (
                <button
                  className="mt-1 block text-left text-[11px] text-muted-foreground underline-offset-2 hover:underline disabled:opacity-50"
                  data-testid="run-as-mission"
                  disabled={sending || mission.running}
                  onClick={() => {
                    const prior = messages
                      .slice(0, index)
                      .reverse()
                      .find((row) => row.role === "user");
                    if (prior && !sending && !mission.running) {
                      void sendMissionMessage(prior.text, true);
                    }
                  }}
                  type="button"
                >
                  {t("runAsMission")}
                </button>
              )}
          </div>
        ))}
        {mission.draft && (
          <div
            className="max-w-[85%] self-start rounded-lg bg-muted px-3 py-2 text-[13px] leading-relaxed text-foreground"
            data-testid="employee-draft"
          >
            {mission.draft}
          </div>
        )}
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
