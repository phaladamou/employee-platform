import { randomUUID } from "node:crypto";

import type { CoreHost } from "./contracts/host";
import type { CoreInput } from "./contracts/input";
import type { CoreEvent } from "./contracts/output";
import type { DomainEvent } from "./communication/event";
import type { EventBus } from "./communication/event-bus";
import type { MissionResult } from "./contracts/mission-result";

interface MissionRequest {
  readonly requestId: string;
  readonly input: CoreInput;
  readonly host: CoreHost;
}

interface MissionCompletedPayload {
  readonly requestId: string;
  readonly result: MissionResult;
}

interface MissionFailedPayload {
  readonly requestId: string;
  readonly error: string;
}

/**
 * Core
 *
 * Public communication boundary of the engine.
 *
 * Core does not:
 * - plan missions
 * - select agents
 * - select capabilities
 * - select models
 * - execute tasks
 * - reason about the mission
 *
 * Core only:
 * 1. receives a request
 * 2. forwards it to the Orchestrator
 * 3. forwards execution events to the caller
 * 4. waits for the Orchestrator's final response
 * 5. returns that response
 */
export class Core {
  constructor(
    private readonly eventBus: EventBus
  ) {}

  async request(
    input: CoreInput,
    host: CoreHost,
    emit?: (event: CoreEvent) => void
  ): Promise<MissionResult> {
    const requestId = randomUUID();

    return new Promise<MissionResult>((resolve, reject) => {
      let unsubscribeCompleted: (() => void) | undefined;
      let unsubscribeFailed: (() => void) | undefined;
      let unsubscribeEvents: (() => void) | undefined;

      const cleanup = () => {
        unsubscribeCompleted?.();
        unsubscribeFailed?.();
        unsubscribeEvents?.();
      };

      if (emit) {
        unsubscribeEvents = this.eventBus.subscribe<CoreEvent>(
          `mission.event.${requestId}`,
          (event) => {
            emit(event.payload);
          }
        );
      }

      unsubscribeCompleted =
        this.eventBus.subscribe<MissionCompletedPayload>(
          "mission.completed",
          (event) => {
            if (event.payload.requestId !== requestId) {
              return;
            }

            cleanup();

            resolve(event.payload.result);
          }
        );

      unsubscribeFailed =
        this.eventBus.subscribe<MissionFailedPayload>(
          "mission.failed",
          (event) => {
            if (event.payload.requestId !== requestId) {
              return;
            }

            cleanup();

            reject(new Error(event.payload.error));
          }
        );

      const event: DomainEvent<MissionRequest> = {
        id: randomUUID(),
        type: "mission.requested",
        timestamp: new Date(),
        payload: {
          requestId,
          input,
          host,
        },
      };

      void this.eventBus.publish(event).catch((error) => {
        cleanup();
        reject(error);
      });
    });
  }
}