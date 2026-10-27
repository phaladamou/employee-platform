import type { Agent } from "./agent";

/**
 * Registry central des agents disponibles dans Core.
 *
 * Le Registry ne choisit pas l'agent.
 * Il conserve et expose les agents enregistrés.
 */
export class AgentRegistry {
  private readonly agents = new Map<string, Agent>();

  register(agent: Agent): void {
    if (this.agents.has(agent.id)) {
      throw new Error(
        `Agent already registered: ${agent.id}`
      );
    }

    this.agents.set(agent.id, agent);
  }

  get(id: string): Agent {
    const agent = this.agents.get(id);

    if (!agent) {
      throw new Error(
        `Agent not found: ${id}`
      );
    }

    return agent;
  }

  has(id: string): boolean {
    return this.agents.has(id);
  }

  list(): Agent[] {
    return Array.from(
      this.agents.values()
    );
  }
}
