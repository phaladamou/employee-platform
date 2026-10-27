import type { Capability } from "../capability";
import type {
  WebSearchInput,
  WebSearchOutput,
  WebSearchResultItem,
} from "./web-search-types";

interface TavilyRawResult {
  title: string;
  content: string;
  url: string;
}

interface TavilyResponse {
  results?: TavilyRawResult[];
  images?: Array<{ url: string } | string>;
}

interface DuckDuckGoTopic {
  Text?: string;
  FirstURL?: string;
  Icon?: { URL?: string };
}

interface DuckDuckGoResponse {
  RelatedTopics?: DuckDuckGoTopic[];
  AbstractText?: string;
  AbstractURL?: string;
  AbstractSource?: string;
  Heading?: string;
  Image?: string;
}

async function searchTavily(
  query: string
): Promise<{ results: WebSearchResultItem[]; images: string[] }> {
  try {
    const response = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query,
        api_key: process.env.TAVILY_API_KEY || "tvly-dev-",
        search_depth: "basic",
        max_results: 5,
        include_images: true,
        include_image_descriptions: false,
      }),
    });

    if (!response.ok) {
      return { results: [], images: [] };
    }

    const data = (await response.json()) as TavilyResponse;

    const images: string[] = (data.images || []).map((img) =>
      typeof img === "string" ? img : img.url
    );

    const results = (data.results || []).map((r) => ({
      title: r.title,
      snippet: r.content,
      url: r.url,
    }));

    return { results, images };
  } catch {
    return { results: [], images: [] };
  }
}

async function searchDuckDuckGo(
  query: string
): Promise<WebSearchResultItem[]> {
  try {
    const response = await fetch(
      `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`
    );

    if (!response.ok) {
      return [];
    }

    const data = (await response.json()) as DuckDuckGoResponse;

    const results: WebSearchResultItem[] = (data.RelatedTopics || [])
      .filter((t) => t.Text && t.FirstURL)
      .map((topic) => ({
        title: topic.Text!.split(" - ")[0] || topic.Text!,
        snippet:
          topic.Text!.split(" - ").slice(1).join(" - ") || topic.Text!,
        url: topic.FirstURL!,
        image: topic.Icon?.URL || undefined,
      }));

    if (data.AbstractText && data.AbstractURL) {
      results.unshift({
        title: data.Heading || data.AbstractSource || "Résumé",
        snippet: data.AbstractText,
        url: data.AbstractURL,
        image: data.Image || undefined,
      });
    }

    return results;
  } catch {
    return [];
  }
}

function deduplicateResults(
  results: WebSearchResultItem[]
): WebSearchResultItem[] {
  const seen = new Set<string>();
  return results.filter((r) => {
    const key = r.url.toLowerCase().replace(/\/$/, "");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export class WebSearchCapability
  implements Capability<WebSearchInput, WebSearchOutput>
{
  readonly id = "web-search";
  readonly name = "Web Search";
  readonly description =
    "Search the web for current information, news, and recent events.";

  async execute(input: WebSearchInput): Promise<WebSearchOutput> {
    const { query } = input;

    try {
      const [tavilyData, ddgResults] = await Promise.all([
        searchTavily(query),
        searchDuckDuckGo(query),
      ]);

      const allResults = [...tavilyData.results, ...ddgResults];
      const allImages = [
        ...tavilyData.images,
        ...ddgResults.filter((r) => r.image).map((r) => r.image!),
      ];

      const uniqueResults = deduplicateResults(allResults).slice(0, 8);
      const uniqueImages = [...new Set(allImages)].slice(0, 6);

      uniqueResults.forEach((result, i) => {
        if (i < uniqueImages.length) {
          result.image = uniqueImages[i];
        }
      });

      if (uniqueImages.length > 0 && uniqueResults.length > 0) {
        const imageMarkdown = uniqueImages
          .map((url, i) => `![Photo ${i + 1}](${url})`)
          .join(" ");
        uniqueResults[0].snippet = `${imageMarkdown}\n\n${uniqueResults[0].snippet || ""}`;
      }

      return {
        query,
        results: uniqueResults,
        images: uniqueImages,
        resultCount: uniqueResults.length,
        sources: {
          tavily: tavilyData.results.length,
          duckduckgo: ddgResults.length,
        },
      };
    } catch {
      return {
        query,
        results: [],
        images: [],
        resultCount: 0,
        sources: { tavily: 0, duckduckgo: 0 },
      };
    }
  }
}