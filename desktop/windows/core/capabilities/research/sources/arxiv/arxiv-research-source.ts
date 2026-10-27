import type {
  ResearchSourceProvider,
  ResearchSearchInput,
  ResearchSearchOutput,
  ResearchSource
} from "../../research-source";

import { ArxivClient } from "./arxiv-client";

export class ArxivResearchSource implements ResearchSourceProvider {
  readonly id = "arxiv";
  readonly name = "arXiv";
  readonly description = "Searches scientific papers on arXiv";

  constructor(
    private readonly client: ArxivClient = new ArxivClient()
  ) {}

  async search(input: ResearchSearchInput): Promise<ResearchSearchOutput> {
    const response = await this.client.search(
      input.query,
      input.limit ?? 10
    );

    const results: ResearchSource[] = response.papers.map(paper => ({
      title: paper.title,
      url: paper.link,
      snippet: paper.summary
    }));

    return { results };
  }
}