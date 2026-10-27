"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useArtifact } from "@/hooks/use-artifact";
import { ArtifactCloseButton } from "./artifact-close-button";

export function SearchArtifactPanel() {
  const { artifact, setArtifact } = useArtifact();
  const [isMobile, setIsMobile] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setIsMobile(window.innerWidth < 768);
    setMounted(true);
  }, []);

  let sources: Array<{ title: string; url: string; snippet?: string }> = [];
  try {
    sources = artifact.content ? JSON.parse(artifact.content) : [];
  } catch {
    // ignore
  }

  const header = (
    <div className="flex h-14 shrink-0 items-center border-b border-border/50 px-4">
      <ArtifactCloseButton />
      <span className="ml-3 text-sm font-semibold">
        Sources explorées ({sources.length})
      </span>
    </div>
  );

  const list = (
    <div className="flex-1 overflow-y-auto p-4">
      {sources.length === 0 ? (
        <div className="flex flex-1 items-center justify-center p-4 text-sm text-muted-foreground">
          Aucune source disponible.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {sources.map((source, index) => {
            const hostname = (() => {
              try {
                return new URL(source.url).hostname.replace("www.", "");
              } catch {
                return "Lien";
              }
            })();

            return (
              <a
                className="group flex flex-col gap-1.5 rounded-xl border border-border/40 bg-muted/30 p-4 transition-all duration-200 hover:border-border hover:bg-muted/60 hover:shadow-sm"
                href={source.url}
                key={source.url || `source-${index}`}
                rel="noopener noreferrer"
                target="_blank"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs font-medium text-primary">
                    <div className="relative size-3.5 shrink-0 rounded-sm bg-background">
                      <Image
                        alt=""
                        className="object-contain p-0.5"
                        fill
                        sizes="14px"
                        src={`https://www.google.com/s2/favicons?sz=64&domain=${source.url}`}
                        unoptimized
                      />
                    </div>
                    <span>{hostname}</span>
                  </div>
                  <svg
                    className="size-3 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    viewBox="0 0 24 24"
                  >
                    <path d="M7 17L17 7M17 7H7M17 7V17" />
                  </svg>
                </div>
                <h4 className="text-sm font-semibold leading-snug text-foreground transition-colors group-hover:text-primary">
                  {source.title}
                </h4>
                {source.snippet && (
                  <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                    {source.snippet}
                  </p>
                )}
              </a>
            );
          })}
        </div>
      )}
    </div>
  );

  // Éviter le flash SSR
  if (!mounted) {
    return (
      <div className="hidden md:flex h-dvh w-[35%] shrink-0 flex-col overflow-hidden border-l border-border/50 bg-sidebar">
        {header}
        <div className="flex-1" />
      </div>
    );
  }

  // Mobile: bottom sheet
  if (isMobile) {
    return (
      <div className="fixed inset-0 z-50">
        <button
          aria-label="Fermer les sources"
          className="absolute inset-0 z-10 bg-black/20"
          onClick={() => setArtifact((prev) => ({ ...prev, isVisible: false }))}
          type="button"
        />
        <div className="pointer-events-none absolute inset-0 z-20">
          <div className="absolute inset-x-0 bottom-0 pointer-events-auto flex max-h-[60vh] flex-col overflow-hidden rounded-t-2xl border border-border/50 bg-sidebar shadow-2xl">
            {header}
            {list}
          </div>
        </div>
      </div>
    );
  }

  // Desktop: side panel
  return (
    <div className="flex h-dvh w-[35%] shrink-0 flex-col overflow-hidden border-l border-border/50 bg-sidebar">
      {header}
      {list}
    </div>
  );
}
