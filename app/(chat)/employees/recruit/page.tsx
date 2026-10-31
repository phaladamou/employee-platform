// app/(chat)/employees/recruit/page.tsx
"use client";

import { ArrowLeftIcon, SearchIcon } from "lucide-react";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import useSWR from "swr";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TalentCard } from "@/components/workspace/recruit/talent-card";
import { TalentDetailsPanel } from "@/components/workspace/recruit/talent-details-panel";
import { filterTalents, type TalentProfile } from "@/lib/employees/catalog";
import { cn, fetcher } from "@/lib/utils";

type TalentsResponse = {
  talents: TalentProfile[];
};

function departmentName(
  tEmployees: (key: string) => string,
  id: string
): string {
  if (id === "engineering") return tEmployees("departments.engineering.name");
  if (id === "research-data")
    return tEmployees("departments.research-data.name");
  if (id === "operations") return tEmployees("departments.operations.name");
  return id;
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
  const tAuth = useTranslations("auth");
  const tErr = useTranslations("auth.errors");
  const tErrors = useTranslations("errors");
  const router = useRouter();
  const searchParams = useSearchParams();

  const { data, error, isLoading, mutate } = useSWR<TalentsResponse>(
    "/api/talents",
    fetcher,
    { revalidateOnFocus: false }
  );
  const talents = data?.talents ?? [];
  const departmentIds = [...new Set(talents.map((t) => t.departmentId))].sort();

  const [query, setQuery] = useState("");
  const paramDepartment = searchParams.get("department");
  const [departmentFilter, setDepartmentFilter] = useState<string | "all">(
    paramDepartment ?? "all"
  );
  // Navigation interne (meme page, params differents) : le useState
  // initial ne se rejoue pas, on resynchronise explicitement.
  useEffect(() => {
    setDepartmentFilter(paramDepartment ?? "all");
  }, [paramDepartment]);
  const effectiveDepartment =
    departmentFilter === "all" || departmentIds.includes(departmentFilter)
      ? departmentFilter
      : "all";
  const [selectedSpec, setSelectedSpec] = useState<string | null>(null);
  const [recruitedSpecs, setRecruitedSpecs] = useState<Set<string>>(new Set());
  const [busySpec, setBusySpec] = useState<string | null>(null);
  const [recruitError, setRecruitError] = useState<string | null>(null);

  const visibleTalents = filterTalents(talents, query, effectiveDepartment);
  const selectedTalent =
    talents.find((talent) => talent.spec === selectedSpec) ?? null;

  const isRecruited = (talent: TalentProfile) =>
    talent.hired === true || recruitedSpecs.has(talent.spec);

  const handleRecruit = async (spec: string) => {
    setBusySpec(spec);
    setRecruitError(null);
    try {
      const res = await fetch("/api/employees/recruit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ talentSpec: spec }),
      });
      if (res.status === 409) {
        // Deja recrute (double-clic, autre onglet) : etat final coherent.
        setRecruitedSpecs((prev) => new Set(prev).add(spec));
        return;
      }
      if (!res.ok) {
        throw new Error(`recruit failed: HTTP ${res.status}`);
      }
      setRecruitedSpecs((prev) => new Set(prev).add(spec));
    } catch {
      setRecruitError(tErr("network_error"));
    } finally {
      setBusySpec(null);
    }
  };

  const clearFilters = () => {
    setQuery("");
    setDepartmentFilter("all");
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
            <div className="relative">
              <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("searchPlaceholder")}
                type="search"
                value={query}
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                className={cn(
                  "rounded-full border px-3.5 py-1.5 text-[12.5px] transition-colors",
                  effectiveDepartment === "all"
                    ? "border-indigo-600 bg-indigo-600 text-white"
                    : "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground"
                )}
                onClick={() => setDepartmentFilter("all")}
                type="button"
              >
                {t("allDepartments")}
              </button>
              {departmentIds.map((id) => (
                <button
                  className={cn(
                    "rounded-full border px-3.5 py-1.5 text-[12.5px] transition-colors",
                    effectiveDepartment === id
                      ? "border-indigo-600 bg-indigo-600 text-white"
                      : "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground"
                  )}
                  key={id}
                  onClick={() => setDepartmentFilter(id)}
                  type="button"
                >
                  {departmentName(tEmployees, id)}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="scrollbar-none mx-auto min-h-0 w-full max-w-7xl flex-1 overflow-y-auto px-8 pb-16">
          {isLoading ? (
            <p className="py-16 text-center text-[13px] text-muted-foreground">
              {tAuth("pleaseWait")}
            </p>
          ) : error || !data ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <p className="text-[13px] text-muted-foreground">
                {tErr("network_error")}
              </p>
              <Button
                onClick={() => mutate()}
                size="sm"
                type="button"
                variant="outline"
              >
                {tErrors("retry")}
              </Button>
            </div>
          ) : visibleTalents.length === 0 ? (
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
                selectedTalent ? "lg:grid-cols-2" : "lg:grid-cols-3"
              )}
            >
              {visibleTalents.map((talent) => (
                <TalentCard
                  busy={busySpec === talent.spec}
                  departmentLabel={departmentName(
                    tEmployees,
                    talent.departmentId
                  )}
                  key={talent.spec}
                  onRecruit={handleRecruit}
                  onSelect={setSelectedSpec}
                  recruited={isRecruited(talent)}
                  selected={selectedSpec === talent.spec}
                  talent={talent}
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

      {selectedTalent && (
        <aside className="scrollbar-none absolute inset-0 overflow-y-auto bg-card lg:static lg:w-[38%] lg:flex-none lg:border-l lg:border-border/60">
          <TalentDetailsPanel
            busy={busySpec === selectedTalent?.spec}
            departmentName={departmentName(
              tEmployees,
              selectedTalent.departmentId
            )}
            error={recruitError}
            onClose={() => {
              setSelectedSpec(null);
              setRecruitError(null);
            }}
            onRecruit={handleRecruit}
            onViewDepartment={() => router.push("/employees")}
            recruited={isRecruited(selectedTalent)}
            talent={selectedTalent}
          />
        </aside>
      )}
    </div>
  );
}
