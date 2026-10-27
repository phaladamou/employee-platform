import type {
  ResearchSourceProvider,
  ResearchSearchInput,
  ResearchSearchOutput,
  ResearchSource
} from "../../research-source";

import type { WebSearchOutput } from "./web-types";

export class WebResearchSource implements ResearchSourceProvider {
  readonly id = "web";
  readonly name = "Web Search";
  readonly description = "Searches the web using available providers";

  constructor(
    private readonly webSearch: {
      execute(input: { query: string }): Promise<WebSearchOutput>;
    }
  ) {}

  async search(input: ResearchSearchInput): Promise<ResearchSearchOutput> {
    const result = await this.webSearch.execute({
      query: input.query
    });

    const results: ResearchSource[] = (result.results ?? [])
      .slice(0, input.limit)
      .map(r => ({
        title: r.title ?? "Untitled source",
        url: r.url,
        snippet: r.snippet ?? ""
      }));

    return { results };
  }
}