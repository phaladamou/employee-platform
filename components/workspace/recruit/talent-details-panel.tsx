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

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[12px] font-medium text-foreground/70">{children}</p>
  );
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="mt-1.5 list-disc space-y-1.5 pl-5 text-[13.5px] leading-relaxed text-muted-foreground">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
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
  const capabilities = talent.capabilities ?? talent.technologies;
  const environment = talent.executionEnvironment;

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
        <SectionTitle>
          {talent.overview ? t("details.overview") : t("details.about")}
        </SectionTitle>
        <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted-foreground">
          {talent.overview ?? talent.background}
        </p>
      </div>

      {talent.responsibilities && talent.responsibilities.length > 0 && (
        <div>
          <SectionTitle>{t("details.responsibilities")}</SectionTitle>
          <BulletList items={talent.responsibilities} />
        </div>
      )}

      {capabilities.length > 0 && (
        <div>
          <SectionTitle>{tEmployees("recruit.capabilities")}</SectionTitle>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {capabilities.map((capability) => (
              <span
                className="rounded-full bg-muted px-2.5 py-1 text-[12px] text-muted-foreground"
                key={capability}
              >
                {capability}
              </span>
            ))}
          </div>
        </div>
      )}

      {talent.toolDetails && talent.toolDetails.length > 0 ? (
        <div>
          <SectionTitle>{t("details.tools")}</SectionTitle>
          <div className="mt-2.5 flex flex-col gap-3">
            {talent.toolDetails.map((tool) => (
              <div key={tool.name}>
                <p className="font-mono text-[12px] text-foreground">
                  {tool.name}
                </p>
                <p className="mt-0.5 text-[12.5px] leading-relaxed text-muted-foreground">
                  {tool.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : (
        talent.tools.length > 0 && (
          <div>
            <SectionTitle>{t("details.tools")}</SectionTitle>
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
        )
      )}

      {environment && (
        <div>
          <SectionTitle>{t("details.executionEnvironment")}</SectionTitle>
          {typeof environment === "string" ? (
            <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted-foreground">
              {environment}
            </p>
          ) : (
            <BulletList items={environment} />
          )}
        </div>
      )}

      {talent.boundaries && talent.boundaries.length > 0 && (
        <div>
          <SectionTitle>{t("details.boundaries")}</SectionTitle>
          <BulletList items={talent.boundaries} />
        </div>
      )}

      {talent.deliverables && talent.deliverables.length > 0 && (
        <div>
          <SectionTitle>{t("details.deliverables")}</SectionTitle>
          <BulletList items={talent.deliverables} />
        </div>
      )}

      {talent.verification && (
        <div>
          <SectionTitle>{t("details.verification")}</SectionTitle>
          <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted-foreground">
            {talent.verification}
          </p>
        </div>
      )}
    </div>
  );
}
