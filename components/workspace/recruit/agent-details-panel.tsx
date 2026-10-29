// components/workspace/recruit/agent-details-panel.tsx
"use client";

import { CheckIcon, XIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { AvailableAgent } from "@/lib/employees/catalog";

export interface PanelDepartment {
  id: string;
  name: string;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function AgentDetailsPanel({
  agent,
  categoryLabel,
  departments,
  targetDepartmentId,
  onTargetChange,
  onRecruit,
  onViewDepartment,
  recruited,
  busy,
  error,
  onClose,
}: {
  agent: AvailableAgent;
  categoryLabel: string;
  departments: PanelDepartment[];
  targetDepartmentId: string;
  onTargetChange: (departmentId: string) => void;
  onRecruit: (agentId: string, departmentId: string) => void;
  onViewDepartment: () => void;
  recruited: boolean;
  busy: boolean;
  error: string | null;
  onClose: () => void;
}) {
  const t = useTranslations("recruit");
  const tEmployees = useTranslations("employees");

  return (
    <div className="flex min-h-full flex-col gap-8 p-10">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          <div
            aria-hidden="true"
            className="flex size-14 shrink-0 items-center justify-center rounded-full bg-muted text-[16px] font-semibold text-foreground"
          >
            {getInitials(agent.name)}
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-[20px] font-semibold tracking-tight text-foreground">
              {agent.name}
            </h2>
            <p className="mt-0.5 truncate text-[13px] text-muted-foreground">
              {agent.role} · {categoryLabel}
            </p>
          </div>
        </div>
        <Button
          className="shrink-0"
          onClick={onClose}
          size="icon-sm"
          type="button"
          variant="ghost"
        >
          <XIcon />
          <span className="sr-only">Close</span>
        </Button>
      </div>

      <div className="rounded-xl border border-border/60 bg-muted/40 p-5">
        <p className="text-[13px] font-medium text-foreground">
          {t("details.recruitTitle")}
        </p>
        {recruited ? (
          <div className="mt-3 flex flex-col gap-2">
            <p className="flex items-center gap-1.5 text-[12.5px] text-emerald-600">
              <CheckIcon className="size-4" />
              {t("card.recruited")}
            </p>
            <Button
              onClick={onViewDepartment}
              size="sm"
              type="button"
              variant="outline"
            >
              {t("details.viewInDepartment")}
            </Button>
          </div>
        ) : (
          <>
            <div className="mt-3 flex gap-2">
              <Select
                disabled={busy}
                onValueChange={onTargetChange}
                value={targetDepartmentId}
              >
                <SelectTrigger
                  aria-label={t("targetLabel")}
                  className="flex-1"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="theme-light">
                  {departments.map((department) => (
                    <SelectItem key={department.id} value={department.id}>
                      {department.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                disabled={busy}
                onClick={() => onRecruit(agent.id, targetDepartmentId)}
                size="sm"
                type="button"
                variant="brand"
              >
                {t("card.recruitAction")}
              </Button>
            </div>
            {error && (
              <p className="mt-2 text-[12px] text-destructive">{error}</p>
            )}
          </>
        )}
      </div>

      <div>
        <p className="text-[12px] font-medium text-foreground/70">
          {t("details.about")}
        </p>
        <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted-foreground">
          {agent.description}
        </p>
      </div>

      <div>
        <p className="text-[12px] font-medium text-foreground/70">
          {t("details.experience")}
        </p>
        <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted-foreground">
          {agent.experience}
        </p>
      </div>

      <div>
        <p className="text-[12px] font-medium text-foreground/70">
          {tEmployees("recruit.capabilities")}
        </p>
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {agent.capabilities.map((capability) => (
            <span
              className="rounded-full bg-muted px-2.5 py-1 text-[12px] text-muted-foreground"
              key={capability}
            >
              {capability}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
