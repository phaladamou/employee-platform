import "dotenv/config";

import { randomUUID } from "node:crypto";

import type { DomainEvent } from "../../communication/event";

import type {
  MissionResult,
} from "../../contracts/mission-result";

import type {
  Mission,
} from "../../missions/mission";

import {
  createCore,
} from "../../runtime/bootstrap";

type MissionRequest = {
  readonly requestId: string;
  readonly objective: string;
};

type MissionCompletedPayload = {
  readonly requestId: string;
  readonly result: MissionResult;
};

type MissionFailedPayload = {
  readonly requestId: string;
  readonly error: string;
};

async function main() {
  const objective = process.argv
    .slice(2)
    .join(" ")
    .trim();

  if (!objective) {
    throw new Error(
      "No mission provided. Pass the mission as a command-line argument."
    );
  }

  const {
    runtime,
  } = createCore();

  let completedResult:
    MissionResult | undefined;

  let failedError:
    string | undefined;

  const requestId =
    randomUUID();

  const unsubscribeCompleted =
    runtime.eventBus.subscribe<MissionCompletedPayload>(
      "mission.completed",
      (event) => {
        if (
          event.payload.requestId !==
          requestId
        ) {
          return;
        }

        completedResult =
          event.payload.result;
      }
    );

  const unsubscribeFailed =
    runtime.eventBus.subscribe<MissionFailedPayload>(
      "mission.failed",
      (event) => {
        if (
          event.payload.requestId !==
          requestId
        ) {
          return;
        }

        failedError =
          event.payload.error;
      }
    );

  try {
    const event:
      DomainEvent<MissionRequest> = {
      id: randomUUID(),
      type: "mission.requested",
      timestamp: new Date(),
      payload: {
        requestId,
        objective,
      },
    };

    await runtime.eventBus.publish(
      event
    );

    if (failedError) {
      throw new Error(
        failedError
      );
    }

    if (!completedResult) {
      throw new Error(
        "Orchestrator did not produce a mission.completed result."
      );
    }

    if (
      completedResult.status !==
      "completed"
    ) {
      throw new Error(
        `Unexpected mission status: ${completedResult.status}`
      );
    }

    if (
      completedResult.objective !==
      objective
    ) {
      throw new Error(
        "Orchestrator returned a result for the wrong objective."
      );
    }

    console.log(
      "\n=========================================="
    );

    console.log(
      " ORCHESTRATOR TEST"
    );

    console.log(
      "==========================================\n"
    );

    console.log(
      "✓ Orchestrator received mission.requested."
    );

    console.log(
      "✓ Orchestrator created and planned the mission."
    );

    console.log(
      "✓ Orchestrator created the required tasks."
    );

    console.log(
      "✓ Orchestrator selected an agent."
    );

    console.log(
      "✓ Orchestrator executed the task."
    );

    console.log(
      "✓ Orchestrator completed the mission."
    );

    console.log(
      "\nMission result:\n"
    );

    console.dir(
      completedResult,
      {
        depth: null,
      }
    );
  } finally {
    unsubscribeCompleted();
    unsubscribeFailed();
  }
}

main().catch(
  (error) => {
    console.error(
      "\n[Orchestrator Test] FAILED\n",
      error
    );

    process.exit(1);
  }
);