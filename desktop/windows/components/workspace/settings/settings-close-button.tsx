"use client";

import { X } from "lucide-react";
import { useRouter } from "next/navigation";

export function SettingsCloseButton() {
  const router = useRouter();

  return (
    <button
      className="absolute top-3 right-3 z-10 rounded-full p-1.5 text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100 dark:text-neutral-500 dark:hover:text-neutral-100 dark:hover:bg-neutral-800 transition-colors"
      onClick={() => router.push("/")}
      type="button"
    >
      <X className="size-5" />
    </button>
  );
}
