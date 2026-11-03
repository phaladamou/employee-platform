// components/engineering/employee-ide.tsx
"use client";

import { useMemo, useState } from "react";
import type { BundledLanguage } from "shiki";
import { useTranslations } from "next-intl";
import useSWR from "swr";

import { CodeBlock } from "@/components/ai-elements/code-block";
import { cn } from "@/lib/utils";
import {
  buildFileTree,
  languageForPath,
  parseActivityLog,
  type FileTreeNode,
  type WorkspaceFileEntry,
} from "@/lib/engineering/files";
import { fetcher } from "@/lib/utils";

// Miroir de ACTIVITY_LOG_FILE (core/employee/tools/github.ts) : le
// client ne peut pas importer le module noyau (node:child_process).
const ACTIVITY_LOG_PATH = ".employee-activity.log";

function TreeNode({
  node,
  depth,
  selected,
  onSelect,
}: {
  node: FileTreeNode;
  depth: number;
  selected: string | null;
  onSelect: (path: string) => void;
}) {
  const [open, setOpen] = useState(depth < 2);
  if (node.type === "file") {
    return (
      <button
        className={cn(
          "block w-full truncate rounded px-2 py-1 text-left font-mono text-[12px]",
          selected === node.path
            ? "bg-foreground text-background"
            : "text-muted-foreground hover:bg-muted hover:text-foreground"
        )}
        onClick={() => onSelect(node.path)}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
        type="button"
      >
        {node.name}
      </button>
    );
  }
  return (
    <div>
      <button
        className="block w-full truncate rounded px-2 py-1 text-left font-mono text-[12px] text-foreground/80 hover:bg-muted"
        onClick={() => setOpen((value) => !value)}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
        type="button"
      >
        {open ? "▾" : "▸"} {node.name}
      </button>
      {open &&
        (node.children ?? []).map((child) => (
          <TreeNode
            key={child.path}
            depth={depth + 1}
            node={child}
            onSelect={onSelect}
            selected={selected}
          />
        ))}
    </div>
  );
}

function FileViewer({
  employeeId,
  path,
}: {
  employeeId: string;
  path: string;
}) {
  const t = useTranslations("employees");
  const { data, error, isLoading } = useSWR<{
    path: string;
    content: string;
    truncated: boolean;
  }>(
    `/api/employees/${encodeURIComponent(employeeId)}/files/${path
      .split("/")
      .map(encodeURIComponent)
      .join("/")}`,
    fetcher,
    { revalidateOnFocus: false }
  );

  if (isLoading) {
    return (
      <p className="p-4 text-[12px] text-muted-foreground">
        {t("departmentLoading")}
      </p>
    );
  }
  if (error || !data) {
    return (
      <p className="p-4 text-[12px] text-muted-foreground">
        {t("fileUnreadable")}
      </p>
    );
  }
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {data.truncated && (
        <p className="border-b border-border/60 px-4 py-1.5 text-[11px] text-muted-foreground">
          {t("truncatedPreview")}
        </p>
      )}
      <div className="min-h-0 flex-1 overflow-auto">
        <CodeBlock
          code={data.content || t("emptyFile")}
          language={languageForPath(path) as BundledLanguage}
          showLineNumbers
        />
      </div>
    </div>
  );
}

function ActivityFeed({ employeeId }: { employeeId: string }) {
  const t = useTranslations("employees");
  const { data } = useSWR<{ content: string }>(
    `/api/employees/${encodeURIComponent(employeeId)}/files/${ACTIVITY_LOG_PATH}`,
    fetcher,
    { revalidateOnFocus: false, refreshInterval: 2000 }
  );
  const entries = useMemo(
    () => (data ? parseActivityLog(data.content, 10) : []),
    [data]
  );

  return (
    <div className="max-h-32 shrink-0 overflow-y-auto border-b border-border/60 p-2">
      <p className="px-2 pb-1 text-[11px] font-medium text-foreground">
        {t("activityTitle")}
      </p>
      {entries.length === 0 ? (
        <p className="px-2 py-1 text-[12px] text-muted-foreground">
          {t("activityEmpty")}
        </p>
      ) : (
        entries.map((entry, index) => (
          <p
            className={cn(
              "truncate px-2 py-0.5 font-mono text-[11px]",
              entry.ok ? "text-muted-foreground" : "text-red-600 dark:text-red-400"
            )}
            key={`${index}-${entry.ts}`}
            title={entry.message}
          >
            {entry.message}
          </p>
        ))
      )}
    </div>
  );
}

export function EmployeeIde({ employeeId }: { employeeId: string }) {
  const t = useTranslations("employees");
  const { data, error, isLoading } = useSWR<{ files: WorkspaceFileEntry[] }>(
    `/api/employees/${encodeURIComponent(employeeId)}/files`,
    fetcher,
    { revalidateOnFocus: false, refreshInterval: 4000 }
  );
  const [selected, setSelected] = useState<string | null>(null);

  const tree = useMemo(
    () => buildFileTree(data?.files ?? []),
    [data?.files]
  );
  const active = selected ?? null;

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-border/60 bg-card">
      <div className="border-b border-border/60 px-4 py-3">
        <p className="text-[13px] font-medium text-foreground">Workspace</p>
        <p className="text-[11px] text-muted-foreground">
          {data ? t("filesCount", { count: data.files.length }) : "…"}
        </p>
      </div>

      <ActivityFeed employeeId={employeeId} />

      <div className="max-h-48 shrink-0 overflow-y-auto border-b border-border/60 p-2">
        {isLoading ? (
          <p className="px-2 py-1 text-[12px] text-muted-foreground">
            {t("departmentLoading")}
          </p>
        ) : error ? (
          <p className="px-2 py-1 text-[12px] text-muted-foreground">
            {t("treeUnavailable")}
          </p>
        ) : tree.length === 0 ? (
          <p className="px-2 py-1 text-[12px] text-muted-foreground">
            {t("workspaceEmpty")}
          </p>
        ) : (
          tree.map((node) => (
            <TreeNode
              depth={0}
              key={node.path}
              node={node}
              onSelect={setSelected}
              selected={active}
            />
          ))
        )}
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        {active ? (
          <FileViewer employeeId={employeeId} path={active} />
        ) : (
          <p className="p-4 text-[12px] text-muted-foreground">
            {t("selectFile")}
          </p>
        )}
      </div>
    </div>
  );
}
