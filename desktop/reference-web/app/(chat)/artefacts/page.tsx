// app/(chat)/artefacts/page.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  CodeIcon,
  FileTextIcon,
  GlobeIcon,
  ImageIcon,
  PlusIcon,
  SearchIcon,
  TableIcon,
  XIcon,
} from "lucide-react";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import type { Document } from "@/lib/db/schema";

const typeConfigMap: Record<string, { icon: React.ElementType; labelKey: string; color: string }> = {
  text: { icon: FileTextIcon, labelKey: "types.text", color: "text-blue-600" },
  code: { icon: CodeIcon, labelKey: "types.code", color: "text-violet-600" },
  image: { icon: ImageIcon, labelKey: "types.image", color: "text-rose-600" },
  sheet: { icon: TableIcon, labelKey: "types.sheet", color: "text-emerald-600" },
  site: { icon: GlobeIcon, labelKey: "types.site", color: "text-amber-600" },
};

function getPreviewLines(content: string | null): string[] {
  if (!content) return [];
  return content.split("\n").slice(0, 5);
}

function SheetPreview({ content }: { content: string | null }) {
  if (!content)
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground/60">
        <TableIcon className="size-6" />
      </div>
    );

  const rows = content.split("\n").filter((line) => line.trim()).slice(0, 3);
  if (rows.length === 0)
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground/60">
        <TableIcon className="size-6" />
      </div>
    );

  const cols = rows[0].split(/[,\t|]/).filter((cell) => cell.trim());

  return (
    <div className="w-full overflow-hidden">
      <table className="w-full text-[11px] border-collapse">
        <thead>
          <tr>
            {cols.map((col, i) => (
              <th
                key={i}
                className="border border-muted-foreground/30 bg-muted-foreground/10 px-2 py-1 text-left font-semibold text-foreground/90"
              >
                {col.trim()}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.slice(1).map((row, i) => {
            const cells = row.split(/[,\t|]/).slice(0, cols.length);
            return (
              <tr key={i}>
                {cells.map((cell, j) => (
                  <td
                    key={j}
                    className="border border-muted-foreground/20 px-2 py-1 text-foreground/80"
                  >
                    {cell.trim()}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function CodePreview({ lines }: { lines: string[] }) {
  if (lines.length === 0)
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground/60">
        <CodeIcon className="size-6" />
      </div>
    );

  return (
    <div className="w-full font-mono text-[11px] leading-relaxed">
      {lines.map((line, i) => {
        const isComment =
          line.trim().startsWith("//") ||
          line.trim().startsWith("#") ||
          line.trim().startsWith("--");
        const isKeyword = /\b(function|const|let|var|if|else|return|import|export|from|def|class)\b/.test(line);

        return (
          <div key={i} className="truncate">
            <span className="text-muted-foreground/60 mr-2">{i + 1}</span>
            <span
              className={
                isComment
                  ? "text-emerald-600"
                  : isKeyword
                  ? "text-violet-600"
                  : "text-foreground/90"
              }
            >
              {line || " "}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function TextPreview({ lines }: { lines: string[] }) {
  if (lines.length === 0)
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground/60">
        <FileTextIcon className="size-6" />
      </div>
    );

  return (
    <div className="w-full font-serif text-[12px] leading-relaxed text-foreground/85">
      {lines.map((line, i) => (
        <div key={i} className="truncate" style={{ opacity: 1 - i * 0.08 }}>
          {line || " "}
        </div>
      ))}
    </div>
  );
}

function FoldedCorner() {
  return (
    <div className="absolute top-0 right-0 w-7 h-7 overflow-hidden pointer-events-none z-10">
      <div
        className="absolute top-0 right-0 w-0 h-0 border-l-[28px] border-l-transparent border-t-[28px]"
        style={{
          borderTopColor: "#fdfdfc",
          boxShadow: "-1px 1px 2px rgba(0,0,0,0.06)",
        }}
      />
    </div>
  );
}

export default function ArtefactsPage() {
  const t = useTranslations("artefacts");
  const { data: session } = useSession();
  const userId = session?.user?.id;
  const router = useRouter();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const fetchDocuments = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/artefacts`);
      const data = await res.json();
      setDocuments(data.documents ?? []);
    } catch {
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const filteredDocuments = documents.filter((doc) =>
    doc.title.toLowerCase().includes(search.toLowerCase())
  );

  const groupedByType = filteredDocuments.reduce(
    (acc, doc) => {
      const kind = doc.kind ?? "text";
      if (!acc[kind]) acc[kind] = [];
      acc[kind].push(doc);
      return acc;
    },
    {} as Record<string, Document[]>
  );

  const clearSearch = () => setSearch("");

  const formatDate = (dateStr: string | Date) => {
    const date = typeof dateStr === "string" ? new Date(dateStr) : dateStr;
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  const handleDocumentClick = async (doc: Document) => {
    if (doc.chatId) {
      router.push(`/workspace/${doc.chatId}?document=${doc.id}`);
    } else {
      const res = await fetch(`/api/artefacts/chat?id=${doc.id}`);
      const data = await res.json();
      if (data.chatId) {
        router.push(`/workspace/${data.chatId}?document=${doc.id}`);
      } else {
        router.push(`/workspace?document=${doc.id}`);
      }
    }
  };

  return (
    <div className="absolute inset-0 flex flex-col bg-background">
      <div className="shrink-0 px-6 pt-12 pb-6">
        <div className="mx-auto max-w-3xl">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-lg font-semibold tracking-tight text-foreground">
              {t("title")}
            </h1>
            <button className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2 text-sm font-medium text-foreground shadow-sm hover:bg-muted/50 transition-colors">
              <PlusIcon className="size-4" />
              {t("newArtefact")}
            </button>
          </div>
          <div className="relative">
            <SearchIcon className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("searchPlaceholder")}
              className="flex h-12 w-full rounded-xl border border-border bg-card pl-10 pr-10 text-sm text-foreground shadow-sm placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            {search && (
              <button
                type="button"
                onClick={clearSearch}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                <XIcon className="size-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 pb-8">
        <div className="mx-auto max-w-3xl">
          {loading && (
            <div className="mt-20 flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <div className="size-4 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
            </div>
          )}

          {!loading && documents.length === 0 && (
            <p className="mt-32 text-center text-sm text-muted-foreground">
              Aucun artefact pour le moment.
            </p>
          )}

          {!loading &&
            Object.keys(typeConfigMap).map((kind) => {
              const items = groupedByType[kind];
              if (!items || items.length === 0) return null;

              const config = typeConfigMap[kind];
              const TypeIcon = config.icon;
              const label = t(config.labelKey);
              const isSite = kind === "site";

              return (
                <div key={kind} className="mb-14">
                  <div className="flex items-center gap-2 mb-5">
                    <TypeIcon className={`size-4 ${config.color}`} />
                    <h2 className="text-[13px] font-semibold text-foreground/80 uppercase tracking-wider">
                      {label}
                    </h2>
                    <span className="text-[11px] text-muted-foreground/70">
                      {items.length}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-5">
                    {items.map((doc) => {
                      const docKind = doc.kind ?? "text";
                      const docConfig = typeConfigMap[docKind];
                      const DocIcon = docConfig.icon;
                      const lines = getPreviewLines(doc.content);

                      if (isSite) {
                        return (
                          <button
                            key={doc.id}
                            type="button"
                            onClick={() => handleDocumentClick(doc)}
                            className="group flex flex-col gap-2 rounded-xl border border-border bg-card p-3 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-muted-foreground/30 hover:shadow-sm cursor-pointer"
                          >
                            <div className="flex items-center justify-center rounded-lg bg-muted/30 py-6">
                              <DocIcon className={`size-6 ${docConfig.color} transition-transform duration-200 group-hover:scale-110`} />
                            </div>
                            <div className="flex flex-col gap-0.5">
                              <span className="truncate text-sm font-semibold text-foreground leading-tight">
                                {doc.title}
                              </span>
                              <span className="text-[11px] text-muted-foreground/70">
                                {formatDate(doc.createdAt)}
                              </span>
                            </div>
                          </button>
                        );
                      }

                      return (
                        <button
                          key={doc.id}
                          type="button"
                          onClick={() => handleDocumentClick(doc)}
                          className="group flex flex-col rounded-xl border border-border/50 bg-[#fdfdfc] dark:bg-[#1c1c1a] text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-muted-foreground/30 hover:shadow-sm relative overflow-hidden cursor-pointer"
                        >
                          <FoldedCorner />
                          <div className="flex items-start p-4 min-h-[80px]">
                            {docKind === "text" && <TextPreview lines={lines} />}
                            {docKind === "code" && <CodePreview lines={lines} />}
                            {docKind === "image" && (
                              <div className="flex items-center justify-center w-full min-h-[70px] text-muted-foreground/50">
                                <ImageIcon className="size-6" />
                              </div>
                            )}
                            {docKind === "sheet" && <SheetPreview content={doc.content} />}
                          </div>
                          <div className="flex items-center justify-between gap-2 px-4 pb-3 pt-2 border-t border-border/30 mt-auto">
                            <span className="truncate text-sm font-semibold text-foreground leading-tight">
                              {doc.title}
                            </span>
                            <span className="shrink-0 text-[11px] text-muted-foreground/70">
                              {formatDate(doc.createdAt)}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
}