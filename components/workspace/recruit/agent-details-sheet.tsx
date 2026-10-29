// components/workspace/recruit/agent-details-sheet.tsx
"use client";

import * as React from "react";
import { CheckIcon, XIcon } from "lucide-react";
import { Dialog as SheetPrimitive } from "radix-ui";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import type { AvailableAgent } from "@/lib/employees/catalog";

export interface SheetDepartment {
  id: string;
  name: string;
}

/**
 * Contenu de panneau lateral SANS overlay : repris de SheetContent
 * (ui/sheet) en retirant le fond assombrissant/floutant. La page
 * derriere reste visible et interactive.
 */
function SheetContentNoOverlay({
  className,
  children,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Content>) {
  return (
    <SheetPrimitive.Portal>
      <SheetPrimitive.Content
        data-slot="sheet-content"
        data-side="right"
        className={cn(
          "theme-light",
          "fixed z-50 flex flex-col bg-background bg-clip-padding text-sm shadow-2xl data-[side=right]:inset-y-0 data-[side=right]:right-0 data-[side=right]:h-full data-[side=right]:w-[85%] data-[side=right]:border-l data-[side=right]:sm:max-w-sm data-open:animate-in data-open:fade-in-0 data-open:duration-400 data-open:ease-[cubic-bezier(0.32,0.72,0,1)] data-[side=right]:data-open:slide-in-from-right-full data-closed:animate-out data-closed:fade-out-0 data-closed:duration-300 data-closed:ease-[cubic-bezier(0.32,0.72,0,1)] data-[side=right]:data-closed:slide-out-to-right-full",
          className
        )}
        {...props}
      >
        {children}
        <SheetPrimitive.Close data-slot="sheet-close" asChild>
          <Button
            className="absolute top-4 right-4"
            size="icon-sm"
            variant="ghost"
          >
            <XIcon />
            <span className="sr-only">Close</span>
          </Button>
        </SheetPrimitive.Close>
      </SheetPrimitive.Content>
    </SheetPrimitive.Portal>
  );
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function AgentDetailsSheet({
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
  agent: AvailableAgent | null;
  categoryLabel: string;
  departments: SheetDepartment[];
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
    <Sheet
      modal={false}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      open={agent !== null}
    >
      <SheetContentNoOverlay className="w-full overflow-y-auto sm:max-w-xl">
        {agent && (
          <>
            <SheetHeader>
              <div className="flex items-center gap-3">
                <div
                  aria-hidden="true"
                  className="flex size-12 shrink-0 items-center justify-center rounded-full bg-muted text-[15px] font-semibold text-foreground"
                >
                  {getInitials(agent.name)}
                </div>
                <div className="min-w-0 text-left">
                  <SheetTitle>{agent.name}</SheetTitle>
                  <SheetDescription>
                    {agent.role} · {categoryLabel}
                  </SheetDescription>
                </div>
              </div>
            </SheetHeader>

            <div className="mt-4 rounded-xl border border-border/60 bg-card p-5 shadow-[var(--shadow-card)]">
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
                          <SelectItem
                            key={department.id}
                            value={department.id}
                          >
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

            <div className="mt-5">
              <p className="text-[12px] font-medium text-foreground/70">
                {t("details.about")}
              </p>
              <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
                {agent.description}
              </p>
            </div>

            <div className="mt-4">
              <p className="text-[12px] font-medium text-foreground/70">
                {t("details.experience")}
              </p>
              <p className="mt-1 text-[13px] text-muted-foreground">
                {agent.experience}
              </p>
            </div>

            <div className="mt-4">
              <p className="text-[12px] font-medium text-foreground/70">
                {tEmployees("recruit.capabilities")}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
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

          </>
        )}
      </SheetContentNoOverlay>
    </Sheet>
  );
}
