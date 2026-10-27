// app/(chat)/search/page.tsx
"use client";

import { SearchIcon, XIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import useSWRInfinite from "swr/infinite";
import { fetcher } from "@/lib/utils";

interface MessageSnippet {
  snippet: string;
  createdAt: string;
}

interface SearchResult {
  chatId: string;
  chatTitle: string;
  chatCreatedAt: string;
  titleMatch: string | null;
  messageSnippets: MessageSnippet[];
}

type ChatHistory = {
  chats: {
    id: string;
    title: string;
    createdAt: string;
  }[];
  hasMore: boolean;
};

const PAGE_SIZE = 50;

function getHistoryKey(pageIndex: number, previousPageData: ChatHistory | null) {
  if (previousPageData && !previousPageData.hasMore) return null;
  if (pageIndex === 0) {
    return `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/history?limit=${PAGE_SIZE}`;
  }
  const lastChat = previousPageData?.chats.at(-1);
  if (!lastChat) return null;
  return `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/history?ending_before=${lastChat.id}&limit=${PAGE_SIZE}`;
}

export default function SearchPage() {
  const t = useTranslations("search");
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: historyPages, isLoading: historyLoading } =
    useSWRInfinite<ChatHistory>(getHistoryKey, fetcher, {
      revalidateOnFocus: false,
    });

  const allChats = historyPages?.flatMap((page) => page.chats) ?? [];

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const fetchResults = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/search?q=${encodeURIComponent(q)}`
      );
      const data = await res.json();
      setResults(data.results || []);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleInputChange = (value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchResults(value), 300);
  };

  const clearSearch = () => {
    setQuery("");
    setResults([]);
    inputRef.current?.focus();
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const isSearching = query.trim().length >= 2;

  return (
    <div className="absolute inset-0 flex flex-col bg-background">
      {/* Barre de recherche fixe */}
      <div className="shrink-0 px-6 pt-12 pb-4">
        <div className="mx-auto max-w-2xl">
          <h1 className="mb-4 text-lg font-semibold tracking-tight">
            {t("title")}
          </h1>
          <div className="relative">
            <SearchIcon className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => handleInputChange(e.target.value)}
              placeholder={t("placeholder")}
              className="flex h-12 w-full rounded-xl border border-border bg-card pl-10 pr-10 text-sm shadow-sm placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            {query && (
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

      {/* Contenu scrollable */}
      <div className="flex-1 overflow-y-auto px-6 pb-8">
        <div className="mx-auto max-w-2xl">
          {!isSearching && historyLoading && (
            <div className="mt-8 flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <div className="size-4 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
              {t("loadingHistory")}
            </div>
          )}

          {!isSearching && !historyLoading && (
            <div className="flex flex-col pt-2">
              {allChats.map((chat) => (
                <button
                  key={chat.id}
                  type="button"
                  onClick={() => router.push(`/workspace/${chat.id}`)}
                  className="flex items-center justify-between gap-4 rounded-xl px-4 py-3 text-left transition-colors hover:bg-muted/50"
                >
                  <span className="truncate text-sm font-medium">
                    {chat.title}
                  </span>
                  <span className="shrink-0 text-[11px] text-muted-foreground">
                    {formatDate(chat.createdAt)}
                  </span>
                </button>
              ))}
            </div>
          )}

          {isSearching && loading && (
            <div className="mt-8 flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <div className="size-4 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
              {t("searching")}
            </div>
          )}

          {isSearching && !loading && results.length === 0 && (
            <p className="mt-20 text-center text-sm text-muted-foreground">
              {t("noResults")}
            </p>
          )}

          {isSearching && !loading && results.length > 0 && (
            <div className="flex flex-col pt-2">
              {results.map((result) => (
                <button
                  key={result.chatId}
                  type="button"
                  onClick={() => router.push(`/workspace/${result.chatId}`)}
                  className="flex flex-col gap-1.5 rounded-xl px-4 py-3 text-left transition-colors hover:bg-muted/50"
                >
                  <div className="flex items-baseline justify-between gap-4">
                    <h3 className="truncate text-sm font-medium">
                      <HighlightText text={result.chatTitle} query={query} />
                    </h3>
                    <span className="shrink-0 text-[11px] text-muted-foreground">
                      {formatDate(result.chatCreatedAt)}
                    </span>
                  </div>

                  {result.messageSnippets.length > 0 && (
                    <div className="flex flex-col gap-0.5">
                      {result.messageSnippets.map((snippet, i) => (
                        <p
                          key={`${result.chatId}-msg-${i}`}
                          className="text-[13px] leading-relaxed text-muted-foreground line-clamp-1"
                        >
                          <HighlightText
                            text={snippet.snippet}
                            query={query}
                          />
                        </p>
                      ))}
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function HighlightText({
  text,
  query,
}: {
  text: string;
  query: string;
}) {
  if (!query || query.length < 2) return <span>{text}</span>;

  const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`(${escapedQuery})`, "gi");
  const parts = text.split(regex);

  return (
    <>
      {parts.map((part, i) =>
        regex.test(part) ? (
          <mark
            key={i}
            className="rounded-sm bg-yellow-200/50 px-0.5 text-foreground dark:bg-yellow-500/20"
          >
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}