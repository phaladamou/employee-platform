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

import { Button } from "@/components/ui/button";
import { EmployeeCard } from "@/components/workspace/employees/employee-card";
import {
  RecruitDialog,
  type RecruitDepartment,
} from "@/components/workspace/employees/recruit-dialog";
import {
  AVAILABLE_AGENTS,
  DEPARTMENTS,
  EMPLOYEES,
  getEmployeesByDepartment,
  recruitEmployee,
  type Employee,
} from "@/lib/employees/catalog";

const DEPARTMENT_ICONS: Record<string, LucideIcon> = {
  engineering: Code2Icon,
  marketing: MegaphoneIcon,
  research: FlaskConicalIcon,
};

export default function EmployeesPage() {
  const t = useTranslations("employees");
  const router = useRouter();
  const [employees, setEmployees] = useState<Employee[]>(EMPLOYEES);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [defaultDepartmentId, setDefaultDepartmentId] = useState(
    DEPARTMENTS[0]?.id ?? "engineering"
  );

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

  const departmentOptions: RecruitDepartment[] = DEPARTMENTS.map((d) => ({
    id: d.id,
    name: departmentName(d.id),
  }));

  const openRecruitDialog = (departmentId: string) => {
    setDefaultDepartmentId(departmentId);
    setDialogOpen(true);
  };

  const handleRecruit = (agentId: string, departmentId: string) => {
    const agent = AVAILABLE_AGENTS.find((a) => a.id === agentId);
    if (!agent) return;
    setEmployees((prev) =>
      recruitEmployee(prev, agent, departmentId, crypto.randomUUID())
    );
    setDialogOpen(false);
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
            onClick={() =>
              openRecruitDialog(DEPARTMENTS[0]?.id ?? "engineering")
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
          {DEPARTMENTS.map((department) => {
            const members = getEmployeesByDepartment(
              employees,
              department.id
            );
            const Icon = DEPARTMENT_ICONS[department.id] ?? Code2Icon;
            return (
              <section key={department.id}>
                <div className="flex items-center gap-2.5">
                  <Icon className="size-4 text-muted-foreground" />
                  <h2 className="text-[16px] font-semibold tracking-tight text-foreground">
                    {departmentName(department.id)}
                  </h2>
                  <span className="text-[12px] text-muted-foreground">
                    · {t("memberCount", { count: members.length })}
                  </span>
                </div>
                <p className="mt-1 text-[13px] text-muted-foreground">
                  {departmentDescription(department.id)}
                </p>

                {members.length === 0 ? (
                  <div className="mt-4 flex items-center justify-between gap-4 rounded-xl border border-dashed border-border p-4">
                    <p className="text-[13px] text-muted-foreground">
                      {t("emptyDepartment")}
                    </p>
                    <Button
                      onClick={() => openRecruitDialog(department.id)}
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
          })}
        </div>
      </div>

      {dialogOpen && (
        <RecruitDialog
          defaultDepartmentId={defaultDepartmentId}
          departments={departmentOptions}
          onOpenChange={setDialogOpen}
          onRecruit={handleRecruit}
          open={dialogOpen}
        />
      )}
    </div>
  );
}
