// components/engineering/mission-execution-panel.tsx
"use client";

import {
  BanIcon,
  CheckCircle2Icon,
  EyeIcon,
  Loader2Icon,
  XCircleIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  resolveMissionDisplayStatus,
  type MissionDisplayStatus,
} from "@/lib/employees/mission-events";
import { MissionTimeline } from "./mission-timeline";
import type { useMissionStream } from "./use-mission-stream";

function BannerIcon({ status }: { status: MissionDisplayStatus | "running" }) {
  if (status === "running") {
    return <Loader2Icon className="size-4 shrink-0 animate-spin text-primary" />;
  }
  if (status === "succeeded") {
    return (
      <CheckCircle2Icon className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
    );
  }
  if (status === "failed") {
    return (
      <XCircleIcon className="size-4 shrink-0 text-red-600 dark:text-red-400" />
    );
  }
  if (status === "needs_review") {
    return (
      <EyeIcon className="size-4 shrink-0 text-amber-600 dark:text-amber-400" />
    );
  }
  return <BanIcon className="size-4 shrink-0 text-muted-foreground" />;
}

// Plan annonce par l'agent avant d'agir (live seul) : etapes
// numerotees, en attente pendant le run, cochees si reussi.
function PlanBlock({
  plan,
  done,
}: {
  plan: readonly string[];
  done: boolean;
}) {
  const t = useTranslations("employees");
  if (plan.length === 0) {
    return null;
  }
  return (
    <div className="flex flex-col gap-1">
      <p className="text-[11px] font-medium text-muted-foreground">
        {t("planTitle")}
      </p>
      <ol className="flex flex-col gap-0.5">
        {plan.map((stepText, index) => (
          <li
            className="flex items-baseline gap-2 text-[12.5px]"
            key={`${index}-${stepText}`}
          >
            <span className="shrink-0 font-mono text-[11px] text-muted-foreground tabular-nums">
              {index + 1}.
            </span>
            <span className="min-w-0 flex-1 truncate text-foreground">
              {stepText}
            </span>
            <span
              className={cn(
                "shrink-0 text-[11px] font-medium",
                done
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-muted-foreground"
              )}
            >
              {done ? t("stepDone") : t("missionStatus.queued")}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

// Panneau d'execution (centre, au-dessus de la discussion) : statut
// reel de la mission, preuves, actions Retry/Inspect, plan annonce
// puis timeline numerotee en temps reel. Le parent l'affiche quand
// un run existe.
export function MissionExecutionPanel({
  mission,
  onRetry,
}: {
  mission: ReturnType<typeof useMissionStream>;
  onRetry: () => void;
}) {
  const t = useTranslations("employees");
  const [inspecting, setInspecting] = useState(false);
  const { running, progress, elapsed, outcome, lastPrompt } = mission;

  const display: MissionDisplayStatus | "running" | null = running
    ? "running"
    : outcome
      ? resolveMissionDisplayStatus(outcome)
      : null;

  const steps = progress.steps.length;
  const files = progress.changes.length;
  const proofs = `${steps} step${steps === 1 ? "" : "s"} · ${files} file${files === 1 ? "" : "s"} · ${elapsed}s`;
  const failureText = progress.failed ?? outcome?.summary ?? "";
  const detailText =
    display === "needs_review"
      ? t("missionNeedsAcceptance")
      : (failureText || outcome?.summary || "");

  return (
    <div className="flex flex-col gap-3">
      {display && (
        <div
          className={cn(
            "rounded-xl border p-3",
            display === "running" && "border-primary/25 bg-primary/5",
            display === "succeeded" &&
              "border-emerald-500/25 bg-emerald-500/5",
            display === "failed" && "border-red-500/25 bg-red-500/5",
            display === "cancelled" && "border-border/60 bg-muted/40",
            display === "needs_review" &&
              "border-amber-500/25 bg-amber-500/5"
          )}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-2.5">
              <span className="mt-0.5">
                <BannerIcon status={display} />
              </span>
              <div className="min-w-0">
                <p className="truncate text-[13px] font-medium text-foreground">
                  {lastPrompt ?? t(`missionStatus.${display}`)}
                </p>
                <p className="mt-0.5 text-[12px] text-muted-foreground">
                  {display === "running" ? (
                    <>
                      {t("missionStatus.running")}
                      {" · "}
                      <span className="tabular-nums">{elapsed}s</span>
                    </>
                  ) : display === "succeeded" ? (
                    <>
                      {t("missionStatus.succeeded")}
                      {" · "}
                      <span className="tabular-nums">{proofs}</span>
                    </>
                  ) : display === "failed" ? (
                    <span className="line-clamp-2">
                      {t("missionStatus.failed")}
                      {failureText ? ` — ${failureText}` : ""}
                    </span>
                  ) : display === "cancelled" ? (
                    t("missionStatus.cancelled")
                  ) : (
                    t("missionStatus.needs_review")
                  )}
                </p>
              </div>
            </div>
            {!running && (
              <div className="flex shrink-0 items-center gap-1.5">
                {(display === "failed" || display === "cancelled") && (
                  <Button onClick={onRetry} size="sm" type="button" variant="brand">
                    {t("missionRetry")}
                  </Button>
                )}
                {display !== "cancelled" && (
                  <Button
                    onClick={() => setInspecting((value) => !value)}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    {t("missionInspect")}
                  </Button>
                )}
              </div>
            )}
          </div>
          {inspecting && !running && (
            <div className="mt-2.5 flex flex-col gap-1.5 border-t border-border/60 pt-2.5">
              {outcome?.missionId && (
                <p className="text-[11px] text-muted-foreground">
                  {t("missionRef", { id: outcome.missionId.slice(0, 8) })}
                </p>
              )}
              {detailText && (
                <p className="whitespace-pre-wrap text-[12px] leading-relaxed text-foreground">
                  {detailText}
                </p>
              )}
              <p className="font-mono text-[11px] text-muted-foreground tabular-nums">
                {proofs}
              </p>
            </div>
          )}
        </div>
      )}
      <PlanBlock done={display === "succeeded"} plan={progress.plan} />
      <MissionTimeline
        elapsed={running ? elapsed : undefined}
        numbered
        progress={progress}
      />
    </div>
  );
}
