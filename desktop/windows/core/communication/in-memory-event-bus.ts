import type { DomainEvent } from "./event";
import type { EventBus, EventHandler } from "./event-bus";

export class InMemoryEventBus implements EventBus {
  private readonly handlers = new Map<
    string,
    Set<EventHandler>
  >();

  async publish<T>(event: DomainEvent<T>): Promise<void> {
    const handlers = this.handlers.get(event.type);

    if (!handlers) {
      return;
    }

    await Promise.all(
      Array.from(handlers).map((handler) => handler(event))
    );
  }

  subscribe<T>(
    eventType: string,
    handler: EventHandler<T>
  ): () => void {
    const handlers = this.handlers.get(eventType) ?? new Set();

    handlers.add(handler as EventHandler);
    this.handlers.set(eventType, handlers);

    return () => {
      handlers.delete(handler as EventHandler);

      if (handlers.size === 0) {
        this.handlers.delete(eventType);
      }
    };
  }
}