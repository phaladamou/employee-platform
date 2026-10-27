import { Core } from "../core";

import { ResearcherAgent } from "../agents/researcher/researcher";
import { ChatAgent } from "../agents/chat/chat-agent";

import { AgentRegistry } from "../agents/agent-registry";
import { AgentSelector } from "../agents/agent-selector";

import { BasicPlanner } from "./planner";
import { Orchestrator } from "./orchestrator";
import { CoreRuntime } from "./core-runtime";

export function createCore() {
  const runtime =
    new CoreRuntime();

  const agentRegistry =
    new AgentRegistry();

  const researcher =
    new ResearcherAgent();

  agentRegistry.register(
    researcher
  );

  const chat =
    new ChatAgent();

  agentRegistry.register(
    chat
  );

  const agentSelector =
    new AgentSelector(
      agentRegistry
    );

  const planner =
    new BasicPlanner();

  const orchestrator =
    new Orchestrator(
      runtime.agents,
      planner,
      agentSelector,
      runtime.eventBus,
      runtime.capabilities,
      runtime.llmProviders
    );

  const core =
    new Core(
      runtime.eventBus
    );

  return {
    core,
    runtime,
    agentRegistry,
    agentSelector,
    planner,
    orchestrator,
    researcher,
    chat,
  };
}