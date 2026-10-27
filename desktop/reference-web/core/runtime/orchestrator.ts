import { randomUUID } from "node:crypto";

import type { AgentContext } from "../agents/agent-context";
import type { AgentSelector } from "../agents/agent-selector";
import type { AgentRuntime } from "./agent-runtime";

import type { CapabilityRegistry } from "../capabilities/capability-registry";
import type { EventBus } from "../communication/event-bus";
import type { LLMProviderRegistry } from "../models/llm-provider-registry";

import type { Mission } from "../missions/mission";
import type { Task } from "../missions/task";

import type { CoreHost } from "../contracts/host";
import type { CoreInput } from "../contracts/input";
import type { CoreEvent } from "../contracts/output";
import type { MissionResult } from "../contracts/mission-result";

import {
  addTask,
  completeMission,
  createMission,
  failMission,
  startMission,
  startPlanning,
} from "../missions/mission";

import {
  completeTask,
  failTask,
  startTask,
} from "../missions/task";

interface MissionRequest {
  readonly requestId: string;
  readonly input: CoreInput;
  readonly host: CoreHost;
}

export interface TaskPlan {
  readonly id: string;
  readonly objective: string;
}

export interface MissionPlan {
  readonly tasks: readonly TaskPlan[];
}

export class Orchestrator {
  constructor(
    private readonly agentRuntime: AgentRuntime,
    private readonly planner: {
      plan(
        mission: Mission
      ): Promise<MissionPlan>;
    },
    private readonly agentSelector: AgentSelector,
    private readonly eventBus: EventBus,
    private readonly capabilities: CapabilityRegistry,
    private readonly llmProviders: LLMProviderRegistry
  ) {
    this.listenForMissions();
  }

  private listenForMissions(): void {
    this.eventBus.subscribe<MissionRequest>(
      "mission.requested",
      async (event) => {
        const {
          requestId,
          input,
          host,
        } = event.payload;

        const objective =
          input.message.text;

        await this.eventBus.publish({
          id: randomUUID(),
          type: "mission.received",
          timestamp: new Date(),
          payload: {
            requestId,
            objective,
          },
        });

        try {
          const result =
            await this.runMission(
              input,
              host,
              requestId
            );

          await this.eventBus.publish({
            id: randomUUID(),
            type: "mission.completed",
            timestamp: new Date(),
            payload: {
              requestId,
              result,
            },
          });
        } catch (error) {
          const message =
            error instanceof Error
              ? error.message
              : String(error);

          await this.eventBus.publish({
            id: randomUUID(),
            type: "mission.failed",
            timestamp: new Date(),
            payload: {
              requestId,
              error: message,
            },
          });
        }
      }
    );
  }

  private async runMission(
    input: CoreInput,
    host: CoreHost,
    requestId: string
  ): Promise<MissionResult> {
    const objective =
      input.message.text;

    const mission =
      createMission({
        id: randomUUID(),
        objective,
      });

    let tasks: Task[] = [];

    try {
      startPlanning(mission);

      await this.eventBus.publish({
        id: randomUUID(),
        type: "mission.planning.started",
        timestamp: new Date(),
        payload: {
          requestId,
          missionId: mission.id,
        },
      });

      const plan =
        await this.planner.plan(
          mission
        );

      tasks =
        this.createTasks(
          mission,
          plan,
          requestId
        );

      await this.eventBus.publish({
        id: randomUUID(),
        type: "mission.planned",
        timestamp: new Date(),
        payload: {
          requestId,
          missionId: mission.id,
          taskCount: tasks.length,
        },
      });

      startMission(mission);

      for (const task of tasks) {
        await this.executeTask(
          mission,
          task,
          input,
          host,
          requestId
        );
      }

      const results =
        tasks.map((task) => ({
          taskId: task.id,
          result: task.result,
        }));

      completeMission(
        mission,
        results
      );

      return this.createResult(
        mission,
        tasks
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : String(error);

      if (
        mission.status !==
          "completed" &&
        mission.status !==
          "cancelled"
      ) {
        failMission(
          mission,
          message
        );
      }

      throw error;
    }
  }

  private createTasks(
    mission: Mission,
    plan: MissionPlan,
    requestId: string
  ): Task[] {
    const tasks: Task[] = [];

    for (const taskPlan of plan.tasks) {
      const task: Task = {
        id: taskPlan.id,
        missionId: mission.id,
        objective:
          taskPlan.objective,
        status: "pending",
        createdAt: new Date(),
      };

      addTask(
        mission,
        task.id
      );

      tasks.push(task);

      void this.eventBus.publish({
        id: randomUUID(),
        type: "task.created",
        timestamp: new Date(),
        payload: {
          requestId,
          missionId: mission.id,
          taskId: task.id,
          objective:
            task.objective,
        },
      });
    }

    return tasks;
  }

  private createContext(
    mission: Mission,
    task: Task,
    input: CoreInput,
    host: CoreHost,
    requestId: string
  ): AgentContext {
    return {
      eventBus:
        this.eventBus,

      capabilities:
        this.capabilities,

      llmProviders:
        this.llmProviders,

      mission,

      task,

      input,

      host,

      emit: (event: CoreEvent) => {
        void this.eventBus.publish({
          id: randomUUID(),
          type: `mission.event.${requestId}`,
          timestamp: new Date(),
          payload: event,
        });
      },
    };
  }

  private async executeTask(
    mission: Mission,
    task: Task,
    input: CoreInput,
    host: CoreHost,
    requestId: string
  ): Promise<void> {
    startTask(task);

    await this.eventBus.publish({
      id: randomUUID(),
      type: "task.started",
      timestamp: new Date(),
      payload: {
        requestId,
        missionId: mission.id,
        taskId: task.id,
        objective:
          task.objective,
      },
    });

    const agent =
      this.agentSelector.select(
        task
      );

    await this.eventBus.publish({
      id: randomUUID(),
      type: "agent.selected",
      timestamp: new Date(),
      payload: {
        requestId,
        missionId: mission.id,
        taskId: task.id,
        agentId: agent.id,
        agentType: agent.type,
      },
    });

    const context =
      this.createContext(
        mission,
        task,
        input,
        host,
        requestId
      );

    let started = false;

    try {
      await this.agentRuntime.start(
        agent,
        context
      );

      started = true;

      await this.eventBus.publish({
        id: randomUUID(),
        type: "agent.started",
        timestamp: new Date(),
        payload: {
          requestId,
          missionId: mission.id,
          taskId: task.id,
          agentId: agent.id,
        },
      });

      const result =
        await this.agentRuntime.execute(
          agent,
          {
            objective:
              task.objective,
          }
        );

      completeTask(
        task,
        result
      );

      await this.eventBus.publish({
        id: randomUUID(),
        type: "task.completed",
        timestamp: new Date(),
        payload: {
          requestId,
          missionId: mission.id,
          taskId: task.id,
          result,
        },
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : String(error);

      failTask(
        task,
        message
      );

      await this.eventBus.publish({
        id: randomUUID(),
        type: "task.failed",
        timestamp: new Date(),
        payload: {
          requestId,
          missionId: mission.id,
          taskId: task.id,
          error: message,
        },
      });

      throw error;
    } finally {
      if (started) {
        await this.agentRuntime.stop(
          agent
        );
      }
    }
  }

  private createResult(
    mission: Mission,
    tasks: readonly Task[]
  ): MissionResult {
    return {
      missionId:
        mission.id,

      status:
        mission.status,

      objective:
        mission.objective,

      tasks,

      result:
        mission.result,

      error:
        mission.error,
    };
  }
}