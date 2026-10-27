// app/(chat)/not-found.tsx
"use client";

import { useTranslations } from "next-intl";
import { ErrorPage } from "@/components/workspace/error-page";

export default function NotFound() {
  const t = useTranslations("errors");

  return (
    <ErrorPage
      code="404"
      description={t("notFoundDescription")}
      title={t("notFoundTitle")}
    />
  );
}
