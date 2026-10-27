import type { Capability } from "../../../capability";
import { searchDuckDuckGo } from "./providers/duckduckgo";
import { searchTavily } from "./providers/tavily";
import type {
  SearchResult,
  WebSearchInput,
  WebSearchOutput,
} from "./web-types";

function deduplicateResults(
  results: SearchResult[]
): SearchResult[] {
  const seen = new Set<string>();

  return results.filter((result) => {
    const key = result.url.toLowerCase().replace(/\/$/, "");

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

export const webSearchCapability: Capability<
  WebSearchInput,
  WebSearchOutput
> = {
  id: "web.search",

  name: "Web Search",

  description: "Search the public web for current information.",

  async execute(input) {
    const { query } = input;

    if (!query?.trim()) {
      throw new Error("Search query cannot be empty");
    }

    // Exécuter chaque provider indépendamment
    const [tavilyResult, duckduckgoResult] = await Promise.allSettled([
      searchTavily(query),
      searchDuckDuckGo(query),
    ]);

    // Récupérer les résultats réussis
    const tavilyData = tavilyResult.status === "fulfilled" 
      ? tavilyResult.value 
      : { results: [], images: [] };
    
    const duckduckgoResults = duckduckgoResult.status === "fulfilled" 
      ? duckduckgoResult.value 
      : [];

    // Logger les échecs
    if (tavilyResult.status === "rejected") {
      console.warn("Tavily search failed, using DuckDuckGo only:", tavilyResult.reason);
    }
    if (duckduckgoResult.status === "rejected") {
      console.warn("DuckDuckGo search failed, using Tavily only:", duckduckgoResult.reason);
    }

    const allResults = [
      ...tavilyData.results,
      ...duckduckgoResults,
    ];

    const uniqueResults = deduplicateResults(allResults).slice(0, 8);

    const images = [
      ...tavilyData.images,
      ...duckduckgoResults
        .filter((result) => result.image)
        .map((result) => result.image as string),
    ];

    return {
      query,
      results: uniqueResults,
      images: [...new Set(images)].slice(0, 6),
      resultCount: uniqueResults.length,
      sources: {
        tavily: tavilyData.results.length,
        duckduckgo: duckduckgoResults.length,
      },
    };
  },
};