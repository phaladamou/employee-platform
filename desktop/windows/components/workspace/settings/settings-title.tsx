// components/workspace/settings/settings-title.tsx
"use client";

import { useTranslations } from "next-intl";

export function SettingsTitle() {
  const t = useTranslations("settings");
  return (
    <h2 className="mb-6 text-[14px] font-bold uppercase tracking-[0.15em] text-neutral-400 dark:text-neutral-500">
      {t("title")}
    </h2>
  );
}