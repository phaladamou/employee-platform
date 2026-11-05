// components/workspace/recruit/employee-recommendation-card.tsx
// Template partage des cartes de recommandation du Chef dans le chat.
// Meme langage visuel que TalentCard (Talent Network) en version compacte :
// avatar, nom, role, departement, pitch, competences, bouton "Voir la fiche"
// vers /employees/recruit?talent=<spec> + badge "Recrute" si deja recrute.
// Le Chef choisit qui afficher via l'outil searchEmployees (query + limit) :
// chaque resultat renvoye devient une carte rendue par ce template.
"use client";

import { CheckIcon } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import type { EmployeeSearchResult } from "@/lib/employees/catalog";

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function EmployeeRecommendationCard({
  employee,
  departmentLabel,
  whyFit,
}: {
  employee: EmployeeSearchResult;
  departmentLabel: string;
  whyFit?: string | null;
}) {
  const t = useTranslations("recruit");

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border/60 bg-card p-4 shadow-[var(--shadow-card)]">
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
        <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground">
          {departmentLabel}
        </span>
      </div>

      <p className="line-clamp-2 text-[13px] leading-relaxed text-muted-foreground">
        {employee.pitch}
      </p>

      {whyFit?.trim() ? (
        <p className="text-[13px] leading-relaxed text-foreground">
          {whyFit}
        </p>
      ) : null}

      {employee.skills.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {employee.skills.map((skill) => (
            <span
              className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground"
              key={skill}
            >
              {skill}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2 pt-1">
        <Button asChild size="sm" variant="outline">
          <Link
            href={`/employees/recruit?talent=${encodeURIComponent(employee.spec)}`}
          >
            {t("card.viewProfile")}
          </Link>
        </Button>
        {employee.hired && (
          <span className="inline-flex shrink-0 items-center gap-1.5 px-1 text-[12.5px] text-muted-foreground">
            <CheckIcon className="size-4" />
            {t("card.recruited")}
          </span>
        )}
      </div>
    </div>
  );
}

export function EmployeeRecommendationList({
  employees,
  departmentLabel,
}: {
  employees: EmployeeSearchResult[];
  departmentLabel: (departmentId: string) => string;
}) {
  return (
    <div className="flex w-[min(100%,560px)] flex-col gap-3 py-1">
      {employees.map((employee) => (
        <EmployeeRecommendationCard
          departmentLabel={departmentLabel(employee.departmentId)}
          employee={employee}
          key={employee.spec}
        />
      ))}
    </div>
  );
}
