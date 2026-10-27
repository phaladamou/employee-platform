import { InMemoryEventBus } from "../communication/in-memory-event-bus";
import { CapabilityRegistry } from "../capabilities/capability-registry";
import { LLMProviderRegistry } from "../models/llm-provider-registry";
import { createWebSearchCapability } from "../capabilities/web-search";

import { AgentRuntime } from "./agent-runtime";
import { ChatAgent } from "../agents/chat/chat-agent";
import type { InteractiveAgentContext } from "../agents/agent-context";

import type { CoreInput } from "../contracts/input";
import type { CoreEvent } from "../contracts/output";
import type { CoreHost } from "../contracts/host";

import type { Mission } from "../missions/mission";
import type { Task } from "../missions/task";

/**
 * ChatRuntime
 *
 * Orchestre une exécution de chat :
 * - reçoit un CoreInput
 * - crée une Mission + Task
 * - instancie le ChatAgent
 * - construit l'InteractiveAgentContext
 * - exécute l'agent
 * - émet les CoreEvent vers l'appelant
 */
export class ChatRuntime {
  private readonly eventBus: InMemoryEventBus;
  private readonly capabilities: CapabilityRegistry;
  private readonly llmProviders: LLMProviderRegistry;
  private readonly agentRuntime: AgentRuntime;

  constructor() {
    this.eventBus = new InMemoryEventBus();
    this.capabilities = new CapabilityRegistry();
    this.llmProviders = new LLMProviderRegistry();
    this.agentRuntime = new AgentRuntime();

    // Enregistrer les capabilities pures
    this.capabilities.register(createWebSearchCapability());
  }

  async execute(
    input: CoreInput,
    host: CoreHost,
    emit: (event: CoreEvent) => void
  ): Promise<void> {
    // === 1. Créer la Mission + Task ===
    const mission: Mission = {
      id: `mission-${input.sessionId}`,
      objective: input.message.text,
      status: "pending",
      tasks: [],
      createdAt: new Date(),
    };

    const task: Task = {
      id: `task-${input.message.id}`,
      missionId: mission.id,
      objective: input.message.text,
      status: "pending",
      createdAt: new Date(),
    };

    mission.tasks.push(task.id);

    // === 2. Construire l'InteractiveAgentContext ===
    const agentContext: InteractiveAgentContext = {
      eventBus: this.eventBus,
      capabilities: this.capabilities,
      llmProviders: this.llmProviders,
      mission,
      task,
      input,
      host,
      emit,
    };

    // === 3. Instancier et exécuter le ChatAgent ===
    const agent = new ChatAgent();

    await this.agentRuntime.start(agent, agentContext);

    try {
      await this.agentRuntime.execute(agent, input);
    } finally {
      await this.agentRuntime.stop(agent);
    }
  }
}