// components/workspace/error-page.tsx
"use client";

import { ArrowLeftIcon, HomeIcon, RefreshCwIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

export function ErrorPage({
  code,
  title,
  description,
  onRetry,
}: {
  code: string;
  title: string;
  description: string;
  onRetry?: () => void;
}) {
  const router = useRouter();
  const t = useTranslations("errors");

  return (
    <div className="flex min-h-dvh w-full items-center justify-center bg-background px-6">
      <div className="flex w-full max-w-md flex-col items-center text-center">
        <span className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground/60">
          {code}
        </span>

        <h1 className="mt-3 text-[22px] font-medium tracking-tight text-foreground">
          {title}
        </h1>

        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          {description}
        </p>

        <div className="mt-8 flex flex-col gap-2 sm:flex-row">
          <Button
            className="h-9 gap-1.5 rounded-lg px-3.5 text-[13px]"
            onClick={() => router.back()}
            variant="outline"
          >
            <ArrowLeftIcon className="size-3.5" />
            {t("back")}
          </Button>

          <Button
            className="h-9 gap-1.5 rounded-lg px-3.5 text-[13px]"
            onClick={() => router.push("/workspace")}
          >
            <HomeIcon className="size-3.5" />
            {t("home")}
          </Button>

          {onRetry && (
            <Button
              className="h-9 gap-1.5 rounded-lg px-3.5 text-[13px]"
              onClick={onRetry}
              variant="outline"
            >
              <RefreshCwIcon className="size-3.5" />
              {t("retry")}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
