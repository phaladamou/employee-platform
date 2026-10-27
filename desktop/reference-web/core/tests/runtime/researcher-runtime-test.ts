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
    objective: "Conduct a scientific research task",
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

  console.log("Core result:");
  console.log(result);

  await runtime.agents.stop(
    researcher
  );
}

main().catch((error) => {
  console.error("Core failed:", error);
  process.exit(1);
});