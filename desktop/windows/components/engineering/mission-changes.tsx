// components/engineering/mission-changes.tsx
"use client";

import { ArrowLeftIcon, FileDiffIcon, FileTextIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { cn } from "@/lib/utils";
import type {
  MissionDiffRow,
  MissionFileChange,
} from "@/lib/employees/mission-events";

function ChangeCounts({ change }: { change: MissionFileChange }) {
  const showAdded = change.added > 0 || change.removed === 0;
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 font-mono text-[11px] tabular-nums">
      {showAdded && (
        <span className="text-emerald-600 dark:text-emerald-400">
          +{change.added}
        </span>
      )}
      {change.removed > 0 && (
        <span className="text-red-600 dark:text-red-400">-{change.removed}</span>
      )}
    </span>
  );
}

function DiffRowView({ row }: { row: MissionDiffRow }) {
  return (
    <div
      className={cn(
        "flex min-w-max items-baseline gap-2 px-2 py-px font-mono text-[11.5px] leading-5",
        row.type === "add" &&
          "bg-emerald-500/10 text-emerald-800 dark:text-emerald-200",
        row.type === "del" && "bg-red-500/10 text-red-800 dark:text-red-200",
        row.type === "same" && "text-muted-foreground"
      )}
    >
      <span className="w-7 shrink-0 select-none text-right text-[10px] opacity-60 tabular-nums">
        {row.oldNo ?? ""}
      </span>
      <span className="w-7 shrink-0 select-none text-right text-[10px] opacity-60 tabular-nums">
        {row.newNo ?? ""}
      </span>
      <span className="w-3 shrink-0 select-none text-center opacity-70">
        {row.type === "add" ? "+" : row.type === "del" ? "-" : " "}
      </span>
      <span className="whitespace-pre">
        {row.text === "" ? " " : row.text}
      </span>
    </div>
  );
}

// Onglet Changes de l'IDE facon Devin : fichiers ecrits par
// l'employe pendant la mission en cours (compteurs +/-, diff au
// clic). Alimente par le flux live partage (aucun polling).
export function MissionChanges({
  changes,
}: {
  changes: MissionFileChange[];
}) {
  const t = useTranslations("employees");
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const selected =
    selectedPath === null
      ? null
      : (changes.find((change) => change.path === selectedPath) ?? null);

  if (changes.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
        <FileDiffIcon className="size-6 text-muted-foreground/60" />
        <p className="max-w-60 text-[12px] leading-relaxed text-muted-foreground">
          {t("changesEmpty")}
        </p>
      </div>
    );
  }

  if (selected) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex items-center gap-2 border-b border-border/60 px-3 py-2">
          <button
            aria-label={t("ideChangesTab")}
            className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            onClick={() => setSelectedPath(null)}
            type="button"
          >
            <ArrowLeftIcon className="size-4" />
          </button>
          <p className="min-w-0 flex-1 truncate font-mono text-[12px] text-foreground">
            {selected.path}
          </p>
          <ChangeCounts change={selected} />
        </div>
        <div className="min-h-0 flex-1 overflow-auto py-1">
          {selected.rows.map((row, index) => (
            <DiffRowView
              key={`${row.type}-${row.oldNo ?? "x"}-${row.newNo ?? "x"}-${index}`}
              row={row}
            />
          ))}
          {selected.truncated && (
            <p className="px-3 py-2 text-[11px] text-muted-foreground">
              {t("changesTruncated")}
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-0.5 overflow-y-auto p-2">
      {changes.map((change) => (
        <button
          className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left hover:bg-muted/70"
          key={change.path}
          onClick={() => setSelectedPath(change.path)}
          type="button"
        >
          <FileTextIcon className="size-4 shrink-0 text-muted-foreground" />
          <span className="min-w-0 flex-1 truncate font-mono text-[12px] text-foreground">
            {change.path}
          </span>
          <ChangeCounts change={change} />
        </button>
      ))}
    </div>
  );
}
