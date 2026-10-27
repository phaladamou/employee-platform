import type { SearchResult } from "../web-types";

export async function searchDuckDuckGo(
  query: string
): Promise<SearchResult[]> {
  try {
    const response = await fetch(
      `https://api.duckduckgo.com/?q=${encodeURIComponent(
        query
      )}&format=json&no_html=1&skip_disambig=1`
    );

    if (!response.ok) {
      return [];
    }

    const data = await response.json();

    const results: SearchResult[] = (data.RelatedTopics ?? [])
      .filter(
        (topic: { Text?: string; FirstURL?: string }) =>
          topic.Text && topic.FirstURL
      )
      .map(
        (topic: {
          Text: string;
          FirstURL: string;
          Icon?: { URL?: string };
        }) => ({
          title: topic.Text.split(" - ")[0] || topic.Text,
          snippet:
            topic.Text.split(" - ").slice(1).join(" - ") ||
            topic.Text,
          url: topic.FirstURL,
          image: topic.Icon?.URL,
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