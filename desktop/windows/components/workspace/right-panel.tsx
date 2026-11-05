// components/workspace/right-panel.tsx
"use client";

import { motion } from "framer-motion";
import { XIcon } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import useSWR from "swr";
import { Button } from "@/components/ui/button";
import { fetcher } from "@/lib/utils";

interface PanelEmployee {
  id: string;
  name: string;
  role: string;
  status: string;
}

interface PanelMission {
  id: string;
  title: string;
  status: string;
  report: string | null;
  updatedAt: string;
  employeeId: string;
  employeeName: string;
}

const EMPLOYEE_DOT: Record<string, string> = {
  idle: "bg-zinc-400",
  working: "bg-green-500",
  completed: "bg-blue-500",
};

const MISSION_DOT: Record<string, string> = {
  queued: "bg-amber-500",
  running: "bg-blue-500",
  succeeded: "bg-green-500",
  failed: "bg-red-500",
  needs_review: "bg-amber-500",
};

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-[13px] font-semibold text-foreground">{children}</h3>
  );
}

function LoadingRows() {
  return (
    <div className="space-y-2">
      {[0, 1, 2].map((index) => (
        <div
          className="h-9 animate-pulse rounded-lg bg-muted/60"
          key={index}
        />
      ))}
    </div>
  );
}

// Panneau lateral droit : equipe + missions en cours + derniers
// rapports du compte.
export function RightPanel({ onClose }: { onClose: () => void }) {
  const t = useTranslations("chat");
  const { data: team } = useSWR<{ employees: PanelEmployee[] }>(
    "/api/employees",
    fetcher
  );
  const { data: missions } = useSWR<{ missions: PanelMission[] }>(
    "/api/missions",
    fetcher,
    { refreshInterval: 15000 }
  );

  const employees = team?.employees ?? null;
  const allMissions = missions?.missions ?? null;
  const active =
    allMissions?.filter(
      (mission) => mission.status === "queued" || mission.status === "running"
    ) ?? null;
  const reported =
    allMissions
      ?.filter((mission) => mission.report && mission.report.trim())
      .slice(0, 5) ?? null;

  return (
    <motion.aside
      animate={{ x: 0 }}
      className="fixed inset-y-0 right-0 z-40 flex w-80 max-w-[85vw] flex-col border-l border-border/60 bg-white shadow-xl dark:bg-background"
      initial={{ x: 320 }}
      transition={{ type: "tween", duration: 0.2, ease: "easeOut" }}
    >
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-border/40 px-4">
        <span className="text-sm font-semibold text-foreground">
          {t("panelTitle")}
        </span>
        <Button onClick={onClose} size="icon-sm" variant="ghost">
          <XIcon className="size-4" />
        </Button>
      </div>

      <div className="flex-1 space-y-6 overflow-y-auto p-4">
        <section className="space-y-2.5">
          <div className="flex items-center justify-between">
            <SectionTitle>{t("panelMembers")}</SectionTitle>
            <Link
              className="text-xs text-muted-foreground transition-colors hover:text-foreground"
              href="/employees"
            >
              {t("panelViewAll")}
            </Link>
          </div>
          {!employees ? (
            <LoadingRows />
          ) : employees.length === 0 ? (
            <div className="space-y-2">
              <p className="text-[13px] text-muted-foreground">
                {t("panelEmptyTeam")}
              </p>
              <Link
                className="inline-block text-[13px] font-medium text-blue-600 hover:underline dark:text-blue-400"
                href="/employees/recruit"
              >
                {t("panelRecruitCta")}
              </Link>
            </div>
          ) : (
            <ul className="space-y-1">
              {employees.map((employee) => (
                <li
                  className="flex items-center gap-2.5 rounded-lg px-2 py-1.5"
                  key={employee.id}
                >
                  <span
                    className={`size-2 shrink-0 rounded-full ${EMPLOYEE_DOT[employee.status] ?? "bg-zinc-400"}`}
                  />
                  <span className="min-w-0 flex-1 truncate text-[13px] text-foreground">
                    {employee.name}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {employee.role}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="space-y-2.5">
          <SectionTitle>{t("panelInProgress")}</SectionTitle>
          {!active ? (
            <LoadingRows />
          ) : active.length === 0 ? (
            <p className="text-[13px] text-muted-foreground">
              {t("panelEmptyMissions")}
            </p>
          ) : (
            <ul className="space-y-1">
              {active.map((mission) => (
                <li
                  className="rounded-lg px-2 py-1.5"
                  key={mission.id}
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`size-2 shrink-0 rounded-full ${MISSION_DOT[mission.status] ?? "bg-zinc-400"} ${mission.status === "running" ? "animate-pulse" : ""}`}
                    />
                    <span className="min-w-0 flex-1 truncate text-[13px] text-foreground">
                      {mission.title}
                    </span>
                  </div>
                  <p className="truncate pl-[18px] text-xs text-muted-foreground">
                    {mission.employeeName}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="space-y-2.5">
          <SectionTitle>{t("panelReports")}</SectionTitle>
          {!reported ? (
            <LoadingRows />
          ) : reported.length === 0 ? (
            <p className="text-[13px] text-muted-foreground">
              {t("panelEmptyReports")}
            </p>
          ) : (
            <ul className="space-y-3">
              {reported.map((mission) => (
                <li className="px-2" key={mission.id}>
                  <p className="truncate text-[13px] font-medium text-foreground">
                    {mission.title}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {mission.employeeName}
                  </p>
                  <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                    {mission.report}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </motion.aside>
  );
}
