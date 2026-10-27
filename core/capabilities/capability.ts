export interface Capability<TInput = unknown, TOutput = unknown> {
  readonly id: string;
  readonly name: string;
  readonly description: string;

  execute(input: TInput): Promise<TOutput>;
}