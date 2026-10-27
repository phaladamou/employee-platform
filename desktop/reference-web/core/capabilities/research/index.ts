import { ResearchCapability } from "./research-capability";
import { ResearchSourceRegistry } from "./research-source-registry";

import { WebResearchSource } from "./sources/web/web-research-source";
import { ArxivResearchSource } from "./sources/arxiv/arxiv-research-source";
import { GithubResearchSource } from "./sources/github/github-research-source";

import { webSearchCapability } from "./sources/web/web-search-provider";

export function createResearchCapability() {
  // 1. Créer le registre des sources
  const sourceRegistry = new ResearchSourceRegistry();

  // 2. Créer et enregistrer les sources
  const webSource = new WebResearchSource(webSearchCapability);
  const arxivSource = new ArxivResearchSource();
  const githubSource = new GithubResearchSource();

  sourceRegistry.register(webSource);
  sourceRegistry.register(arxivSource);
  sourceRegistry.register(githubSource);

  // 3. Créer la capacité de recherche
  const researchCapability = new ResearchCapability(sourceRegistry);

  return {
    researchCapability,
    sourceRegistry
  };
}