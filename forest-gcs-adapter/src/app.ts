import { Hono } from "hono";
import { cors } from "hono/cors";
import { config } from "./config.js";
import { ForestApiClient } from "./forest-api-client.js";
import { monitorPage } from "./monitor-page.js";
import { TelemetryStore } from "./telemetry-store.js";
import type { AdapterCommand, DroneTelemetry } from "./types.js";
import { normalizeAssetIdentity } from "./asset-identity.js";

export function createApp(store: TelemetryStore, client: ForestApiClient) {
  const app = new Hono();
  app.use("*", cors({
    origin: ["http://127.0.0.1:15173", "http://localhost:15173"],
    allowMethods: ["GET", "POST", "OPTIONS"],
  }));

  app.get("/", (c) => c.html(monitorPage));

  app.get("/health", (c) => c.json({
    status: client.status().connected ? "ok" : "degraded",
    service: "forest-gcs-adapter",
    instance: { host: config.host, port: config.port, mavlinkPort: config.mavlinkPort },
    bridge: client.status(),
  }));
  app.get("/bridge/status", async (c) => c.json({ data: await client.probe() }));
  app.get("/telemetry", (c) => c.json({ data: store.get().map(normalizeAssetIdentity) }));
  app.get("/telemetry/:assetId", (c) => {
    const data = store.get().map(normalizeAssetIdentity).find((item) => item.assetId === c.req.param("assetId")) ?? null;
    return c.json({ data });
  });

  app.post("/telemetry", async (c) => {
    const body = await c.req.json<DroneTelemetry>();
    if (!body.assetId || !body.observedAt || body.geometry?.type !== "Point") {
      return c.json({ error: { code: "INVALID_TELEMETRY", message: "assetId, observedAt, Point geometry가 필요합니다." } }, 400);
    }
    store.update({ ...body, attributes: { ...body.attributes, source: "HTTP" } });
    return c.json({ data: { accepted: true } }, 200);
  });

  app.post("/command", async (c) => {
    const envelope = await c.req.json<{ data?: AdapterCommand } & AdapterCommand>();
    const command = envelope.data ?? envelope;
    const commandName = String(command.command ?? "").toUpperCase();
    if (commandName === "PING" || commandName === "STATUS") {
      return c.json({ data: { accepted: true, command: commandName, telemetry: store.get() } }, 200);
    }
    return c.json({
      error: {
        code: "FLIGHT_COMMAND_DISABLED",
        message: "실기체 규격과 안전 승인 전에는 비행 제어 명령을 전송하지 않습니다.",
      },
    }, 501);
  });

  app.notFound((c) => c.json({ error: { code: "NOT_FOUND", message: "지원하지 않는 경로입니다." } }, 404));
  return app;
}
