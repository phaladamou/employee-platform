import type { Capability } from "../capability";
import type { ResearchRequest } from "./research-request";
import type { ResearchResult } from "./research-result";
import type { ResearchSourceProvider, ResearchSource } from "./research-source";
import { ResearchSourceRegistry } from "./research-source-registry";

export class ResearchCapability implements Capability<ResearchRequest, ResearchResult> {
  readonly id = "research";
  readonly name = "Research";
  readonly description = "Orchestrates research across multiple sources";

  constructor(
    private readonly sourceRegistry: ResearchSourceRegistry
  ) {}

  async execute(input: ResearchRequest): Promise<ResearchResult> {
    // 1. Valider la question
    if (!input.question?.trim()) {
      throw new Error("Research question cannot be empty");
    }

    // 2. Valider les contraintes utilisateur
    this.validateConstraints(input.sources);
    
    // 3. Résoudre les sources selon les contraintes
    const selectedSources = this.resolveSources(input.sources);
    
    // 4. Vérifier qu'il y a au moins une source
    if (selectedSources.length === 0) {
      throw new Error("No research sources available");
    }
    
    // 5. Exécuter les recherches avec gestion d'erreur par source
    const results = await this.executeSearches(input.question, selectedSources);
    
    if (results.length === 0) {
      throw new Error("No results found from any source");
    }
    
    return {
      question: input.question,
      status: "completed",
      summary: `Found ${results.length} results from ${selectedSources.length} sources`,
      sources: results
    };
  }

  private validateConstraints(
    constraints?: ResearchRequest["sources"]
  ): void {
    if (!constraints) return;
    
    if (constraints.include?.length) {
      this.sourceRegistry.validateSources(constraints.include);
    }
    
    if (constraints.exclude?.length) {
      this.sourceRegistry.validateSources(constraints.exclude);
    }
    
    if (constraints.preferred?.length) {
      this.sourceRegistry.validateSources(constraints.preferred);
    }
  }

  private resolveSources(
    constraints?: ResearchRequest["sources"]
  ): ResearchSourceProvider[] {
    const allSources = this.sourceRegistry.list();
    
    if (!constraints) {
      return allSources;
    }
    
    let selected = allSources;
    
    if (constraints.include?.length) {
      const includeIds = new Set(constraints.include);
      selected = selected.filter(s => includeIds.has(s.id));
    }
    
    if (constraints.exclude?.length) {
      const excludeIds = new Set(constraints.exclude);
      selected = selected.filter(s => !excludeIds.has(s.id));
    }
    
    if (constraints.preferred?.length) {
      const preferredIds = new Set(constraints.preferred);
      const preferred = selected.filter(s => preferredIds.has(s.id));
      const others = selected.filter(s => !preferredIds.has(s.id));
      selected = [...preferred, ...others];
    }
    
    return selected;
  }

  private async executeSearches(
    question: string,
    sources: readonly ResearchSourceProvider[]
  ): Promise<ResearchResult["sources"]> {
    const results: ResearchSource[] = [];
    
    // Exécuter chaque source indépendamment pour éviter qu'une source défaillante bloque tout
    for (const source of sources) {
      try {
        const searchResult = await source.search({ query: question });
        results.push(...searchResult.results);
      } catch (error) {
        console.error(`Source ${source.id} failed:`, error);
        // Continuer avec les autres sources
      }
    }
    
    return results;
  }
}