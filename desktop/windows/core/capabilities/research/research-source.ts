export type SourceType =
  | "primary"
  | "secondary"
  | "tertiary"
  | "unknown";

export interface SourceEvaluation {
  readonly score: number;
  readonly sourceType: SourceType;
  readonly credibility: number;
  readonly relevance: number;
  readonly evidenceQuality: number;
  readonly recency: number;
  readonly reasoning: string;
}

export interface ResearchSource {
  readonly title: string;
  readonly url: string;
  readonly snippet: string;
  evaluation?: SourceEvaluation;
}

export interface ResearchSearchInput {
  readonly query: string;
  readonly limit?: number;
}

export interface ResearchSearchOutput {
  readonly results: readonly ResearchSource[];
}

export interface ResearchSourceProvider {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  
  search(input: ResearchSearchInput): Promise<ResearchSearchOutput>;
}