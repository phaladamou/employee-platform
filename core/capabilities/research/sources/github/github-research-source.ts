import type {
  ResearchSourceProvider,
  ResearchSearchInput,
  ResearchSearchOutput,
  ResearchSource
} from "../../research-source";

import { GithubClient } from "./github-client";

export class GithubResearchSource implements ResearchSourceProvider {
  readonly id = "github";
  readonly name = "GitHub";
  readonly description = "Searches repositories and reads their content on GitHub";

  constructor(
    private readonly client: GithubClient = new GithubClient()
  ) {}

  async search(input: ResearchSearchInput): Promise<ResearchSearchOutput> {
    const response = await this.client.searchRepositories(
      input.query,
      input.limit ?? 10
    );

    const results: ResearchSource[] = [];

    for (const repo of response.repositories) {
      // Récupérer le README pour enrichir le snippet
      const readme = await this.client.getReadme(repo.fullName);
      
      // Construire un snippet enrichi
      let snippet = repo.description ?? "No description available";
      
      if (readme) {
        // Prendre les 500 premiers caractères du README
        const readmeExcerpt = readme.substring(0, 500);
        snippet += `\n\nREADME:\n${readmeExcerpt}...`;
      }
      
      // Ajouter les métadonnées
      snippet += `\n\n⭐ ${repo.stars} stars | 🍴 ${repo.forks} forks | Language: ${repo.language ?? "Unknown"}`;
      
      if (repo.topics.length > 0) {
        snippet += `\nTopics: ${repo.topics.join(", ")}`;
      }

      results.push({
        title: repo.fullName,
        url: repo.htmlUrl,
        snippet
      });
    }

    return { results };
  }
}