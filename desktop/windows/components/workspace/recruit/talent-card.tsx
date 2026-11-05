// components/workspace/recruit/talent-card.tsx
"use client";

import { CheckIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { TalentProfile } from "@/lib/employees/catalog";

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

const VISIBLE_TECHNOLOGIES = 3;

export function TalentCard({
  talent,
  departmentLabel,
  recruited,
  busy,
  selected,
  onRecruit,
  onSelect,
}: {
  talent: TalentProfile;
  departmentLabel: string;
  recruited: boolean;
  busy: boolean;
  selected?: boolean;
  onRecruit: (spec: string) => void;
  onSelect?: (spec: string) => void;
}) {
  const t = useTranslations("recruit");
  const badges = talent.capabilities ?? talent.technologies;
  const extraTechnologies = badges.length - VISIBLE_TECHNOLOGIES;

  return (
    <div
      className={cn(
        "flex flex-col gap-4 rounded-xl border border-border/60 bg-card p-6 shadow-[var(--shadow-card)]",
        onSelect && "cursor-pointer transition-colors hover:border-foreground/20",
        selected && "border-indigo-600/50 ring-1 ring-indigo-600/30"
      )}
      onClick={onSelect ? () => onSelect(talent.spec) : undefined}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div
            aria-hidden="true"
            className="flex size-12 shrink-0 items-center justify-center rounded-full bg-muted text-[14px] font-semibold text-foreground"
          >
            {getInitials(talent.name)}
          </div>
          <div className="min-w-0">
            <p className="truncate text-[15px] font-medium text-foreground">
              {talent.name}
            </p>
            <p className="truncate text-[12px] text-muted-foreground">
              {talent.role}
            </p>
          </div>
        </div>
        <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground">
          {departmentLabel}
        </span>
      </div>

      <p className="line-clamp-2 text-[13px] leading-relaxed text-muted-foreground">
        {talent.overview ?? talent.background}
      </p>

      <div className="flex flex-wrap gap-1.5">
        {badges.slice(0, VISIBLE_TECHNOLOGIES).map((badge) => (
          <span
            className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground"
            key={badge}
          >
            {badge}
          </span>
        ))}
        {extraTechnologies > 0 && (
          <span className="px-1 py-0.5 text-[11px] text-muted-foreground">
            +{extraTechnologies}
          </span>
        )}
      </div>

      <div className="mt-auto flex items-center gap-2 pt-2">
        {onSelect && (
          <Button
            className="flex-1"
            onClick={(e) => {
              e.stopPropagation();
              onSelect(talent.spec);
            }}
            type="button"
            variant="outline"
          >
            {t("card.viewProfile")}
          </Button>
        )}
        {recruited ? (
          <span className="inline-flex shrink-0 items-center gap-1.5 px-1 text-[12.5px] text-muted-foreground">
            <CheckIcon className="size-4" />
            {t("card.recruited")}
          </span>
        ) : (
          <Button
            className="flex-1"
            disabled={busy}
            onClick={(e) => {
              e.stopPropagation();
              onRecruit(talent.spec);
            }}
            type="button"
            variant="brand"
          >
            {t("card.recruitAction")}
          </Button>
        )}
      </div>
    </div>
  );
}
