// components/workspace/employees/recruit-dialog.tsx
"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AVAILABLE_AGENTS } from "@/lib/employees/catalog";

export interface RecruitDepartment {
  id: string;
  name: string;
}

export function RecruitDialog({
  open,
  onOpenChange,
  departments,
  defaultDepartmentId,
  onRecruit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  departments: RecruitDepartment[];
  defaultDepartmentId: string;
  onRecruit: (agentId: string, departmentId: string) => void;
}) {
  const t = useTranslations("employees");
  const [selection, setSelection] = useState<Record<string, string>>({});

  const departmentFor = (agentId: string) =>
    selection[agentId] ?? defaultDepartmentId;

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="max-h-[85dvh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("recruit.title")}</DialogTitle>
          <DialogDescription>{t("recruit.description")}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          {AVAILABLE_AGENTS.map((agent) => (
            <div
              className="flex flex-col gap-3 rounded-xl border border-border/60 p-4 sm:flex-row sm:items-center sm:justify-between"
              key={agent.id}
            >
              <div className="min-w-0">
                <p className="text-[14px] font-medium text-foreground">
                  {agent.name}
                  <span className="ml-2 text-[12px] font-normal text-muted-foreground">
                    {agent.role}
                  </span>
                </p>
                <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">
                  {agent.description}
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {agent.capabilities.map((capability) => (
                    <span
                      className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground"
                      key={capability}
                    >
                      {capability}
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2 sm:flex-col sm:items-stretch">
                <Select
                  onValueChange={(value) =>
                    setSelection((prev) => ({ ...prev, [agent.id]: value }))
                  }
                  value={departmentFor(agent.id)}
                >
                  <SelectTrigger
                    aria-label={t("recruit.departmentLabel")}
                    className="w-36"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.map((department) => (
                      <SelectItem key={department.id} value={department.id}>
                        {department.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  onClick={() =>
                    onRecruit(agent.id, departmentFor(agent.id))
                  }
                  size="sm"
                  type="button"
                >
                  {t("recruit.recruitAction")}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
