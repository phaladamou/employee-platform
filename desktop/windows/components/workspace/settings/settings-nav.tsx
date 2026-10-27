// components/workspace/settings/settings-nav.tsx
"use client";

import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

export function SettingsNav() {
  const t = useTranslations("settings");
  const pathname = usePathname();
  const router = useRouter();
  const activeSection = pathname.split("/").pop() ?? "general";

  const navItems = [
    { id: "general", label: t("general") },
    { id: "engine", label: t("engine") },
    { id: "memory", label: t("memory") },
    { id: "tools", label: t("tools") },
    { id: "security", label: t("security") },
    { id: "billing", label: t("billing") },
  ];

  return (
    <nav className="flex flex-col gap-0.5">
      {navItems.map((item) => (
        <button
          className={`px-3 py-2 rounded-lg text-[15px] font-normal tracking-tight transition-colors text-left ${
            activeSection === item.id
              ? "bg-neutral-100 text-neutral-950 dark:bg-neutral-800 dark:text-neutral-50"
              : "text-neutral-800 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
          }`}
          key={item.id}
          onClick={() => router.push(`/settings/${item.id}`)}
          type="button"
        >
          {item.label}
        </button>
      ))}
    </nav>
  );
}