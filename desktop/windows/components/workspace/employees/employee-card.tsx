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
    pill: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    dot: "border-transparent bg-emerald-500 motion-safe:animate-pulse",
  },
  completed: {
    pill: "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300",
    dot: "border-transparent bg-sky-500",
  },
};

export function EmployeeCard({ employee }: { employee: Employee }) {
  const t = useTranslations("employees");
  const styles = STATUS_STYLES[employee.status];
  const statusLabel =
    employee.status === "idle"
      ? t("status.idle")
      : employee.status === "working"
        ? t("status.working")
        : t("status.completed");

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border/60 bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div
            aria-hidden="true"
            className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-[13px] font-semibold text-foreground"
          >
            {getInitials(employee.name)}
          </div>
          <div className="min-w-0">
            <p className="truncate text-[14px] font-medium text-foreground">
              {employee.name}
            </p>
            <p className="truncate text-[12px] text-muted-foreground">
              {employee.role}
            </p>
          </div>
        </div>
        <span
          className={cn(
            "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium",
            styles.pill
          )}
        >
          <span className={cn("size-1.5 rounded-full border", styles.dot)} />
          {statusLabel}
        </span>
      </div>

      {employee.status === "working" && employee.currentTask && (
        <p className="text-[12px] leading-relaxed text-muted-foreground">
          <span className="font-medium text-foreground/70">
            {t("card.currentTask")}:{" "}
          </span>
          {employee.currentTask}
        </p>
      )}
    </div>
  );
}
