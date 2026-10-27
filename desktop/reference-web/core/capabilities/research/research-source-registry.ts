import type { ResearchSourceProvider } from "./research-source";

export class ResearchSourceRegistry {
  private readonly sources = new Map<string, ResearchSourceProvider>();

  register(source: ResearchSourceProvider): void {
    if (this.sources.has(source.id)) {
      throw new Error(`Research source already registered: ${source.id}`);
    }
    this.sources.set(source.id, source);
  }

  get(id: string): ResearchSourceProvider {
    const source = this.sources.get(id);
    if (!source) {
      throw new Error(`Research source not found: ${id}`);
    }
    return source;
  }

  has(id: string): boolean {
    return this.sources.has(id);
  }

  list(): ResearchSourceProvider[] {
    return Array.from(this.sources.values());
  }

  validateSources(sourceIds: readonly string[]): void {
    for (const id of sourceIds) {
      if (!this.has(id)) {
        throw new Error(`Research source not available: ${id}`);
      }
    }
  }
}