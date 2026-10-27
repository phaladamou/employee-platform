import { SearchResponse } from "./search-response";

type NewsSearchPart = {
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
      source?: string;
      date?: string;
      image?: string;
    }>;
    images?: string[];
  };
};

export function NewsSearchTool({ part }: { part: NewsSearchPart }) {
  const { toolCallId, state, input } = part;

  if (state === "input-available" || state === "input-streaming") {
    const queryText = input?.query || "votre question";
    return (
      <div
        className="mb-2 flex w-fit animate-pulse items-center gap-2 rounded-lg border border-border/20 bg-muted/40 px-3 py-1.5 text-xs text-muted-foreground"
        key={toolCallId}
      >
        <div className="size-2 animate-ping rounded-full bg-primary" />
        <span>Searching news for "{queryText}"...</span>
      </div>
    );
  }

  if (state === "output-available") {
    const output = part.output;
    const results = output?.results || [];
    const query = output?.query || "";
    const answer = output?.answer;
    const images = output?.images || [];

    if (results.length === 0 && !answer) {
      return (
        <div className="py-2 text-[13px] text-muted-foreground">
          No news found for "{query}".
        </div>
      );
    }

    return (
      <div className="w-full max-w-[580px]">
        <SearchResponse
          answer={answer}
          images={images}
          query={query}
          results={results}
        />
      </div>
    );
  }

  if (state === "output-error") {
    const query = part.output?.query || "";
    return (
      <div className="py-2 text-[13px] text-red-500">
        News search failed for "{query}".
      </div>
    );
  }

  return null;
}
