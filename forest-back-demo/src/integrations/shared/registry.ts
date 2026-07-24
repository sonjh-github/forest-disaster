import type { IntegrationCapability } from "./contracts.js";

export class IntegrationRegistry {
  private readonly capabilities = new Map<string, IntegrationCapability>();

  register(...items: IntegrationCapability[]) {
    for (const item of items) {
      if (this.capabilities.has(item.id)) throw new Error(`중복 연동 기능: ${item.id}`);
      this.capabilities.set(item.id, item);
    }
    return this;
  }

  get(id: string) {
    return this.capabilities.get(id);
  }

  list() {
    return [...this.capabilities.values()];
  }
}
