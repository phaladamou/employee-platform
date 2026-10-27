export interface SearchResult {
  readonly title: string;
  readonly snippet: string;
  readonly url: string;
  readonly image?: string;
}

export interface WebSearchInput {
  readonly query: string;
}

export interface WebSearchOutput {
  readonly query: string;
  readonly results: SearchResult[];
  readonly images: string[];
  readonly resultCount: number;
  readonly sources: {
    readonly tavily: number;
    readonly duckduckgo: number;
  };
}