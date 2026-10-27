
import type { LLMProvider } from "./llm-provider";

export class LLMProviderRegistry {
  private readonly providers = new Map<string, LLMProvider>();

  register(provider: LLMProvider): void {
    if (this.providers.has(provider.id)) {
      throw new Error(
        `LLM provider already registered: ${provider.id}`
      );
    }

    this.providers.set(provider.id, provider);
  }

  get(id: string): LLMProvider {
    const provider = this.providers.get(id);

    if (!provider) {
      throw new Error(`LLM provider not found: ${id}`);
    }

    return provider;
  }

  has(id: string): boolean {
    return this.providers.has(id);
  }

  list(): LLMProvider[] {
    return Array.from(this.providers.values());
  }
}
