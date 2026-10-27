import { tool } from "ai";
import { z } from "zod";

interface SearchResult {
  title: string;
  snippet: string;
  url: string;
  image?: string;
}

async function searchTavily(
  query: string
): Promise<{ results: SearchResult[]; images: string[] }> {
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

    if (!response.ok) return { results: [], images: [] };

    const data = await response.json();
    const images: string[] = (data.images || []).map(
      (img: { url: string }) => img.url || img
    );

    const results = (data.results || []).map(
      (r: { title: string; content: string; url: string }) => ({
        title: r.title,
        snippet: r.content,
        url: r.url,
      })
    );

    return { results, images };
  } catch {
    return { results: [], images: [] };
  }
}

async function searchDuckDuckGo(query: string): Promise<SearchResult[]> {
  try {
    const response = await fetch(
      `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`
    );

    if (!response.ok) return [];

    const data = await response.json();
    const results: SearchResult[] = (data.RelatedTopics || [])
      .filter((t: { Text?: string; FirstURL?: string }) => t.Text && t.FirstURL)
      .map(
        (topic: {
          Text: string;
          FirstURL: string;
          Icon?: { URL?: string };
        }) => ({
          title: topic.Text.split(" - ")[0] || topic.Text,
          snippet: topic.Text.split(" - ").slice(1).join(" - ") || topic.Text,
          url: topic.FirstURL,
          image: topic.Icon?.URL || undefined,
        })
      );

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

function deduplicateResults(results: SearchResult[]): SearchResult[] {
  const seen = new Set<string>();
  return results.filter((r) => {
    const key = r.url.toLowerCase().replace(/\/$/, "");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export const webSearch = tool({
  description:
    "Search the web for current information, news, and recent events. Use this when you need up-to-date information beyond your knowledge cutoff. When images are found, include them in your response using Markdown syntax: ![description](url)",
  inputSchema: z.object({
    query: z.string().describe("The search query"),
  }),
  execute: async ({ query }) => {
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

      // Injecte les images dans les résultats
      uniqueResults.forEach((result, i) => {
        if (i < uniqueImages.length) {
          result.image = uniqueImages[i];
        }
      });

      // Ajoute les URLs d'images dans le snippet du premier résultat pour que le modèle les voie
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
      return { error: "Search failed", query };
    }
  },
});
