// components/workspace/recruit/talent-details-panel.tsx
"use client";

import { CheckIcon, XIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import type { TalentProfile } from "@/lib/employees/catalog";

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function TalentDetailsPanel({
  talent,
  departmentName,
  onRecruit,
  onViewDepartment,
  recruited,
  busy,
  error,
  onClose,
}: {
  talent: TalentProfile;
  departmentName: string;
  onRecruit: (spec: string) => void;
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
            {getInitials(talent.name)}
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-[20px] font-semibold tracking-tight text-foreground">
              {talent.name}
            </h2>
            <p className="mt-0.5 truncate text-[13px] text-muted-foreground">
              {talent.role} · {departmentName}
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
            <div className="mt-3">
              <Button
                className="w-full"
                disabled={busy}
                onClick={() => onRecruit(talent.spec)}
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
          {talent.background}
        </p>
      </div>

      <div>
        <p className="text-[12px] font-medium text-foreground/70">
          {tEmployees("recruit.capabilities")}
        </p>
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {talent.technologies.map((technology) => (
            <span
              className="rounded-full bg-muted px-2.5 py-1 text-[12px] text-muted-foreground"
              key={technology}
            >
              {technology}
            </span>
          ))}
        </div>
      </div>

      <div>
        <p className="text-[12px] font-medium text-foreground/70">
          {t("details.tools")}
        </p>
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {talent.tools.map((tool) => (
            <span
              className="rounded-md border border-border px-2 py-1 font-mono text-[11.5px] text-muted-foreground"
              key={tool}
            >
              {tool}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
