import type { AgentContext } from "./agent-context";

export interface Agent {
  readonly id: string;
  readonly type: string;

  initialize(context: AgentContext): Promise<void>;

  execute(input: unknown): Promise<unknown>;

  shutdown(): Promise<void>;
}
