import { serve } from "@hono/node-server";
import { createApp } from "./app.js";
import { config } from "./config.js";
import { ForestApiClient } from "./forest-api-client.js";
import { logger } from "./logger.js";
import { MavlinkUdpReceiver } from "./mavlink/udp-receiver.js";
import { startSimulation } from "./simulation.js";
import { TelemetryStore } from "./telemetry-store.js";

const store = new TelemetryStore();
const client = new ForestApiClient();
void client.probe();
let sending = false;
let pending = false;
let latest = store.get()[0];

store.subscribe((telemetry) => {
  latest = telemetry;
  pending = true;
  if (sending) return;
  sending = true;
  void (async () => {
    while (pending && latest && typeof latest === "object" && !Array.isArray(latest)) {
      pending = false;
      try {
        await client.send(latest);
      } catch (error) {
        logger.error("FOREST-API", "상태 전송 실패", { error: error instanceof Error ? error.message : String(error) });
      }
    }
    sending = false;
  })();
});

const receiver = new MavlinkUdpReceiver(config.mavlinkHost, config.mavlinkPort, store);
if (config.mavlinkEnabled) receiver.start();
const stopSimulation = config.simulationEnabled
  ? startSimulation(store, config.forestAssetId, config.simulationIntervalMs)
  : () => undefined;

const server = serve({ fetch: createApp(store, client).fetch, hostname: config.host, port: config.port }, () => {
  logger.ok("GCS-ADAPTER", `HTTP ${config.host}:${config.port} 실행`);
  logger.info("GCS-ADAPTER", `모드 ${config.mavlinkEnabled ? "MAVLINK" : config.simulationEnabled ? "SIMULATION" : "HTTP"}`);
});

function shutdown() {
  stopSimulation();
  receiver.stop();
  server.close(() => process.exit(0));
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
