// components/billing/test-mode-badge.tsx
"use client";

import { FlaskConicalIcon } from "lucide-react";
import { useTranslations } from "next-intl";

export function TestModeBadge() {
  const t = useTranslations("billing");
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[11px] font-medium text-amber-700 dark:text-amber-400">
      <FlaskConicalIcon className="size-3.5" />
      {t("testMode")}
    </span>
  );
}
