import "dotenv/config";

import { createCore } from "../../runtime/bootstrap";

import { createMission } from "../../missions/mission";
import { createTask } from "../../missions/task";

async function main() {
  const {
    runtime,
    researcher,
  } = createCore();

  const mission = createMission({
    id: "test-mission",
    objective:
      "latest scientific discoveries in artificial intelligence",
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

  await runtime.agents.start(
    researcher,
    context
  );

  const result =
    await runtime.agents.execute(
      researcher,
      {
        question: task.objective,
      }
    );

  console.log(
    "Researcher runtime test result:"
  );

  console.dir(result, {
    depth: null,
  });

  await runtime.agents.stop(
    researcher
  );
}

main().catch((error) => {
  console.error(
    "Researcher runtime test failed:"
  );

  console.error(error);

  process.exit(1);
});