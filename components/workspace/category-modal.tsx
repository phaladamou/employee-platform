// components/workspace/category-modal.tsx
"use client";

import { XIcon } from "lucide-react";
import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

export function CategoryModal({
  label,
  title,
  prompts,
  promptKeys,
  onSelect,
  onClose,
}: {
  label: string;
  title: string;
  prompts: string[];
  promptKeys: string[];
  onSelect: (prompt: string) => void;
  onClose: () => void;
}) {
  const t = useTranslations("chat");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-md"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="relative aspect-square w-full max-w-xl max-h-[70vh] rounded-2xl border border-border/60 bg-card p-6 shadow-[var(--shadow-float)]"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <button
          aria-label="Close"
          className="absolute top-4 right-4 flex size-7 items-center justify-center rounded-full text-muted-foreground/60 transition-colors hover:bg-muted/60 hover:text-foreground"
          onClick={onClose}
          type="button"
        >
          <XIcon className="size-4" />
        </button>

        <h2 className="mb-6 pr-10 text-lg font-semibold text-foreground">
          {title}
        </h2>

        <div className="flex flex-col gap-1">
          {promptKeys.map((key, index) => (
            <button
              className={cn(
                "flex w-full items-center rounded-lg px-3 py-2.5 text-left",
                "text-[13px] text-foreground/90 transition-colors",
                "hover:bg-muted/50"
              )}
              key={key}
              onClick={() => onSelect(prompts[index] ?? t(key))}
              type="button"
            >
              {t(key)}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
