import type { Agent } from "../agents/agent";
import type { AgentContext } from "../agents/agent-context";

export class AgentRuntime {
  async start(
    agent: Agent,
    context: AgentContext
  ): Promise<void> {
    await agent.initialize(context);
  }

  async execute(
    agent: Agent,
    input: unknown
  ): Promise<unknown> {
    return agent.execute(input);
  }

  async stop(agent: Agent): Promise<void> {
    await agent.shutdown();
  }
}