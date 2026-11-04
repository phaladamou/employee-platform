// components/engineering/employee-ide.tsx
"use client";

import {
  ActivityIcon,
  FileDiffIcon,
  FilesIcon,
  TerminalIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";
import type { BundledLanguage } from "shiki";
import useSWR from "swr";

import { CodeBlock } from "@/components/ai-elements/code-block";
import { cn } from "@/lib/utils";
import { toolLabel, type MissionProgressState } from "@/lib/employees/mission-events";
import { MissionChanges } from "./mission-changes";
import {
  buildFileTree,
  extractShellCommand,
  formatActivityTime,
  languageForPath,
  liveActivityEntries,
  parseActivityLog,
  type ActivityEntry,
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

function useActivityEntries(employeeId: string) {
  const { data } = useSWR<{ content: string }>(
    `/api/employees/${encodeURIComponent(employeeId)}/files/${ACTIVITY_LOG_PATH}`,
    fetcher,
    { revalidateOnFocus: false, refreshInterval: 2000 }
  );
  return useMemo(
    () => (data ? parseActivityLog(data.content, 60) : []),
    [data]
  );
}

// Reste colle en bas quand l'utilisateur y est deja (n'arrache
// jamais la lecture d'une ligne superieure).
function useStickToBottom(count: number) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) {
      return;
    }
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 80) {
      el.scrollTop = el.scrollHeight;
    }
  }, [count]);
  return ref;
}

// Journal chronologique structure : heure, pastille d'outil,
// message, etat. Les entrees live (run en cours, meme source que
// la timeline) pulsent et affichent "live" au lieu de l'heure.
function ActivityTab({ entries }: { entries: ActivityEntry[] }) {
  const t = useTranslations("employees");
  const scroller = useStickToBottom(entries.length);

  if (entries.length === 0) {
    return (
      <p className="p-4 text-[12px] text-muted-foreground">
        {t("activityEmpty")}
      </p>
    );
  }
  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-2" ref={scroller}>
      {entries.map((entry, index) => (
        <div
          className="flex items-center gap-2 rounded-md px-2 py-1"
          key={`${index}-${entry.ts}`}
          title={entry.thinking ? t("missionThinking") : entry.message}
        >
          <span
            aria-hidden="true"
            className={cn(
              "size-1.5 shrink-0 rounded-full",
              entry.ok ? "bg-emerald-500" : "bg-red-500",
              entry.live && "animate-pulse"
            )}
          />
          <span
            className={cn(
              "shrink-0 font-mono text-[10.5px] tabular-nums",
              entry.live
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-muted-foreground"
            )}
          >
            {entry.live ? t("activityLive") : formatActivityTime(entry.ts)}
          </span>
          {entry.tool && (
            <span className="shrink-0 rounded border border-border px-1 font-mono text-[10px] text-muted-foreground">
              {toolLabel(entry.tool)}
            </span>
          )}
          <span
            className={cn(
              "min-w-0 flex-1 truncate text-[12px]",
              entry.ok
                ? "text-foreground"
                : "text-red-600 dark:text-red-400"
            )}
          >
            {entry.thinking ? t("missionThinking") : entry.message}
          </span>
        </div>
      ))}
    </div>
  );
}

// Commandes executees (run_shell), ordre chronologique. Les sorties
// stdout/stderr ne sortent pas du moteur : cet onglet liste les
// commandes, pas leurs sorties (phase moteur ulterieure).
function TerminalTab({ entries }: { entries: ActivityEntry[] }) {
  const t = useTranslations("employees");
  const commands = useMemo(
    () =>
      entries
        .filter((entry) => entry.tool === "run_shell")
        .map((entry) => ({
          ts: entry.ts,
          command: extractShellCommand(entry.message) ?? entry.message,
        })),
    [entries]
  );
  const scroller = useStickToBottom(commands.length);

  if (commands.length === 0) {
    return (
      <p className="p-4 text-[12px] text-muted-foreground">
        {t("terminalEmpty")}
      </p>
    );
  }
  return (
    <div
      className="min-h-0 flex-1 overflow-y-auto bg-zinc-950 p-3 dark:bg-black"
      ref={scroller}
    >
      {commands.map((line, index) => (
        <div
          className="flex items-baseline gap-2 py-0.5 font-mono text-[11.5px]"
          key={`${index}-${line.ts}`}
        >
          <span className="shrink-0 select-none text-[10px] text-zinc-500 tabular-nums">
            {formatActivityTime(line.ts)}
          </span>
          <span className="shrink-0 select-none text-emerald-400">$</span>
          <span className="min-w-0 flex-1 break-all text-zinc-100">
            {line.command}
          </span>
        </div>
      ))}
    </div>
  );
}

