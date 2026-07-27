import type { DroneTelemetry } from "./types.js";

export class TelemetryStore {
  #latest = new Map<string, DroneTelemetry>();
  #listeners = new Set<(telemetry: DroneTelemetry) => void>();

  update(telemetry: DroneTelemetry) {
    this.#latest.set(telemetry.assetId, telemetry);
    for (const listener of this.#listeners) listener(telemetry);
  }

  get(): DroneTelemetry[];
  get(assetId: string): DroneTelemetry | null;
  get(assetId?: string): DroneTelemetry[] | DroneTelemetry | null {
    if (assetId !== undefined) return this.#latest.get(assetId) ?? null;
    return [...this.#latest.values()].sort((a, b) => b.observedAt.localeCompare(a.observedAt));
  }

  subscribe(listener: (telemetry: DroneTelemetry) => void) {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }
}
