"use client";

import { ArrowUpRightIcon } from "lucide-react";

interface Source {
  title: string;
  url: string;
  snippet?: string;
}

export const searchArtifact = {
  kind: "search" as const,
  description: "Search results from the web",
  content: ({ content }: { content: string }) => {
    let sources: Source[] = [];
    try {
      sources = content ? JSON.parse(content) : [];
    } catch {
      return (
        <div className="p-4 text-sm text-muted-foreground">
          Aucune source disponible.
        </div>
      );
    }

    if (sources.length === 0) {
      return (
        <div className="p-4 text-sm text-muted-foreground">
          Aucune source disponible.
        </div>
      );
    }

    return (
      <div className="flex flex-col gap-4 p-6 animate-[fade-up_0.2s_ease-out]">
        <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">
          Sources explorées par Employee
        </div>
        <div className="grid grid-cols-1 gap-3">
          {sources.map((source, index) => {
            let hostname = "Lien";
            try {
              hostname = new URL(source.url).hostname.replace("www.", "");
            } catch {
              // ignore
            }

            return (
              <a
                className="group flex flex-col gap-1.5 rounded-xl border border-border/40 bg-muted/30 p-4 transition-all duration-200 hover:border-border hover:bg-muted/60 hover:shadow-sm"
                href={source.url}
                key={source.url || index}
                rel="noopener noreferrer"
                target="_blank"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs font-medium text-primary">
                    <img
                      alt={hostname}
                      className="size-3.5 rounded-sm object-contain bg-background"
                      onError={(e) => {
                        (e.currentTarget as HTMLElement).style.display = "none";
                      }}
                      src={`https://www.google.com/s2/favicons?sz=64&domain=${source.url}`}
                    />
                    <span>{hostname}</span>
                  </div>
                  <ArrowUpRightIcon
                    className="text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
                    size={12}
                  />
                </div>
                <h4 className="text-sm font-semibold leading-snug text-foreground group-hover:text-primary transition-colors">
                  {source.title}
                </h4>
                {source.snippet && (
                  <p className="text-xs leading-relaxed text-muted-foreground line-clamp-2">
                    {source.snippet}
                  </p>
                )}
              </a>
            );
          })}
        </div>
      </div>
    );
  },
  actions: [] as any[],
  toolbar: [] as any[],
  onStreamPart: () => {},
};