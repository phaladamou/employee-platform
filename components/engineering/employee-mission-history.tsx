// components/engineering/employee-mission-history.tsx
"use client";

import { ArrowLeftIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import useSWR from "swr";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { fetcher } from "@/lib/utils";
import { progressFromRecords } from "@/lib/employees/mission-events";
import { MissionTimeline } from "./mission-timeline";

interface ToolCall {
  tool: string;
  ok: boolean;
  title?: string;
  thoughtMs?: number;
}

interface MissionRow {
  id: string;
  title: string;
  status: string;
  toolCalls: ToolCall[];
  createdAt: string;
  updatedAt: string;
}

interface MissionDetail extends MissionRow {
  prompt: string;
  report: string | null;
}

const MISSION_STATUS_STYLES: Record<string, string> = {
  queued: "border-border bg-muted/50 text-muted-foreground",
  running: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700",
  succeeded: "border-sky-500/30 bg-sky-500/10 text-sky-700",
  failed: "border-red-500/30 bg-red-500/10 text-red-700",
  needs_review: "border-amber-500/30 bg-amber-500/10 text-amber-700",
};

function MissionStatusBadge({ status }: { status: string }) {
  const t = useTranslations("employees");
  const label =
    status === "queued" ||
    status === "running" ||
    status === "succeeded" ||
    status === "failed" ||
    status === "needs_review"
      ? t(`missionStatus.${status}`)
      : status;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full border px-2.5 py-1 text-[11px] font-medium",
        MISSION_STATUS_STYLES[status] ??
          "border-border bg-muted/50 text-muted-foreground"
      )}
    >
      {label}
    </span>
  );
}

function MissionSteps({ calls }: { calls: ToolCall[] }) {
  const t = useTranslations("employees");
  if (calls.length === 0) {
    return (
      <p className="text-[12px] text-muted-foreground">{t("historyNoTools")}</p>
    );
  }
  return <MissionTimeline progress={progressFromRecords(calls)} />;
}

function MissionDetailView({
  employeeId,
  missionId,
  onBack,
}: {
  employeeId: string;
  missionId: string;
  onBack: () => void;
}) {
  const t = useTranslations("employees");
  const { data, error, isLoading } = useSWR<{ mission: MissionDetail }>(
    `/api/employees/${encodeURIComponent(employeeId)}/missions/${encodeURIComponent(missionId)}`,
    fetcher,
    { revalidateOnFocus: false }
  );
  const mission = data?.mission ?? null;

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-y-auto px-4 py-4">
      <button
        className="flex items-center gap-1.5 self-start text-[13px] text-muted-foreground transition-colors hover:text-foreground"
        onClick={onBack}
        type="button"
      >
        <ArrowLeftIcon className="size-4" />
        {t("backToHistory")}
      </button>
      {isLoading ? (
        <p className="text-[13px] text-muted-foreground">
          {t("historyLoading")}
        </p>
      ) : error || !mission ? (
        <p className="text-[13px] text-muted-foreground">
          {t("historyLoadFailed")}
        </p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <MissionStatusBadge status={mission.status} />
            <span className="text-[12px] text-muted-foreground">
              {new Date(mission.createdAt).toLocaleString()}
            </span>
          </div>
          <div>
            <p className="mb-1 text-[12px] font-medium text-muted-foreground">
              {t("historyPromptTitle")}
            </p>
            <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-foreground">
              {mission.prompt}
            </p>
          </div>
          <div>
            <p className="mb-1 text-[12px] font-medium text-muted-foreground">
              {t("historyReportTitle")}
            </p>
            {mission.report ? (
              <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-foreground">
                {mission.report}
              </p>
            ) : (
              <p className="text-[13px] text-muted-foreground">
                {t("historyNoReport")}
              </p>
            )}
          </div>
          <div>
            <p className="mb-1.5 text-[12px] font-medium text-muted-foreground">
              {t("historyToolsTitle")}
            </p>
            <MissionSteps calls={mission.toolCalls} />
          </div>
        </>
      )}
    </div>
  );
}

export function EmployeeMissionHistory({
  employeeId,
  employeeName,
}: {
  employeeId: string;
  employeeName: string;
}) {
  const t = useTranslations("employees");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { data, error, isLoading, mutate } = useSWR<{
    missions: MissionRow[];
  }>(
    `/api/employees/${encodeURIComponent(employeeId)}/missions`,
    fetcher,
    { revalidateOnFocus: false }
  );

  return (
    <div className="flex h-full min-h-0 flex-col rounded-xl border border-border/60 bg-card">
      <div className="border-b border-border/60 px-4 py-3">
        <p className="truncate text-[14px] font-medium text-foreground">
          {employeeName}
        </p>
        <p className="truncate text-[12px] text-muted-foreground">
          {t("historyTab")}
        </p>
      </div>
      <div className="min-h-0 flex-1">
        {selectedId ? (
          <MissionDetailView
            employeeId={employeeId}
            missionId={selectedId}
            onBack={() => setSelectedId(null)}
          />
        ) : isLoading ? (
          <p className="px-4 py-8 text-center text-[13px] text-muted-foreground">
            {t("historyLoading")}
          </p>
        ) : error || !data ? (
          <div className="flex flex-col items-center gap-3 px-4 py-8 text-center">
            <p className="text-[13px] text-muted-foreground">
              {t("historyLoadFailed")}
            </p>
            <Button
              onClick={() => mutate()}
              size="sm"
              type="button"
              variant="outline"
            >
              {t("departmentRetry")}
            </Button>
          </div>
        ) : data.missions.length === 0 ? (
          <p className="px-4 py-8 text-center text-[13px] text-muted-foreground">
            {t("historyEmpty")}
          </p>
        ) : (
          <ul className="flex h-full flex-col gap-2 overflow-y-auto px-4 py-4">
            {data.missions.map((mission) => (
              <li key={mission.id}>
                <button
                  className="flex w-full flex-col gap-1.5 rounded-lg border border-border/60 bg-background p-3 text-left transition-colors hover:border-foreground/30"
                  onClick={() => setSelectedId(mission.id)}
                  type="button"
                >
                  <span className="line-clamp-1 text-[13px] font-medium text-foreground">
                    {mission.title}
                  </span>
                  <span className="flex flex-wrap items-center gap-2">
                    <MissionStatusBadge status={mission.status} />
                    <span className="text-[11px] text-muted-foreground">
                      {new Date(mission.createdAt).toLocaleString()}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {mission.toolCalls.length > 0
                        ? t("historyToolsCount", {
                            count: mission.toolCalls.length,
                          })
                        : t("historyNoTools")}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
