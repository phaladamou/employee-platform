import type { Agent } from "./agent";
import type { AgentRegistry } from "./agent-registry";
import type { Task } from "../missions/task";
import type { CoreInput } from "../contracts/input";

export class AgentSelector {
  constructor(
    private readonly registry: AgentRegistry
  ) {}

  select(task: Task, input?: CoreInput): Agent {
    const agents = this.registry.list();

    if (agents.length === 0) {
      throw new Error(`No agents available to execute task "${task.id}"`);
    }

    const agent = this.selectAgent(task, agents, input);

    if (!agent) {
      throw new Error(
        `No suitable agent found for task "${task.id}": ${task.objective}`
      );
    }

    return agent;
  }

  private selectAgent(
    task: Task,
    agents: readonly Agent[],
    input?: CoreInput
  ): Agent | undefined {
    // 1. PRIORITÉ ABSOLUE : mode explicite
    if (input?.mode === "research") {
      const researcher = agents.find(
        (a) => a.id === "researcher" || a.type === "researcher"
      );
      if (researcher) return researcher;
    }

    if (
      input?.mode === "reasoning" ||
      input?.mode === "course" ||
      input?.mode === "search"
    ) {
      const chat = agents.find((a) => a.id === "chat" || a.type === "chat");
      if (chat) return chat;
    }

    // 2. Fallback : mots-clés (comportement actuel)
    const objective = task.objective.toLowerCase();

    if (
      objective.includes("research") ||
      objective.includes("researcher") ||
      objective.includes("scientific") ||
      objective.includes("source") ||
      objective.includes("paper") ||
      objective.includes("recherche") ||
      objective.includes("étude")
    ) {
      const researcher = agents.find(
        (a) => a.id === "researcher" || a.type === "researcher"
      );
      if (researcher) return researcher;
    }

    // 3. FALLBACK FINAL : chat par défaut
    // "bonjour", "salut", "explique-moi" → chat
    const chat = agents.find((a) => a.id === "chat" || a.type === "chat");
    if (chat) return chat;

    // 4. Dernier recours
    if (agents.length === 1) return agents[0];

    return undefined;
  }
}