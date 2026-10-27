import type { DomainEvent } from "./event";

export type EventHandler<T = unknown> = (
  event: DomainEvent<T>
) => void | Promise<void>;

export interface EventBus {
  publish<T>(event: DomainEvent<T>): Promise<void>;

  subscribe<T>(
    eventType: string,
    handler: EventHandler<T>
  ): () => void;
}