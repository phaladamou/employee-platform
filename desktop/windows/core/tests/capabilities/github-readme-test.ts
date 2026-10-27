import dotenv from "dotenv";
dotenv.config({ path: "../../../.env.local" });

import { GithubResearchSource } from "../../capabilities/research/sources/github/github-research-source";
async function testGithubReadme() {
  console.log("=== GITHUB README TEST ===\n");

  const githubSource = new GithubResearchSource();

  try {
    const result = await githubSource.search({
      query: "AI agent scientific research",
      limit: 3
    });

    console.log(`✅ ${result.results.length} repositories trouvés\n`);

    for (const repo of result.results) {
      console.log(`📦 ${repo.title}`);
      console.log(`🔗 ${repo.url}`);
      console.log(`📝 ${repo.snippet.substring(0, 200)}...\n`);
    }
  } catch (error) {
    console.error("❌ Erreur:", error);
  }

  console.log("=== TEST TERMINÉ ===");
}

testGithubReadme().catch(console.error);