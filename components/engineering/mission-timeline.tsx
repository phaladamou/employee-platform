// components/engineering/mission-timeline.tsx
"use client";

import {
  BrainIcon,
  CheckCircle2Icon,
  Loader2Icon,
  XCircleIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef } from "react";

import { cn } from "@/lib/utils";
import {
  formatThoughtSecs,
  toolLabel,
  type MissionProgressState,
  type MissionStepState,
} from "@/lib/employees/mission-events";

function StepIcon({ status }: { status: MissionStepState["status"] }) {
  if (status === "ok") {
    return (
      <CheckCircle2Icon className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
    );
  }
  if (status === "failed") {
    return (
      <XCircleIcon className="size-4 shrink-0 text-red-600 dark:text-red-400" />
    );
  }
  return <Loader2Icon className="size-4 shrink-0 animate-spin text-primary" />;
}

function StepStatusWord({ status }: { status: MissionStepState["status"] }) {
  const t = useTranslations("employees");
  return (
    <span
      className={cn(
        "shrink-0 text-[11px] font-medium",
        status === "ok" && "text-emerald-600 dark:text-emerald-400",
        status === "failed" && "text-red-600 dark:text-red-400",
        status === "running" && "text-primary"
      )}
    >
      {status === "ok"
        ? t("stepDone")
        : status === "failed"
          ? t("stepFailed")
          : t("stepRunning")}
    </span>
  );
}

function StepRow({
  row,
  numbered,
}: {
  row: MissionStepState;
  numbered: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const active = row.status === "running";
  const t = useTranslations("employees");

  // La ligne en cours reste visible sans voler le defilement
  // (plus proche voisin uniquement).
  useEffect(() => {
    if (active) {
      ref.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [active ]);

  return (
    <div className="flex flex-col gap-1.5" ref={ref}>
      {row.thoughtMs !== null && row.thoughtMs > 0 && (
        <div className="flex items-center gap-2.5">
          <span className="flex w-4 justify-center">
            <BrainIcon className="size-3.5 text-muted-foreground/70" />
          </span>
          <p className="text-[12px] text-muted-foreground">
            {t("thoughtFor", { secs: formatThoughtSecs(row.thoughtMs) })}
          </p>
        </div>
      )}
      <div className="flex items-start gap-2.5">
        {numbered && (
          <span className="mt-px w-5 shrink-0 text-right font-mono text-[12px] text-muted-foreground tabular-nums">
            {row.step}.
          </span>
        )}
        <span className="mt-0.5">
          <StepIcon status={row.status} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <p className="min-w-0 flex-1 truncate text-[13px] font-medium text-foreground">
              {row.title ?? (row.tool ? toolLabel(row.tool) : "…")}
            </p>
            <StepStatusWord status={row.status} />
          </div>
          {row.tool && (
            <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
              {toolLabel(row.tool)}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// Timeline d'execution d'une mission : une ligne par etape ReAct
// (titre ecrit par l'agent, phase d'outil), la reflexion en cours,
// puis le rapport. Utilisee en live (discussion, GitHub) et en
// relecture (historique).
export function MissionTimeline({
  progress,
  elapsed,
  numbered = false,
  className,
}: {
  progress: MissionProgressState;
  elapsed?: number;
  numbered?: boolean;
  className?: string;
}) {
  const t = useTranslations("employees");
  const thinkingRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (progress.thinkingStep !== null) {
      thinkingRef.current?.scrollIntoView({
        block: "nearest",
        behavior: "smooth",
      });
    }
  }, [progress.thinkingStep, progress.steps.length]);

  if (
    progress.steps.length === 0 &&
    progress.thinkingStep === null &&
    !progress.failed
  ) {
    return null;
  }

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {progress.steps.map((row) => (
        <StepRow key={row.step} numbered={numbered} row={row} />
      ))}
      {progress.finalThoughtMs !== null && progress.finalThoughtMs > 0 && (
        <div className="flex items-center gap-2.5">
          <span className="flex w-4 justify-center">
            <BrainIcon className="size-3.5 text-muted-foreground/70" />
          </span>
          <p className="text-[12px] text-muted-foreground">
            {t("thoughtFor", { secs: formatThoughtSecs(progress.finalThoughtMs) })}
          </p>
        </div>
      )}
      {progress.thinkingStep !== null && (
        <div className="flex items-center gap-2.5" ref={thinkingRef}>
          <span className="inline-flex gap-1" aria-hidden="true">
            <span className="size-1.5 animate-pulse rounded-full bg-muted-foreground" />
            <span className="size-1.5 animate-pulse rounded-full bg-muted-foreground [animation-delay:150ms]" />
            <span className="size-1.5 animate-pulse rounded-full bg-muted-foreground [animation-delay:300ms]" />
          </span>
          <p className="text-[12px] text-muted-foreground">
            {t("missionThinking")}
            {typeof elapsed === "number" && (
              <>
                {" · "}
                <span className="tabular-nums">{elapsed}s</span>
              </>
            )}
          </p>
        </div>
      )}
      {progress.failed && (
        <p className="text-[12px] text-red-600 dark:text-red-400">
          {progress.failed}
        </p>
      )}
    </div>
  );
}
