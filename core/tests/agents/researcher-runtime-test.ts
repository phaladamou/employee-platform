import { createCore } from "../../runtime/bootstrap";

import { createMission } from "../../missions/mission";
import { createTask } from "../../missions/task";

async function main() {
  console.log("==========================================");
  console.log(" Researcher Agent Test");
  console.log("==========================================\n");

  const {
    runtime,
    researcher,
  } = createCore();

  const mission = createMission({
    id: "test-mission",
    objective:
      "What are the current limitations of AI systems in scientific discovery?",
  });

  const task = createTask({
    id: "test-task",
    missionId: mission.id,
    objective: mission.objective,
  });

  const context = {
    eventBus: runtime.eventBus,
    capabilities: runtime.capabilities,
    llmProviders: runtime.llmProviders,
    mission,
    task,
  };

  await researcher.initialize(context);

  console.log(
    "[Researcher Test] Researcher initialized."
  );

  const result = await researcher.execute({
    question: task.objective,
  });

  console.log("\n==========================================");
  console.log(" FINAL RESEARCH RESULT");
  console.log("==========================================\n");

  console.log(result.summary);

  console.log("\n==========================================");
  console.log(
    ` SOURCES: ${result.sources.length}`
  );
  console.log("==========================================\n");

  for (const [
    index,
    source,
  ] of result.sources.entries()) {
    console.log(`Source ${index + 1}:`);

    console.log(
      `Title: ${source.title}`
    );

    console.log(
      `URL: ${source.url}`
    );

    console.log(
      `Score: ${
        source.evaluation?.score ??
        "unknown"
      }/100`
    );

    console.log("");
  }

  await researcher.shutdown();

  console.log(
    "[Researcher Test] Completed successfully."
  );
}

main().catch((error) => {
  console.error(
    "\n[Researcher Test] FAILED\n",
    error
  );

  process.exit(1);
});