import type { ResearchSource } from "./research-source";

export interface ResearchResult {
  readonly question: string;
  readonly status: "completed" | "failed";
  readonly summary: string;
  readonly sources: readonly ResearchSource[];
}