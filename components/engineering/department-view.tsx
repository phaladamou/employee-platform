// components/engineering/department-view.tsx
"use client";

import { ArrowLeftIcon, Code2Icon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import useSWR from "swr";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  getEmployeesByDepartment,
  isGithubCapable,
  type Employee,
} from "@/lib/employees/catalog";
import { fetcher } from "@/lib/utils";
import { EmployeeChat } from "./employee-chat";
import { EmployeeIde } from "./employee-ide";
import { EmployeeMissionHistory } from "./employee-mission-history";
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



function EmployeeListCard({
  employee,
  onOpen,
}: {
  employee: Employee;
  onOpen: () => void;
}) {
  const t = useTranslations("employees");
  return (
    <button
      className="flex flex-col gap-3 rounded-xl border border-border/60 bg-card p-5 text-left shadow-[var(--shadow-card)] transition-colors hover:border-foreground/30"
      data-testid="engineering-employee-card"
      onClick={onOpen}
      type="button"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[15px] font-medium text-foreground">
            {employee.name}
          </p>
          <p className="truncate text-[12px] text-muted-foreground">
            {employee.role}
          </p>
        </div>
        <span
          className={cn(
            "inline-flex shrink-0 items-center rounded-full border px-2.5 py-1 text-[11px] font-medium",
            STATUS_STYLES[employee.status]
          )}
        >
          {t(`status.${employee.status}`)}
        </span>
      </div>
      {employee.currentTask && (
        <p className="line-clamp-2 text-[12.5px] text-muted-foreground">
          {employee.currentTask}
        </p>
      )}
      <span className="text-[12px] font-medium text-foreground/70">
        {t("openWorkspace")}
      </span>
    </button>
  );
}

export function DepartmentView({ departmentId }: { departmentId: string }) {
  const t = useTranslations("employees");
  const { data, error, isLoading, mutate } = useSWR<EmployeesResponse>(
    "/api/employees",
    fetcher,
    { revalidateOnFocus: false }
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTab] = useState<"chat" | "history" | "github">("chat");

  // Meme pattern que la page Employes : noms traduits quand connus,
  // identifiant brut sinon.
  const label =
    departmentId === "engineering"
      ? t("departments.engineering.name")
      : departmentId === "research-data"
        ? t("departments.research-data.name")
        : departmentId === "operations"
          ? t("departments.operations.name")
          : departmentId;
  const members = getEmployeesByDepartment(
    data?.employees ?? [],
    departmentId
  );
  const selected = members.find((item) => item.id === selectedId) ?? null;

  if (selected) {
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
            onClick={() => {
              setSelectedId(null);
              void mutate();
            }}
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
          <div className="min-h-0 flex-1 lg:basis-[60%]">
            <div className="flex h-full min-h-0 flex-col gap-3">
              <div className="flex shrink-0 gap-1 self-start rounded-lg border border-border/60 bg-card p-1">
                {tabs.map((item) => (
                  <button
                    className={cn(
                      "rounded-md px-3 py-1.5 text-[13px] font-medium",
                      tab === item.id
                        ? "bg-foreground text-background"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                    key={item.id}
                    onClick={() => setTab(item.id)}
                    type="button"
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              <div className="min-h-0 flex-1">
                {tab === "github" &&
                isGithubCapable(selected.talentSpec) ? (
                  <GithubMissionPanel
                    employee={selected}
                    key={`github-${selected.id}`}
                  />
                ) : tab === "history" ? (
                  <EmployeeMissionHistory
                    employeeId={selected.id}
                    employeeName={selected.name}
                    key={`history-${selected.id}`}
                  />
                ) : (
                  <EmployeeChat employee={selected} key={selected.id} />
                )}
              </div>
            </div>
          </div>
          <div className="min-h-0 flex-1 lg:basis-[40%]">
            <EmployeeIde employeeId={selected.id} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-dvh w-full flex-col overflow-hidden bg-background">
      <div className="mx-auto w-full max-w-7xl shrink-0 px-8 pt-10 pb-8">
        <div className="flex items-center gap-2.5">
          <Code2Icon className="size-4 text-muted-foreground" />
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {label}
          </h1>
        </div>
        <p className="mt-1.5 text-[13px] text-muted-foreground">
          {t("openHint")}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-7xl px-8 pb-16">
          {isLoading ? (
            <p className="py-16 text-center text-[13px] text-muted-foreground">
              {t("departmentLoading")}
            </p>
          ) : error || !data ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <p className="text-[13px] text-muted-foreground">
                {t("departmentLoadFailed")}
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
          ) : members.length === 0 ? (
            <p className="py-16 text-center text-[13px] text-muted-foreground">
              {t("emptyDepartmentMembers")}
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {members.map((employee) => (
                <EmployeeListCard
                  employee={employee}
                  key={employee.id}
                  onOpen={() => setSelectedId(employee.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
