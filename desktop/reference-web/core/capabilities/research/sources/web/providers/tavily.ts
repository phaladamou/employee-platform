
import type { SearchResult } from "../web-types";

export async function searchTavily(
  query: string
): Promise<{
  results: SearchResult[];
  images: string[];
}> {
  const apiKey = process.env.TAVILY_API_KEY;

  if (!apiKey) {
    throw new Error(
      "TAVILY_API_KEY is missing. Check your .env.local file."
    );
  }

  try {
    const response = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query,
        api_key: apiKey,
        search_depth: "basic",
        max_results: 5,
        include_images: true,
        include_image_descriptions: false,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();

      throw new Error(
        `Tavily API error ${response.status}: ${errorBody}`
      );
    }

    const data = await response.json();

    const images: string[] = (data.images ?? []).map(
      (image: { url: string } | string) =>
        typeof image === "string" ? image : image.url
    );

    const results: SearchResult[] = (data.results ?? []).map(
      (result: {
        title: string;
        content: string;
        url: string;
      }) => ({
        title: result.title,
        snippet: result.content,
        url: result.url,
      })
    );

    return {
      results,
      images,
    };
  } catch (error) {
    console.error("Tavily search failed:", error);
    throw error;
  }
}
