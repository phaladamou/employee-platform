import dotenv from "dotenv";
dotenv.config({ path: "../../../.env.local" });

import { searchTavily } from "../../capabilities/research/sources/web/providers/tavily";
async function testTavily() {
  console.log("=== TAVILY SMOKE TEST ===\n");

  try {
    const result = await searchTavily("artificial intelligence");
    console.log(`✅ Tavily fonctionne: ${result.results.length} résultats`);
    console.log(`Images: ${result.images.length}`);
    
    if (result.results.length > 0) {
      console.log(`Premier résultat: ${result.results[0].title}`);
    }
  } catch (error) {
    console.error("❌ Erreur Tavily:", error);
  }

  console.log("\n=== TEST TERMINÉ ===");
}

testTavily().catch(console.error);