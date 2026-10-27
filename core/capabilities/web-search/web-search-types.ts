export type WebSearchInput = {
  readonly query: string;
};

export type WebSearchResultItem = {
  title: string;
  snippet: string;
  url: string;
  image?: string;
};

export type WebSearchOutput = {
  readonly query: string;
  readonly results: WebSearchResultItem[];
  readonly images: string[];
  readonly resultCount: number;
  readonly sources: {
    readonly tavily: number;
    readonly duckduckgo: number;
  };
};