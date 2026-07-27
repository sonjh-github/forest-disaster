import { config } from "./config.js";
import type { DroneTelemetry } from "./types.js";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function unifiedAssetId(fallbackAssetId: string) {
  return UUID_PATTERN.test(config.forestAssetId) ? config.forestAssetId.toLowerCase() : fallbackAssetId;
}

export function normalizeAssetIdentity(telemetry: DroneTelemetry): DroneTelemetry {
  const assetId = unifiedAssetId(telemetry.assetId);
  return assetId === telemetry.assetId ? telemetry : {
    ...telemetry,
    assetId,
    attributes: {
      ...telemetry.attributes,
      sourceAssetId: telemetry.assetId,
    },
  };
}
