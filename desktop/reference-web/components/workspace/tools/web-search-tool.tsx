import { useEffect, useRef } from "react";
import { Tool, ToolContent, ToolHeader } from "@/components/ai-elements/tool";
import { SearchResponse } from "./search-response";

type WebSearchPart = {
  toolCallId: string;
  state: string;
  input?: { query?: string };
  output?: {
    query?: string;
    answer?: string;
    results?: Array<{
      title?: string;
      snippet?: string;
      url?: string;
      image?: string;
    }>;
    images?: string[];
  };
};

export function WebSearchTool({ part }: { part: WebSearchPart }) {
  const { toolCallId, state, input } = part;
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (state === "output-available" && containerRef.current) {
      setTimeout(() => {
        containerRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
        });
      }, 100);
    }
  }, [state]);

  if (state === "input-available" || state === "input-streaming") {
    const queryText = input?.query || "votre question";
    return (
      <div
        className="mb-2 flex w-fit animate-pulse items-center gap-2 rounded-lg border border-border/20 bg-muted/40 px-3 py-1.5 text-xs text-muted-foreground"
        key={toolCallId}
      >
        <div className="size-2 animate-ping rounded-full bg-primary" />
        <span>Searching for "{queryText}"...</span>
      </div>
    );
  }

  if (state === "output-available") {
    const output = part.output;
    const results = output?.results || [];
    const images = output?.images || [];
    const query = output?.query || "";
    const answer = output?.answer;

    if (results.length === 0 && !answer) {
      return (
        <div className="py-2 text-[13px] text-muted-foreground">
          No results found for "{query}".
        </div>
      );
    }

    return (
      <div className="w-[min(100%,580px)]" key={toolCallId} ref={containerRef}>
        <Tool
          className="w-full border-transparent shadow-none"
          defaultOpen={false}
        >
          <ToolHeader
            showBadge={false}
            state={state}
            title={`Web · ${query}`}
            type="tool-webSearch"
          />
          <ToolContent className="pt-0">
            <SearchResponse
              answer={answer}
              images={images}
              query={query}
              results={results}
            />
          </ToolContent>
        </Tool>
      </div>
    );
  }

  if (state === "output-error") {
    const query = part.output?.query || "";
    return (
      <div className="w-[min(100%,500px)]" key={toolCallId}>
        <Tool className="w-full" defaultOpen={true}>
          <ToolHeader state={state} type="tool-webSearch" />
          <ToolContent>
            <div className="py-2 text-[13px] text-red-500">
              Search failed for "{query}".
            </div>
          </ToolContent>
        </Tool>
      </div>
    );
  }

  return null;
}
