import type {
  DomainEvent,
} from "../../communication/event";

import type {
  EventBus,
  EventHandler,
} from "../../communication/event-bus";

import type {
  MissionResult,
} from "../../contracts/mission-result";

import type {
  CoreHost,
} from "../../contracts/host";

import type {
  CoreInput,
} from "../../contracts/input";

import { Core } from "../../core";

type MissionRequest = {
  readonly requestId: string;
  readonly input: CoreInput;
  readonly host: CoreHost;
};

type MissionCompletedPayload = {
  readonly requestId: string;
  readonly result: MissionResult;
};

type MissionFailedPayload = {
  readonly requestId: string;
  readonly error: string;
};

/**
 * Fake EventBus used to test Core in isolation.
 *
 * The test simulates the Orchestrator:
 *
 * Core
 *   ↓ mission.requested
 * Fake Orchestrator
 *   ↓ mission.completed / mission.failed
 * Core
 */
class FakeEventBus implements EventBus {
  private readonly handlers = new Map<
    string,
    Set<EventHandler>
  >();

  async publish<T>(
    event: DomainEvent<T>
  ): Promise<void> {
    const handlers =
      this.handlers.get(event.type);

    if (!handlers) {
      return;
    }

    await Promise.all(
      Array.from(handlers).map(
        (handler) => handler(event)
      )
    );
  }

  subscribe<T>(
    eventType: string,
    handler: EventHandler<T>
  ): () => void {
    const handlers =
      this.handlers.get(eventType) ??
      new Set<EventHandler>();

    handlers.add(
      handler as EventHandler
    );

    this.handlers.set(
      eventType,
      handlers
    );

    return () => {
      handlers.delete(
        handler as EventHandler
      );

      if (handlers.size === 0) {
        this.handlers.delete(eventType);
      }
    };
  }
}

function createFakeMissionResult(
  objective: string
): MissionResult {
  return {
    missionId: "test-mission",

    status: "completed",

    objective,

    tasks: [],

    result: {
      message:
        "Fake Orchestrator result",
    },
  };
}

function createTestInput(
  objective: string
): CoreInput {
  return {
    userId: "test-user",

    sessionId: "test-session",

    currentChatId: "test-chat",

    message: {
      id: "test-message",

      role: "user",

      text: objective,

      parts: [
        {
          type: "text",
          text: objective,
        },
      ],

      attachments: [],
    },
  };
}

function createTestHost(): CoreHost {
  return {
    async getConversation() {
      return [];
    },

    async getUserConversations() {
      return [];
    },

    async searchConversations() {
      return [];
    },

    async getDocument() {
      return null;
    },

    async createDocument() {
      throw new Error(
        "Not implemented in Core boundary test."
      );
    },

    async updateDocument() {
      throw new Error(
        "Not implemented in Core boundary test."
      );
    },

    async editDocument() {
      throw new Error(
        "Not implemented in Core boundary test."
      );
    },

    async searchWeb() {
      throw new Error(
        "Not implemented in Core boundary test."
      );
    },

    async getWeather() {
      throw new Error(
        "Not implemented in Core boundary test."
      );
    },

    async newsSearch() {
      throw new Error(
        "Not implemented in Core boundary test."
      );
    },

    async saveMemory() {
      throw new Error(
        "Not implemented in Core boundary test."
      );
    },

    async getMemories() {
      throw new Error(
        "Not implemented in Core boundary test."
      );
    },

    async searchMemory() {
      throw new Error(
        "Not implemented in Core boundary test."
      );
    },
  };
}

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

  const eventBus =
    new FakeEventBus();

  const core =
    new Core(eventBus);

  const input =
    createTestInput(objective);

  const host =
    createTestHost();

  let receivedRequest:
    | MissionRequest
    | undefined;

  const unsubscribe =
    eventBus.subscribe<MissionRequest>(
      "mission.requested",
      async (event) => {
        receivedRequest =
          event.payload;

        const result =
          createFakeMissionResult(
            event.payload.input.message.text
          );

        const completedEvent:
          DomainEvent<MissionCompletedPayload> =
          {
            id: crypto.randomUUID(),

            type: "mission.completed",

            timestamp: new Date(),

            payload: {
              requestId:
                event.payload.requestId,

              result,
            },
          };

        await eventBus.publish(
          completedEvent
        );
      }
    );

  try {
    const result =
      await core.request(
        input,
        host
      );

    if (!receivedRequest) {
      throw new Error(
        "Core did not send the mission to the Orchestrator boundary."
      );
    }

    if (
      receivedRequest.input.message.text !==
      objective
    ) {
      throw new Error(
        "Core changed the mission input before forwarding it."
      );
    }

    if (
      receivedRequest.host !== host
    ) {
      throw new Error(
        "Core did not forward the CoreHost unchanged."
      );
    }

    if (
      result.status !== "completed"
    ) {
      throw new Error(
        `Unexpected mission status: ${result.status}`
      );
    }

    if (
      result.objective !==
      objective
    ) {
      throw new Error(
        "Core returned a result with the wrong objective."
      );
    }

    console.log(
      "\n=========================================="
    );

    console.log(
      " CORE TEST"
    );

    console.log(
      "==========================================\n"
    );

    console.log(
      "✓ Core accepted the mission."
    );

    console.log(
      "✓ Core published mission.requested."
    );

    console.log(
      "✓ Core forwarded CoreInput unchanged."
    );

    console.log(
      "✓ Core forwarded CoreHost unchanged."
    );

    console.log(
      "✓ Core waited for mission.completed."
    );

    console.log(
      "✓ Core returned the Orchestrator result."
    );

    console.log(
      "\nResult:\n"
    );

    console.dir(
      result,
      {
        depth: null,
      }
    );
  } finally {
    unsubscribe();
  }
}

main().catch(
  (error) => {
    console.error(
      "\n[Core Test] FAILED\n",
      error
    );

    process.exit(1);
  }
);