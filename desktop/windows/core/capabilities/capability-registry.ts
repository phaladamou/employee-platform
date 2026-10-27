import type { Capability } from "./capability";

export class CapabilityRegistry {
  private readonly capabilities = new Map<string, Capability>();

  register(capability: Capability): void {
    if (this.capabilities.has(capability.id)) {
      throw new Error(
        `Capability already registered: ${capability.id}`
      );
    }

    this.capabilities.set(capability.id, capability);
  }

  get(id: string): Capability {
    const capability = this.capabilities.get(id);

    if (!capability) {
      throw new Error(`Capability not found: ${id}`);
    }

    return capability;
  }

  has(id: string): boolean {
    return this.capabilities.has(id);
  }

  list(): Capability[] {
    return Array.from(this.capabilities.values());
  }
}