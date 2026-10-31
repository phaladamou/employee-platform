// components/workspace/employees/employee-card.tsx
"use client";

import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";
import type { Employee, EmployeeStatus } from "@/lib/employees/catalog";

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

const STATUS_STYLES: Record<
  EmployeeStatus,
  { pill: string; dot: string }
> = {
  idle: {
    pill: "border-border bg-muted/50 text-muted-foreground",
    dot: "border-muted-foreground/50 bg-transparent",
  },
  working: {
    pill: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700",
    dot: "border-transparent bg-emerald-500 motion-safe:animate-pulse",
  },
  completed: {
    pill: "border-sky-500/30 bg-sky-500/10 text-sky-700",
    dot: "border-transparent bg-sky-500",
  },
};

const VISIBLE_TECHNOLOGIES = 3;

export function EmployeeCard({ employee }: { employee: Employee }) {
  const t = useTranslations("employees");
  const styles = STATUS_STYLES[employee.status];
  const statusLabel =
    employee.status === "idle"
      ? t("status.idle")
      : employee.status === "working"
        ? t("status.working")
        : t("status.completed");
  const technologies = employee.technologies ?? [];
  const extraTechnologies = technologies.length - VISIBLE_TECHNOLOGIES;

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border/60 bg-card p-6 shadow-[var(--shadow-card)]">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div
            aria-hidden="true"
            className="flex size-11 shrink-0 items-center justify-center rounded-full bg-muted text-[13px] font-semibold text-foreground"
          >
            {getInitials(employee.name)}
          </div>
          <div className="min-w-0">
            <p className="truncate text-[15px] font-medium text-foreground">
              {employee.name}
            </p>
            <p className="truncate text-[12px] text-muted-foreground">
              {employee.role}
            </p>
            {employee.kind === "chef" && (
              <span className="mt-1 inline-block rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground">
                {t("card.chef")}
              </span>
            )}
          </div>
        </div>
        <span
          className={cn(
            "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium",
            styles.pill
          )}
        >
          <span className={cn("size-1.5 rounded-full border", styles.dot)} />
          {statusLabel}
        </span>
      </div>

      {employee.background && (
        <p className="line-clamp-2 text-[12.5px] leading-relaxed text-muted-foreground">
          {employee.background}
        </p>
      )}

      {technologies.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {technologies.slice(0, VISIBLE_TECHNOLOGIES).map((technology) => (
            <span
              className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground"
              key={technology}
            >
              {technology}
            </span>
          ))}
          {extraTechnologies > 0 && (
            <span className="px-1 py-0.5 text-[11px] text-muted-foreground">
              +{extraTechnologies}
            </span>
          )}
        </div>
      )}

      {employee.status === "working" && employee.currentTask && (
        <p className="text-[12.5px] leading-relaxed text-muted-foreground">
          <span className="font-medium text-foreground/70">
            {t("card.currentTask")}:{" "}
          </span>
          {employee.currentTask}
        </p>
      )}
    </div>
  );
}
