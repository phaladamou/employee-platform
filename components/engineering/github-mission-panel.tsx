// components/engineering/github-mission-panel.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { GithubIcon } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import useSWR from "swr";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Employee } from "@/lib/employees/catalog";
import { fetcher } from "@/lib/utils";
import { MissionTimeline } from "./mission-timeline";
import type { useMissionStream } from "./use-mission-stream";

interface ConnectionStatus {
  connected: boolean;
  connectedAt?: string | null;
}

interface MissionResult {
  text: string;
  missionId?: string;
}

export function GithubMissionPanel({
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
  const { data: connection } = useSWR<ConnectionStatus>(
    "/api/github/connection",
    fetcher,
    { revalidateOnFocus: false, refreshInterval: 10000 }
  );
  const [prompt, setPrompt] = useState("");
  const [result, setResult] = useState<MissionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const sessionIdRef = useRef(sessionId);
  sessionIdRef.current = sessionId;

  // Changement de session sans remontage : brouillon, resultat
  // et erreur appartiennent a la session quittee.
  useEffect(() => {
    setPrompt("");
    setResult(null);
    setError(null);
  }, [sessionId]);

  const run = async () => {
    const message = prompt.trim();
    if (!message || mission.running) return;
    const sendSessionId = sessionId;
    setResult(null);
    setError(null);
    try {
      const outcome = await mission.run({
        employeeId: employee.id,
        sessionId: sendSessionId,
        message,
        // Meme contrat que la discussion : une session creee
        // depuis GitHub commence par l'accueil de l'employe.
        greeting:
          sendSessionId === null
            ? t("chatGreeting", { name: employee.name, role: employee.role })
            : undefined,
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
      onSessionResolved(outcome.sessionId);
      setResult({
        text:
          outcome.needsAcceptance === true
            ? t("missionNeedsAcceptance")
            : (outcome.summary || t("chatEmptyReply")),
        missionId: outcome.missionId,
      });
    } catch (thrown) {
      if (thrown instanceof Error && thrown.name === "AbortError") {
        return;
      }
      setError(t("chatSendFailed"));
      onFailedSend();
    }
  };

  const showTimeline =
    mission.running ||
    mission.progress.steps.length > 0 ||
    mission.progress.failed !== null;

  return (
    <div className="flex h-full min-h-0 flex-col rounded-xl border border-border/60 bg-card">
      <div className="flex items-center justify-between gap-3 border-b border-border/60 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <GithubIcon className="size-4 shrink-0 text-muted-foreground" />
          <p className="truncate text-[14px] font-medium text-foreground">
            {employee.name} — {t("githubTab")}
          </p>
        </div>
        <span
          className={cn(
            "inline-flex shrink-0 items-center rounded-full border px-2.5 py-1 text-[11px] font-medium",
            connection?.connected === true
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700"
              : "border-border bg-muted/50 text-muted-foreground"
          )}
        >
          {connection?.connected === true
            ? t("githubConnected")
            : t("githubNotConnectedShort")}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 py-4">
        {connection?.connected !== true && (
          <p className="rounded-lg bg-muted px-3 py-2 text-[12px] leading-relaxed text-muted-foreground">
            {t("githubNotConnected")}{" "}
            <Link
              className="font-medium text-foreground underline underline-offset-2"
              href="/settings/github"
            >
              {t("githubConnectLink")}
            </Link>
          </p>
        )}
        {showTimeline && (
          <MissionTimeline
            elapsed={mission.running ? mission.elapsed : undefined}
            progress={mission.progress}
          />
        )}
        {result && (
          <div className="max-w-[85%] self-start rounded-lg bg-muted px-3 py-2 text-[13px] leading-relaxed text-foreground">
            {result.text}
            {result.missionId && (
              <span className="mt-1 block text-[11px] opacity-70">
                {t("missionRef", { id: result.missionId.slice(0, 8) })}
              </span>
            )}
          </div>
        )}
        {error && (
          <p className="text-[12px] text-red-600 dark:text-red-400">{error}</p>
        )}
      </div>

      <div className="flex flex-col gap-2 border-t border-border/60 p-3">
        <textarea
          aria-label={t("githubMissionPlaceholder")}
          className="min-h-20 w-full resize-y rounded-lg border border-border bg-background px-3 py-2 text-[13px] text-foreground outline-none placeholder:text-muted-foreground focus:border-foreground/40"
          disabled={mission.running}
          onChange={(event) => setPrompt(event.target.value)}
          placeholder={t("githubMissionPlaceholder")}
          value={prompt}
        />
        <Button
          disabled={mission.running || !prompt.trim()}
          onClick={() => void run()}
          size="sm"
          type="button"
          variant="brand"
        >
          {mission.running ? (
            <span>
              {t("githubRunning")} ·{" "}
              <span className="tabular-nums">{mission.elapsed}s</span>
            </span>
          ) : (
            t("githubRun")
          )}
        </Button>
      </div>
    </div>
  );
}
