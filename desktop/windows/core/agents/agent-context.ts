import type { EventBus } from "../communication/event-bus";
import type { CapabilityRegistry } from "../capabilities/capability-registry";
import type { LLMProviderRegistry } from "../models/llm-provider-registry";
import type { Mission } from "../missions/mission";
import type { Task } from "../missions/task";

import type { CoreHost } from "../contracts/host";
import type { CoreInput } from "../contracts/input";
import type { CoreEvent } from "../contracts/output";

export type CoreEmitter = (
  event: CoreEvent
) => void;

export interface AgentContext {
  readonly eventBus: EventBus;
  readonly capabilities: CapabilityRegistry;
  readonly llmProviders: LLMProviderRegistry;
  readonly mission: Mission;
  readonly task: Task;

  /**
   * Original request received by Core.
   *
   * Available when the agent is executed
   * through the Core/Orchestrator path.
   */
  readonly input?: CoreInput;

  /**
   * Application bridge.
   *
   * Available when the agent is executed
   * through an application-backed Core.
   */
  readonly host?: CoreHost;

  /**
   * Event emitter used to stream execution
   * events back to the caller.
   */
  readonly emit?: CoreEmitter;
}

/**
 * Compatibility context for interactive agents.
 *
 * This will disappear once ChatAgent is fully
 * migrated to the normal Agent/Orchestrator path.
 */
export interface InteractiveAgentContext
  extends AgentContext {
  readonly input: CoreInput;
  readonly host: CoreHost;
  readonly emit: CoreEmitter;
}