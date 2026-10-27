import dotenv from "dotenv";
dotenv.config({ path: "../../.env.local" });

import { InMemoryEventBus } from "../../communication/in-memory-event-bus";
import { CapabilityRegistry } from "../../capabilities/capability-registry";
import { createResearchCapability } from "../../capabilities/research";
import { LLMProviderRegistry } from "../../models/llm-provider-registry";
import { DeepSeekProvider } from "../../models/providers/deepseek-provider";
import { ResearcherAgent } from "../../agents/researcher/researcher";

async function testResearcherAgent() {
  console.log("=== RESEARCHER AGENT TEST ===\n");

  // 1. Initialiser les registres
  const eventBus = new InMemoryEventBus();
  const capabilities = new CapabilityRegistry();
  const llmProviders = new LLMProviderRegistry();

  // 2. Créer et enregistrer la capacité de recherche
  const { researchCapability } = createResearchCapability();
  capabilities.register(researchCapability);

  // 3. Enregistrer le provider LLM
  llmProviders.register(new DeepSeekProvider());

  // 4. Créer le ResearcherAgent
  const researcher = new ResearcherAgent();

  // 5. Initialiser avec le contexte
  await researcher.initialize({
    eventBus,
    capabilities,
    llmProviders,
    mission: {} as any,
    task: {} as any
  });

  // 6. Exécuter une recherche
  console.log("Démarrage de la recherche...\n");
  
  const result = await researcher.execute({
    question: "What are the latest advances in AI agents for scientific research?"
  });

  console.log("\n=== RÉSULTAT FINAL ===\n");
  console.log("Question:", result.question);
  console.log("Status:", result.status);
  console.log("Nombre de sources:", result.sources.length);
  console.log("\nRésumé:\n", result.summary.substring(0, 500) + "...");

  // 7. Nettoyer
  await researcher.shutdown();
}

testResearcherAgent().catch(console.error);