// components/engineering/department-view.tsx
"use client";

import { Code2Icon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import useSWR from "swr";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  getEmployeesByDepartment,
  type Employee,
} from "@/lib/employees/catalog";
import {
  buildEmployeeUrl,
  EMPLOYEE_PARAM,
  parseEmployeeParam,
  slugifyEmployeeName,
} from "@/lib/employees/department-url";
import { fetcher } from "@/lib/utils";

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
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data, error, isLoading, mutate } = useSWR<EmployeesResponse>(
    "/api/employees",
    fetcher,
    { revalidateOnFocus: false }
  );

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

  // Compat : l'ancien ?employee=<id> redirige vers l'URL slug.
  useEffect(() => {
    if (!data) {
      return;
    }
    const legacy = parseEmployeeParam(searchParams.get(EMPLOYEE_PARAM));
    if (!legacy) {
      return;
    }
    const found = members.find((item) => item.id === legacy) ?? null;
    if (found) {
      router.replace(
        buildEmployeeUrl(departmentId, slugifyEmployeeName(found.name), null)
      );
    }
  }, [data, members, searchParams, router, departmentId]);

  const openEmployee = (employee: Employee) => {
    router.push(
      buildEmployeeUrl(departmentId, slugifyEmployeeName(employee.name), null)
    );
  };

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
                  onOpen={() => openEmployee(employee)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
