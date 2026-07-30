function numberValue(name: string, fallback: number) {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function booleanValue(name: string, fallback: boolean) {
  const value = process.env[name]?.trim().toLowerCase();
  if (!value) return fallback;
  return ["1", "true", "yes", "on"].includes(value);
}

export const config = {
  host: process.env.HOST?.trim() || "127.0.0.1",
  port: numberValue("PORT", 18890),
  mavlinkHost: process.env.MAVLINK_HOST?.trim() || "127.0.0.1",
  mavlinkPort: numberValue("MAVLINK_PORT", 14550),
  mavlinkEnabled: booleanValue("MAVLINK_ENABLED", false),
  simulationEnabled: booleanValue("SIMULATION_ENABLED", true),
  simulationIntervalMs: numberValue("SIMULATION_INTERVAL_MS", 1000),
  forestApiUrl: (process.env.FOREST_API_URL?.trim() || "http://127.0.0.1:18000").replace(/\/$/, ""),
  forestWebUrl: (process.env.FOREST_WEB_URL?.trim() || "http://127.0.0.1:15173").replace(/\/$/, ""),
  forestSimulatorUrl: (process.env.FOREST_SIMULATOR_URL?.trim() || "http://127.0.0.1:18787").replace(/\/$/, ""),
  forestApiToken: process.env.FOREST_API_TOKEN?.trim() || "",
  forestEventId: process.env.FOREST_EVENT_ID?.trim() || "",
  forestEventType: process.env.FOREST_EVENT_TYPE?.trim().toUpperCase() || "LANDSLIDE",
  integrationCapabilityId: process.env.INTEGRATION_CAPABILITY_ID?.trim() || "landslide.gcs",
  forestAssetId: process.env.FOREST_ASSET_ID?.trim() || "DRONE-01",
  sourceSystem: process.env.SOURCE_SYSTEM?.trim() || "forest-gcs-adapter",
};
