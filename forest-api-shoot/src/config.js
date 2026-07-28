function positiveNumber(name, fallback) {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${name} must be a positive number`);
  return value;
}

export function loadConfig() {
  const dryRun = process.env.SIMULATOR_DRY_RUN === "true";
  const config = {
    dryRun,
    apiBaseUrl: process.env.API_BASE_URL?.replace(/\/$/, ""),
    fieldSimulatorUrl: (process.env.FIELD_SIMULATOR_URL ?? "http://127.0.0.1:8788").replace(/\/$/, ""),
    controlKey: process.env.SIMULATOR_CONTROL_KEY,
    requireControlKey: process.env.SIMULATOR_REQUIRE_CONTROL_KEY !== "false",
    host: process.env.SIMULATOR_HOST ?? "0.0.0.0",
    port: positiveNumber("PORT", positiveNumber("SIMULATOR_PORT", 8787)),
    requestTimeoutMs: 5_000,
  };
  if (config.requireControlKey && (!config.controlKey || config.controlKey.length < 8)) {
    throw new Error("SIMULATOR_CONTROL_KEY must contain at least 8 characters");
  }
  if (!dryRun && !config.apiBaseUrl) {
    throw new Error("API_BASE_URL is required unless SIMULATOR_DRY_RUN=true");
  }
  return config;
}
