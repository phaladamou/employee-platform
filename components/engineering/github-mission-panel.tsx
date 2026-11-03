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

interface ConnectionStatus {
  connected: boolean;
  connectedAt?: string | null;
}

interface MissionResult {
  text: string;
  missionId?: string;
}

export function GithubMissionPanel({ employee }: { employee: Employee }) {
  const t = useTranslations("employees");
  const { data: connection } = useSWR<ConnectionStatus>(
    "/api/github/connection",
    fetcher,
    { revalidateOnFocus: false, refreshInterval: 10000 }
  );
  const [prompt, setPrompt] = useState("");
  const [running, setRunning] = useState(false);
  const [startedAt, setStartedAt] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [result, setResult] = useState<MissionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      controllerRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (!running) {
      return;
    }
    setElapsed(0);
    const timer = setInterval(
      () => setElapsed(Math.floor((Date.now() - startedAt) / 1000)),
      500
    );
    return () => clearInterval(timer);
  }, [running, startedAt]);

  const run = async () => {
    const message = prompt.trim();
    if (!message || running) return;
    const controller = new AbortController();
    controllerRef.current = controller;
    setRunning(true);
    setStartedAt(Date.now());
    setResult(null);
    setError(null);
    try {
      const response = await fetch(
        `/api/employees/${encodeURIComponent(employee.id)}/chat`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ message, asMission: true }),
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
        throw new Error(payload.error ?? `mission failed: ${response.status}`);
      }
      setResult({
        text:
          payload.needsAcceptance === true
            ? t("missionNeedsAcceptance")
            : (payload.summary || t("chatEmptyReply")),
        missionId: payload.mission?.id,
      });
    } catch {
      if (controller.signal.aborted) {
        return;
      }
      setError(t("chatSendFailed"));
    } finally {
      if (controllerRef.current === controller) {
        controllerRef.current = null;
      }
      setRunning(false);
    }
  };

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

      <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-4">
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
          disabled={running}
          onChange={(event) => setPrompt(event.target.value)}
          placeholder={t("githubMissionPlaceholder")}
          value={prompt}
        />
        <Button
          disabled={running || !prompt.trim()}
          onClick={() => void run()}
          size="sm"
          type="button"
          variant="brand"
        >
          {running ? (
            <span>
              {t("githubRunning")} ·{" "}
              <span className="tabular-nums">{elapsed}s</span>
            </span>
          ) : (
            t("githubRun")
          )}
        </Button>
      </div>
    </div>
  );
}
