import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { createResearchCapability } from "../../capabilities/research";
async function runResearchSmokeTest() {
  console.log("=== RESEARCH CAPABILITY SMOKE TEST ===\n");

  // 1. Initialiser la capacité de recherche
  const { researchCapability, sourceRegistry } = createResearchCapability();

  console.log("✅ ResearchCapability initialisée");
  console.log(`Sources enregistrées: ${sourceRegistry.list().length}\n`);

  sourceRegistry.list().forEach(source => {
    console.log(`  - ${source.id}: ${source.name}`);
  });

  // 2. Tester sans contraintes (toutes les sources)
  console.log("\n--- Test 1: Sans contraintes ---");
  try {
    const result = await researchCapability.execute({
      question: "artificial intelligence"
    });
    console.log(`✅ Recherche exécutée: ${result.sources.length} résultats`);
    if (result.sources.length > 0) {
      console.log(`Premier résultat: ${result.sources[0].title}`);
    }
  } catch (error) {
    console.log(`❌ Erreur: ${error}`);
  }

  // 3. Tester avec contrainte include
  console.log("\n--- Test 2: Include arxiv ---");
  try {
    const result = await researchCapability.execute({
      question: "artificial intelligence",
      sources: {
        include: ["arxiv"]
      }
    });
    console.log(`✅ Recherche arXiv exécutée: ${result.sources.length} résultats`);
  } catch (error) {
    console.log(`❌ Erreur: ${error}`);
  }

  // 4. Tester avec source inexistante
  console.log("\n--- Test 3: Source inexistante ---");
  try {
    await researchCapability.execute({
      question: "test",
      sources: {
        include: ["pubmed"]
      }
    });
    console.log("❌ Aurait dû échouer");
  } catch (error) {
    console.log(`✅ Erreur détectée: ${error}`);
  }

  console.log("\n=== TEST TERMINÉ ===");
}

runResearchSmokeTest().catch(console.error);