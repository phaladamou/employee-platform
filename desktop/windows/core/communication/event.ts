export interface DomainEvent<T = unknown> {
  readonly id: string;
  readonly type: string;
  readonly timestamp: Date;
  readonly payload: T;
}