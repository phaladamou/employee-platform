import { tool } from "ai";
import { z } from "zod";

interface NewsResult {
  title: string;
  snippet: string;
  url: string;
  source: string;
  date?: string;
}

export const newsSearch = tool({
  description:
    "Search for recent news articles about a topic. Use this for current events, breaking news, or when the user asks about what happened recently.",
  inputSchema: z.object({
    query: z.string().describe("The news search query"),
    days: z
      .number()
      .optional()
      .default(7)
      .describe("Number of days to look back (default: 7)"),
  }),
  execute: async ({ query, days }) => {
    try {
      const response = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query,
          api_key: process.env.TAVILY_API_KEY || "tvly-dev-",
          search_depth: "advanced",
          max_results: 8,
          topic: "news",
          days: days ?? 7,
          include_answer: true,
          include_raw_content: false,
          include_images: false,
        }),
      });

      if (!response.ok) {
        return { error: "News search failed", query };
      }

      const data = await response.json();

      const results: NewsResult[] = (data.results || []).map(
        (r: {
          title: string;
          content: string;
          url: string;
          published_date?: string;
        }) => ({
          title: r.title,
          snippet: r.content,
          url: r.url,
          source: (() => {
            try {
              return new URL(r.url).hostname.replace("www.", "");
            } catch {
              return "Unknown";
            }
          })(),
          date: r.published_date || undefined,
        })
      );

      return {
        query,
        answer: data.answer || null,
        results,
        resultCount: results.length,
        searchedDays: days ?? 7,
      };
    } catch {
      return { error: "News search failed", query };
    }
  },
});
