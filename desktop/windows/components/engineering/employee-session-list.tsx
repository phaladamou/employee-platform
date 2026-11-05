// components/engineering/employee-session-list.tsx
"use client";

import { PlusIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import useSWR from "swr";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { fetcher } from "@/lib/utils";

export interface EmployeeSessionRow {
  id: string;
  title: string;
  preview: string;
  createdAt: string;
  lastActiveAt: string;
}

export function EmployeeSessionList({
  employeeId,
  activeSessionId,
  refreshKey,
  onSelect,
  onNew,
}: {
  employeeId: string;
  activeSessionId: string | null;
  refreshKey: number;
  onSelect: (sessionId: string) => void;
  onNew: () => void;
}) {
  const t = useTranslations("employees");
  const { data, isLoading } = useSWR<{ sessions: EmployeeSessionRow[] }>(
    [
      `/api/employees/${encodeURIComponent(employeeId)}/sessions`,
      refreshKey,
    ],
    ([url]: [string, number]) => fetcher(url),
    { revalidateOnFocus: false }
  );
  const sessions = data?.sessions ?? [];

  return (
    <div className="flex h-full min-h-0 flex-col rounded-xl border border-border/60 bg-card">
      <div className="border-b border-border/60 px-3 py-2.5">
        <p className="mb-2 truncate px-1 text-[12px] font-medium text-muted-foreground">
          {t("sessionsTitle")}
        </p>
        <Button
          className="w-full justify-start"
          onClick={onNew}
          size="sm"
          type="button"
          variant="outline"
        >
          <PlusIcon className="size-4" />
          {t("newSession")}
        </Button>
      </div>
      <div className="flex min-h-0 flex-1 gap-1 overflow-x-auto p-2 md:flex-col md:overflow-x-hidden md:overflow-y-auto">
        {isLoading ? (
          <p className="px-2 py-1 text-[12px] text-muted-foreground">
            {t("historyLoading")}
          </p>
        ) : (
          sessions.map((item) => {
            const active = item.id === activeSessionId;
            return (
              <button
                className={cn(
                  "flex w-44 shrink-0 flex-col gap-0.5 rounded-lg border p-2 text-left transition-colors md:w-full",
                  active
                    ? "border-foreground/30 bg-muted"
                    : "border-transparent hover:border-border/60 hover:bg-muted/50"
                )}
                key={item.id}
                onClick={() => onSelect(item.id)}
                type="button"
              >
                <span className="line-clamp-1 text-[12.5px] font-medium text-foreground">
                  {item.title || t("sessionUntitled")}
                </span>
                <span className="line-clamp-1 text-[11px] text-muted-foreground">
                  {item.preview ||
                    new Date(item.createdAt).toLocaleDateString()}
                </span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
