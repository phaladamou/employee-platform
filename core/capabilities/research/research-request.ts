export interface ResearchRequest {
  readonly question: string;
  readonly sources?: {
    readonly include?: readonly string[];
    readonly exclude?: readonly string[];
    readonly preferred?: readonly string[];
  };
}