// app/(chat)/employees/page.tsx
"use client";

import {
  ArrowLeftIcon,
  Code2Icon,
  FlaskConicalIcon,
  MegaphoneIcon,
  PlusIcon,
} from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type { LucideIcon } from "lucide-react";
import useSWR from "swr";

import { Button } from "@/components/ui/button";
import { EmployeeCard } from "@/components/workspace/employees/employee-card";
import {
  RecruitDialog,
  type RecruitDepartment,
} from "@/components/workspace/employees/recruit-dialog";
import {
  DEPARTMENTS,
  getEmployeesByDepartment,
  type Employee,
} from "@/lib/employees/catalog";
import { fetcher } from "@/lib/utils";

type EmployeesResponse = {
  departments: string[];
  employees: Employee[];
};

const DEPARTMENT_ICONS: Record<string, LucideIcon> = {
  engineering: Code2Icon,
  marketing: MegaphoneIcon,
  research: FlaskConicalIcon,
};

export default function EmployeesPage() {
  const t = useTranslations("employees");
  const tAuth = useTranslations("auth");
  const tErr = useTranslations("auth.errors");
  const tErrors = useTranslations("errors");
  const router = useRouter();

  const { data, error, isLoading, mutate } = useSWR<EmployeesResponse>(
    "/api/employees",
    fetcher,
    { revalidateOnFocus: false }
  );

  const [dialogOpen, setDialogOpen] = useState(false);
  const [defaultDepartmentId, setDefaultDepartmentId] = useState(
    DEPARTMENTS[0]?.id ?? "engineering"
  );
  const [recruitError, setRecruitError] = useState<string | null>(null);
  const [recruiting, setRecruiting] = useState(false);

  const departmentIds = data?.departments ?? [];
  const employees = data?.employees ?? [];

  const departmentName = (id: string) =>
    id === "engineering"
      ? t("departments.engineering.name")
      : id === "marketing"
        ? t("departments.marketing.name")
        : t("departments.research.name");

  const departmentDescription = (id: string) =>
    id === "engineering"
      ? t("departments.engineering.description")
      : id === "marketing"
        ? t("departments.marketing.description")
        : t("departments.research.description");

  const departmentOptions: RecruitDepartment[] = departmentIds.map((id) => ({
    id,
    name: departmentName(id),
  }));

  const openRecruitDialog = (departmentId: string) => {
    setRecruitError(null);
    setDefaultDepartmentId(departmentId);
    setDialogOpen(true);
  };

  const handleRecruit = async (agentId: string, departmentId: string) => {
    setRecruiting(true);
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
      await mutate();
      setDialogOpen(false);
    } catch {
      setRecruitError(tErr("network_error"));
    } finally {
      setRecruiting(false);
    }
  };

  return (
    <div className="flex h-dvh w-full flex-col overflow-hidden bg-white dark:bg-background">
      <div className="mx-auto w-full max-w-5xl shrink-0 px-6 pt-8 pb-6">
        <button
          className="mb-4 flex items-center gap-1.5 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
          onClick={() => router.back()}
          type="button"
        >
          <ArrowLeftIcon className="size-4" />
          {t("back")}
        </button>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              {t("title")}
            </h1>
            <p className="mt-1 text-[13px] text-muted-foreground">
              {t("subtitle")}
            </p>
          </div>
          <Button
            disabled={isLoading || !data}
            onClick={() =>
              openRecruitDialog(departmentIds[0] ?? "engineering")
            }
            type="button"
          >
            <PlusIcon className="size-4" />
            {t("recruitButton")}
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-6 pb-12">
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
          ) : (
            departmentIds.map((departmentId) => {
              const members = getEmployeesByDepartment(
                employees,
                departmentId
              );
              const Icon = DEPARTMENT_ICONS[departmentId] ?? Code2Icon;
              return (
                <section key={departmentId}>
                  <div className="flex items-center gap-2.5">
                    <Icon className="size-4 text-muted-foreground" />
                    <h2 className="text-[16px] font-semibold tracking-tight text-foreground">
                      {departmentName(departmentId)}
                    </h2>
                    <span className="text-[12px] text-muted-foreground">
                      · {t("memberCount", { count: members.length })}
                    </span>
                  </div>
                  <p className="mt-1 text-[13px] text-muted-foreground">
                    {departmentDescription(departmentId)}
                  </p>

                  {members.length === 0 ? (
                    <div className="mt-4 flex items-center justify-between gap-4 rounded-xl border border-dashed border-border p-4">
                      <p className="text-[13px] text-muted-foreground">
                        {t("emptyDepartment")}
                      </p>
                      <Button
                        onClick={() => openRecruitDialog(departmentId)}
                        size="sm"
                        type="button"
                        variant="outline"
                      >
                        {t("recruitHere")}
                      </Button>
                    </div>
                  ) : (
                    <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                      {members.map((employee) => (
                        <EmployeeCard employee={employee} key={employee.id} />
                      ))}
                    </div>
                  )}
                </section>
              );
            })
          )}
        </div>
      </div>

      {dialogOpen && (
        <RecruitDialog
          busy={recruiting}
          defaultDepartmentId={defaultDepartmentId}
          departments={departmentOptions}
          error={recruitError}
          onOpenChange={setDialogOpen}
          onRecruit={handleRecruit}
          open={dialogOpen}
        />
      )}
    </div>
  );
}
