// components/engineering/departments-list.tsx
"use client";

import {
  ArrowRightIcon,
  BarChart3Icon,
  Building2Icon,
  CogIcon,
  ListChecksIcon,
} from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import useSWR from "swr";

import {
  getEmployeesByDepartment,
  type Employee,
} from "@/lib/employees/catalog";
import { visibleDepartments } from "@/lib/employees/departments";
import { fetcher } from "@/lib/utils";

type EmployeesResponse = {
  departments: string[];
  employees: Employee[];
};

const DEPARTMENT_ICONS: Record<string, typeof CogIcon> = {
  engineering: CogIcon,
  "research-data": BarChart3Icon,
  operations: ListChecksIcon,
};

function initials(name: string): string {
  return name.trim().slice(0, 2).toUpperCase() || "?";
}

export function DepartmentsList() {
  const t = useTranslations("employees");
  const { data, error, isLoading } = useSWR<EmployeesResponse>(
    "/api/employees",
    fetcher,
    { revalidateOnFocus: false }
  );

  // Meme pattern que la page Employes : traductions quand connues,
  // repli neutre sinon.
  const departmentName = (id: string) =>
    id === "engineering"
      ? t("departments.engineering.name")
      : id === "research-data"
        ? t("departments.research-data.name")
        : id === "operations"
          ? t("departments.operations.name")
          : id;

  const departmentDescription = (id: string) =>
    id === "engineering"
      ? t("departments.engineering.description")
      : id === "research-data"
        ? t("departments.research-data.description")
        : id === "operations"
          ? t("departments.operations.description")
          : "";

  if (isLoading) {
    return (
      <div className="flex h-dvh w-full flex-col overflow-hidden bg-background">
        <p className="m-auto text-[13px] text-muted-foreground">
          {t("departmentLoading")}
        </p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex h-dvh w-full flex-col overflow-hidden bg-background">
        <p className="m-auto text-[13px] text-muted-foreground">
          {t("departmentLoadFailed")}
        </p>
      </div>
    );
  }

  const departments = visibleDepartments(data.departments);

  return (
    <div className="flex h-dvh w-full flex-col overflow-hidden bg-background">
      <div className="mx-auto w-full max-w-7xl shrink-0 px-8 pt-10 pb-8">
        <div className="flex items-center gap-2.5">
          <Building2Icon className="size-4 text-muted-foreground" />
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {t("departmentsTitle")}
          </h1>
        </div>
        <p className="mt-1.5 text-[13px] text-muted-foreground">
          {t("departmentsSubtitle")}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-7xl px-8 pb-16">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {departments.map((departmentId) => {
              const members = getEmployeesByDepartment(
                data.employees,
                departmentId
              );
              const Icon = DEPARTMENT_ICONS[departmentId] ?? Building2Icon;
              const description = departmentDescription(departmentId);
              return (
                <Link
                  className="flex flex-col gap-3 rounded-xl border border-border/60 bg-card p-5 shadow-[var(--shadow-card)] transition-colors hover:border-foreground/30"
                  href={`/departments/${encodeURIComponent(departmentId)}`}
                  key={departmentId}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className="size-4 shrink-0 text-muted-foreground" />
                    <span className="truncate text-[15px] font-medium text-foreground">
                      {departmentName(departmentId)}
                    </span>
                  </div>
                  {description ? (
                    <p className="text-[13px] leading-relaxed text-muted-foreground">
                      {description}
                    </p>
                  ) : null}
                  <div className="flex min-h-6 items-center gap-2">
                    {members.length > 0 ? (
                      <>
                        <span className="flex shrink-0">
                          {members.slice(0, 5).map((member, index) => (
                            <span
                              className="flex size-6 items-center justify-center rounded-full bg-muted text-[10px] font-medium text-muted-foreground ring-1 ring-border first:ml-0 -ml-1.5"
                              key={member.id}
                              style={{ zIndex: 5 - index }}
                              title={member.name}
                            >
                              {initials(member.name)}
                            </span>
                          ))}
                        </span>
                        <span className="truncate text-[12px] text-muted-foreground">
                          {members
                            .slice(0, 4)
                            .map((member) => member.name)
                            .join(" · ")}
                          {members.length > 4
                            ? ` · +${members.length - 4}`
                            : ""}
                        </span>
                      </>
                    ) : (
                      <span className="text-[12px] text-muted-foreground">
                        {t("emptyDepartment")}
                      </span>
                    )}
                  </div>
                  <div className="mt-auto flex items-center justify-between pt-1">
                    <span className="text-[12px] text-muted-foreground">
                      {t("memberCount", { count: members.length })}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[12px] font-medium text-foreground">
                      {t("viewDepartment")}
                      <ArrowRightIcon className="size-3.5" />
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
