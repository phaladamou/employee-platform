// components/workspace/tools/employee-search-tool.tsx
"use client";

import { useTranslations } from "next-intl";

import { EmployeeRecommendationList } from "@/components/workspace/recruit/employee-recommendation-card";
import type { EmployeeSearchResult } from "@/lib/employees/catalog";

type EmployeeSearchPart = {
  toolCallId: string;
  state: string;
  input?: { query?: string };
  output?: {
    query?: string;
    error?: string;
    results?: EmployeeSearchResult[];
    resultCount?: number;
  };
};

function departmentLabel(tEmployees: (key: string) => string, id: string) {
  if (id === "engineering") return tEmployees("departments.engineering.name");
  if (id === "research-data")
    return tEmployees("departments.research-data.name");
  if (id === "operations") return tEmployees("departments.operations.name");
  return id;
}

export function EmployeeSearchTool({ part }: { part: EmployeeSearchPart }) {
  const { toolCallId, state, input } = part;
  const t = useTranslations("recruit");
  const tEmployees = useTranslations("employees");

  if (state === "input-available" || state === "input-streaming") {
    return (
      <div
        className="mb-2 flex w-fit animate-pulse items-center gap-2 rounded-lg border border-border/20 bg-muted/40 px-3 py-1.5 text-xs text-muted-foreground"
        key={toolCallId}
      >
        <div className="size-2 animate-ping rounded-full bg-primary" />
        <span>
          {t("searchingEmployees")}
          {input?.query ? ` · “${input.query}”` : ""}
        </span>
      </div>
    );
  }

  if (state === "output-available" || state === "output-error") {
    const output = part.output;
    if (state === "output-error" || output?.error) {
      return (
        <div className="py-2 text-[13px] text-muted-foreground" key={toolCallId}>
          {t("searchFailed")}
        </div>
      );
    }
    const results = output?.results ?? [];
    if (results.length === 0) {
      return (
        <div className="py-2 text-[13px] text-muted-foreground" key={toolCallId}>
          {t("noResults")}
        </div>
      );
    }
    return (
      <div key={toolCallId}>
        <EmployeeRecommendationList
          departmentLabel={(id) => departmentLabel(tEmployees, id)}
          employees={results}
        />
      </div>
    );
  }

  return null;
}
