// components/engineering/employee-workspace.tsx
"use client";

import { ArrowLeftIcon, Code2Icon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import useSWR from "swr";

import { cn } from "@/lib/utils";
import {
  getEmployeesByDepartment,
  isGithubCapable,
  type Employee,
} from "@/lib/employees/catalog";
import {
  buildEmployeeUrl,
  resolveEmployeeSlug,
  slugifyEmployeeName,
} from "@/lib/employees/department-url";
import { fetcher } from "@/lib/utils";
import { EmployeeChat } from "./employee-chat";
import { EmployeeIde } from "./employee-ide";
import { EmployeeMissionHistory } from "./employee-mission-history";
import { EmployeeSessionList } from "./employee-session-list";
import { useMissionStream } from "./use-mission-stream";
import { GithubMissionPanel } from "./github-mission-panel";

type EmployeesResponse = {
  departments: string[];
  employees: Employee[];
};

const STATUS_STYLES: Record<Employee["status"], string> = {
  idle: "border-border bg-muted/50 text-muted-foreground",
  working: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700",
  completed: "border-sky-500/30 bg-sky-500/10 text-sky-700",
};

export function EmployeeWorkspaceView({
  departmentId,
  employeeSlug,
  sessionId,
}: {
  departmentId: string;
  employeeSlug: string;
  sessionId: string | null;
}) {
  const t = useTranslations("employees");
  const router = useRouter();
  const { data, isLoading } = useSWR<EmployeesResponse>(
    "/api/employees",
    fetcher,
    { revalidateOnFocus: false }
  );
  const [tab, setTab] = useState<"chat" | "history" | "github">("chat");
  const [sessionsVersion, setSessionsVersion] = useState(0);
  // Bumpé par "New session" : remonte les onglets (discussion
  // vierge), meme quand l'URL ne change pas (deja sans session).
  const [newVersion, setNewVersion] = useState(0);

  const members = getEmployeesByDepartment(
    data?.employees ?? [],
    departmentId
  );
  const selected = resolveEmployeeSlug(members, employeeSlug);

  // Slug inconnu : retour a la liste (une fois charge).
  useEffect(() => {
    if (!isLoading && data && !selected) {
      router.replace(`/departments/${encodeURIComponent(departmentId)}`);
    }
  }, [isLoading, data, selected, router, departmentId]);

  // Callbacks avant le retour anticipe (regles des hooks) : slug
  // vide tant que l'employe n'est pas resolu (inutilise alors).
  const slug = selected ? slugifyEmployeeName(selected.name) : "";
  const goSession = useCallback(
    (nextId: string | null, replace: boolean) => {
      if (nextId === sessionId) {
        return;
      }
      const url = buildEmployeeUrl(departmentId, slug, nextId);
      if (replace) {
        router.replace(url);
      } else {
        router.push(url);
      }
    },
    [departmentId, slug, sessionId, router]
  );
  // Stables : le chat s'y abonne dans son effet d'historique, une
  // identite neuve a chaque rendu rechargerait pour rien.
  const handleSessionResolved = useCallback(
    (nextId: string) => {
      setSessionsVersion((value) => value + 1);
      goSession(nextId, true);
    },
    [goSession]
  );
  // Envoi echoue : le message est peut-etre quand meme en base
  // (session orpheline) → la liste des sessions se rafraichit.
  const handleFailedSend = useCallback(() => {
    setSessionsVersion((value) => value + 1);
  }, []);
  const handleNew = useCallback(() => {
    setNewVersion((value) => value + 1);
    goSession(null, false);
  }, [goSession]);
  // Une seule mission a la fois par employe : le flux est partage
  // entre la discussion, le panneau GitHub et l'onglet Changes de
  // l'IDE (timeline + fichiers en temps reel, meme source).
  const mission = useMissionStream();

  if (!selected) {
    return (
      <div className="flex h-dvh w-full flex-col overflow-hidden bg-background">
        <p className="mx-auto w-full max-w-7xl px-8 py-16 text-center text-[13px] text-muted-foreground">
          {t("departmentLoading")}
        </p>
      </div>
    );
  }
  const tabs: Array<{
    id: "chat" | "history" | "github";
    label: string;
  }> = [
    { id: "chat", label: t("chatTab") },
    { id: "history", label: t("historyTab") },
    ...(isGithubCapable(selected.talentSpec)
      ? [{ id: "github" as const, label: t("githubTab") }]
      : []),
  ];

  return (
    <div className="flex h-dvh w-full flex-col overflow-hidden bg-background">
      <div className="mx-auto w-full max-w-7xl shrink-0 px-8 pt-6 pb-4">
        <button
          className="mb-3 flex items-center gap-1.5 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
          onClick={() =>
            router.push(`/departments/${encodeURIComponent(departmentId)}`)
          }
          type="button"
        >
          <ArrowLeftIcon className="size-4" />
          {t("backToList")}
        </button>
        <div className="flex items-center gap-2.5">
          <Code2Icon className="size-4 text-muted-foreground" />
          <h1 className="text-[17px] font-semibold tracking-tight text-foreground">
            {selected.name} — Workspace
          </h1>
          <span
            className={cn(
              "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium",
              STATUS_STYLES[selected.status]
            )}
          >
            {t(`status.${selected.status}`)}
          </span>
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-7xl min-h-0 flex-1 flex-col gap-4 px-8 pb-8 lg:flex-row">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 lg:basis-[60%] lg:min-w-[40%] lg:flex-row">
          <div className="shrink-0 lg:w-52">
            <EmployeeSessionList
              activeSessionId={sessionId}
              employeeId={selected.id}
              onNew={handleNew}
              onSelect={(nextId) => goSession(nextId, false)}
              refreshKey={sessionsVersion}
            />
          </div>
          <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3">
            <div className="flex shrink-0 gap-1 self-start rounded-lg border border-border/60 bg-card p-1">
              {tabs.map((item) => (
                <button
                  className={cn(
                    "rounded-md px-3 py-1.5 text-[13px] font-medium",
                    tab === item.id
                      ? "bg-foreground text-background"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                  data-testid={`workspace-tab-${item.id}`}
                  key={item.id}
                  onClick={() => setTab(item.id)}
                  type="button"
                >
                  {item.label}
                </button>
              ))}
            </div>
            {/* Onglets toujours montes, inactifs masques : changer
                d'onglet ne detruit plus la discussion (message en
                cours, mission live) ni ne recommence les chargements. */}
            <div className="min-h-0 flex-1">
              <div className={cn("h-full min-h-0", tab !== "chat" && "hidden")}>
                <EmployeeChat
                  employee={selected}
                  key={`chat-${selected.id}-${newVersion}`}
                  mission={mission}
                  onFailedSend={handleFailedSend}
                  onSessionResolved={handleSessionResolved}
                  sessionId={sessionId}
                />
              </div>
              <div
                className={cn("h-full min-h-0", tab !== "history" && "hidden")}
              >
                <EmployeeMissionHistory
                  employeeId={selected.id}
                  employeeName={selected.name}
                  key={`history-${selected.id}-${newVersion}`}
                />
              </div>
              {isGithubCapable(selected.talentSpec) && (
                <div
                  className={cn(
                    "h-full min-h-0",
                    tab !== "github" && "hidden"
                  )}
                >
                  <GithubMissionPanel
                    employee={selected}
                    key={`github-${selected.id}-${newVersion}`}
                    mission={mission}
                    onFailedSend={handleFailedSend}
                    onSessionResolved={handleSessionResolved}
                    sessionId={sessionId}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="min-h-0 min-w-0 flex-1 lg:basis-[40%]">
          <EmployeeIde
            employeeId={selected.id}
            key={`ide-${selected.id}-${newVersion}`}
            missionProgress={mission.progress}
          />
        </div>
      </div>
    </div>
  );
}