export function EmployeeIde({
  employeeId,
  missionProgress,
}: {
  employeeId: string;
  missionProgress: MissionProgressState;
}) {
  const t = useTranslations("employees");
  const { data, error, isLoading } = useSWR<{ files: WorkspaceFileEntry[] }>(
    `/api/employees/${encodeURIComponent(employeeId)}/files`,
    fetcher,
    { revalidateOnFocus: false, refreshInterval: 4000 }
  );
  const [selected, setSelected] = useState<string | null>(null);
  const [ideTab, setIdeTab] = useState<
    "files" | "changes" | "activity" | "terminal"
  >("files");
  const fileEntries = useActivityEntries(employeeId);
  // Run en cours (ou termine) : l'onglet Activity suit le live
  // (meme source que la timeline, zero delai de poll) ; sinon il
  // retombe sur le journal fichier. Le Terminal reste sur le
  // fichier : le texte des commandes n'existe que dans le journal.
  const liveEntries = useMemo(
    () => liveActivityEntries(missionProgress),
    [missionProgress]
  );
  const activityEntries =
    liveEntries.length > 0 ? liveEntries : fileEntries;

  const tree = useMemo(
    () => buildFileTree(data?.files ?? []),
    [data?.files]
  );
  const active = selected ?? null;

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-border/60 bg-card">
      <div className="flex items-center gap-1 overflow-x-auto border-b border-border/60 px-2 py-2">
        <button
          className={cn(
            "inline-flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12.5px] font-medium",
            ideTab === "files"
              ? "bg-muted text-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
          onClick={() => setIdeTab("files")}
          type="button"
        >
          <FilesIcon className="size-3.5" />
          {t("ideFilesTab")}
        </button>
        <button
          className={cn(
            "inline-flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12.5px] font-medium",
            ideTab === "changes"
              ? "bg-muted text-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
          onClick={() => setIdeTab("changes")}
          type="button"
        >
          <FileDiffIcon className="size-3.5" />
          {t("ideChangesTab")}
          {missionProgress.changes.length > 0 && (
            <span className="rounded-full bg-primary/15 px-1.5 py-px font-mono text-[10px] tabular-nums text-primary">
              {missionProgress.changes.length}
            </span>
          )}
        </button>
        <button
          className={cn(
            "inline-flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12.5px] font-medium",
            ideTab === "activity"
              ? "bg-muted text-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
          onClick={() => setIdeTab("activity")}
          type="button"
        >
          <ActivityIcon className="size-3.5" />
          {t("activityTitle")}
          {liveEntries.length > 0 && (
            <span
              aria-hidden="true"
              className="size-1.5 shrink-0 animate-pulse rounded-full bg-emerald-500"
            />
          )}
        </button>
        <button
          className={cn(
            "inline-flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12.5px] font-medium",
            ideTab === "terminal"
              ? "bg-muted text-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
          onClick={() => setIdeTab("terminal")}
          type="button"
        >
          <TerminalIcon className="size-3.5" />
          {t("ideTerminalTab")}
        </button>
        <p className="ml-auto shrink-0 px-2 text-[11px] text-muted-foreground tabular-nums">
          {data ? t("filesCount", { count: data.files.length }) : "…"}
        </p>
      </div>

      {ideTab === "files" && (
        <>
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
        </>
      )}
      {ideTab === "changes" && (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <MissionChanges changes={missionProgress.changes} />
        </div>
      )}
      {ideTab === "activity" && (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <ActivityTab entries={activityEntries} />
        </div>
      )}
      {ideTab === "terminal" && (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <TerminalTab entries={fileEntries} />
        </div>
      )}
    </div>
  );
}
