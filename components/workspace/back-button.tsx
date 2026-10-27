// components/workspace/back-button.tsx
"use client";

import { ArrowLeftIcon } from "lucide-react";
import { useRouter } from "next/navigation";

export function BackButton() {
  const router = useRouter();

  return (
    <button
      className="flex items-center gap-2 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
      onClick={() => router.back()}
      type="button"
    >
      <ArrowLeftIcon className="size-3.5" />
      Back
    </button>
  );
}
