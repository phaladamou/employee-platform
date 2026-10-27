// app/error.tsx
"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { ErrorPage } from "@/components/workspace/error-page";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("errors");

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <ErrorPage
      code="500"
      description={t("serverErrorDescription")}
      onRetry={reset}
      title={t("serverErrorTitle")}
    />
  );
}
