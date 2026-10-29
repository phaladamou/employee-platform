// desktop/windows/app/(chat)/employees/recruit/page.tsx
"use client";

import { ArrowLeftIcon, SearchIcon } from "lucide-react";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import useSWR from "swr";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AgentCard } from "@/components/workspace/recruit/agent-card";
import {
  AgentDetailsPanel,
  type PanelDepartment,
} from "@/components/workspace/recruit/agent-details-panel";
import {
  AGENT_CATEGORIES,
  AVAILABLE_AGENTS,
  DEPARTMENTS,
  filterAgents,
  type AgentCategory,
} from "@/lib/employees/catalog";
import { cn, fetcher } from "@/lib/utils";

type EmployeesResponse = {
  departments: string[];
};

function categoryLabel(
  t: (key: string) => string,
  category: AgentCategory
): string {
  if (category === "development") return t("categories.development");
  if (category === "research") return t("categories.research");
  if (category === "data") return t("categories.data");
  if (category === "design") return t("categories.design");
  return t("categories.operations");
}

export default function RecruitPage() {
  return (
    <Suspense>
      <RecruitPageContent />
    </Suspense>
  );
}

function RecruitPageContent() {
  const t = useTranslations("recruit");
  const tEmployees = useTranslations("employees");
  const tErr = useTranslations("auth.errors");
  const router = useRouter();
  const searchParams = useSearchParams();

  const { data } = useSWR<EmployeesResponse>("/api/employees", fetcher, {
    revalidateOnFocus: false,
  });
  const departmentIds = data?.departments ?? DEPARTMENTS.map((d) => d.id);

  const departmentName = (id: string) =>
    id === "engineering"
      ? tEmployees("departments.engineering.name")
      : id === "marketing"
        ? tEmployees("departments.marketing.name")
        : tEmployees("departments.research.name");

  const departmentOptions: PanelDepartment[] = departmentIds.map((id) => ({
    id,
    name: departmentName(id),
  }));

  const requestedDepartment = searchParams.get("department");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<AgentCategory | "all">("all");
  const [targetDepartmentId, setTargetDepartmentId] = useState(
    requestedDepartment && departmentIds.includes(requestedDepartment)
      ? requestedDepartment
      : (DEPARTMENTS[0]?.id ?? "engineering")
  );
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [recruitedIds, setRecruitedIds] = useState<Set<string>>(new Set());
  const [busyId, setBusyId] = useState<string | null>(null);
  const [recruitError, setRecruitError] = useState<string | null>(null);

  const visibleAgents = filterAgents(AVAILABLE_AGENTS, query, category);
  const selectedAgent =
    AVAILABLE_AGENTS.find((a) => a.id === selectedAgentId) ?? null;

  const handleRecruit = async (agentId: string, departmentId: string) => {
    setBusyId(agentId);
    setRecruitError(null);
    try {
      const res = await fetch("/api/employees/recruit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ agentId, departmentId }),
      });
      if (!res.ok) {
        throw new Error(`recruit failed: HTTP ${res.status}`);
      }
      setRecruitedIds((prev) => new Set(prev).add(agentId));
    } catch {
      setRecruitError(tErr("network_error"));
    } finally {
      setBusyId(null);
    }
  };

  const clearFilters = () => {
    setQuery("");
    setCategory("all");
  };

  return (
    <div className="theme-light relative flex h-dvh w-full flex-col overflow-hidden bg-background lg:flex-row">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="mx-auto w-full max-w-7xl shrink-0 px-8 pt-10 pb-8">
          <button
            className="mb-5 flex items-center gap-1.5 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
            onClick={() => router.push("/employees")}
            type="button"
          >
            <ArrowLeftIcon className="size-4" />
            {t("back")}
          </button>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {t("title")}
          </h1>
          <p className="mt-1.5 text-[13px] text-muted-foreground">
            {t("subtitle")}
          </p>

          <div className="mt-6 flex flex-col gap-4">
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="relative flex-1">
                <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-9"
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t("searchPlaceholder")}
                  type="search"
                  value={query}
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="shrink-0 text-[12.5px] text-muted-foreground">
                  {t("targetLabel")} :
                </span>
                <Select
                  onValueChange={setTargetDepartmentId}
                  value={targetDepartmentId}
                >
                  <SelectTrigger aria-label={t("targetLabel")} className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="theme-light">
                    {departmentOptions.map((department) => (
                      <SelectItem key={department.id} value={department.id}>
                        {department.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                className={cn(
                  "rounded-full border px-3.5 py-1.5 text-[12.5px] transition-colors",
                  category === "all"
                    ? "border-indigo-600 bg-indigo-600 text-white"
                    : "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground"
                )}
                onClick={() => setCategory("all")}
                type="button"
              >
                {t("allCategories")}
              </button>
              {AGENT_CATEGORIES.map((c) => (
                <button
                  className={cn(
                    "rounded-full border px-3.5 py-1.5 text-[12.5px] transition-colors",
                    category === c
                      ? "border-indigo-600 bg-indigo-600 text-white"
                      : "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground"
                  )}
                  key={c}
                  onClick={() => setCategory(c)}
                  type="button"
                >
                  {categoryLabel(t, c)}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="scrollbar-none mx-auto min-h-0 w-full max-w-7xl flex-1 overflow-y-auto px-8 pb-16">
          {visibleAgents.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <p className="text-[13px] text-muted-foreground">
                {t("noResults")}
              </p>
              <Button
                onClick={clearFilters}
                size="sm"
                type="button"
                variant="outline"
              >
                {t("clearFilters")}
              </Button>
            </div>
          ) : (
            <div
              className={cn(
                "grid grid-cols-1 gap-6 sm:grid-cols-2",
                selectedAgent ? "lg:grid-cols-2" : "lg:grid-cols-3"
              )}
            >
              {visibleAgents.map((agent) => (
                <AgentCard
                  agent={agent}
                  busy={busyId === agent.id}
                  categoryLabel={categoryLabel(t, agent.category)}
                  key={agent.id}
                  onRecruit={(agentId) =>
                    handleRecruit(agentId, targetDepartmentId)
                  }
                  onSelect={setSelectedAgentId}
                  recruited={recruitedIds.has(agent.id)}
                  selected={selectedAgentId === agent.id}
                />
              ))}
            </div>
          )}
          {recruitError && (
            <p className="mt-4 text-center text-[12.5px] text-destructive">
              {recruitError}
            </p>
          )}
        </div>
      </div>

      {selectedAgent && (
        <aside className="scrollbar-none absolute inset-0 overflow-y-auto bg-card lg:static lg:w-[38%] lg:flex-none lg:border-l lg:border-border/60">
          <AgentDetailsPanel
            agent={selectedAgent}
            busy={busyId === selectedAgent?.id}
            categoryLabel={
              selectedAgent ? categoryLabel(t, selectedAgent.category) : ""
            }
            departments={departmentOptions}
            error={recruitError}
            onClose={() => {
              setSelectedAgentId(null);
              setRecruitError(null);
            }}
            onRecruit={handleRecruit}
            onTargetChange={setTargetDepartmentId}
            onViewDepartment={() => router.push("/employees")}
            recruited={
              selectedAgent ? recruitedIds.has(selectedAgent.id) : false
            }
            targetDepartmentId={targetDepartmentId}
          />
        </aside>
      )}
    </div>
  );
}
