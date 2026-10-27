import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

import { InMemoryEventBus } from "../communication/in-memory-event-bus";
import { CapabilityRegistry } from "../capabilities/capability-registry";
import { createResearchCapability } from "../capabilities/research";
import { LLMProviderRegistry } from "../models/llm-provider-registry";
import { DeepSeekProvider } from "../models/providers/deepseek-provider";
import { AgentRuntime } from "./agent-runtime";

export class CoreRuntime {
  readonly eventBus: InMemoryEventBus;
  readonly capabilities: CapabilityRegistry;
  readonly agents: AgentRuntime;
  readonly llmProviders: LLMProviderRegistry;

  constructor() {
    this.eventBus = new InMemoryEventBus();

    // Initialiser la capacité de recherche avec ses sources
    const { researchCapability } = createResearchCapability();

    this.capabilities = new CapabilityRegistry();
    this.capabilities.register(researchCapability);

    this.llmProviders = new LLMProviderRegistry();
    this.llmProviders.register(new DeepSeekProvider());

    this.agents = new AgentRuntime();
  }
}