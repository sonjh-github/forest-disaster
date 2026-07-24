import { Hono } from "hono";
import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";
import { config } from "./config.js";
import { assetRoutes } from "./routes/assets.js";
import { eventRoutes } from "./routes/events.js";
import { externalRoutes } from "./routes/external.js";
import { healthRoutes } from "./routes/health.js";
import { resourceRoutes } from "./routes/resources.js";
import { simulatorRoutes } from "./routes/simulator.js";
import { integrationRoutes } from "./routes/integrations.js";
import type { ApiErrorBody, AppEnv } from "./types.js";
import { randomUUID } from "node:crypto";
import { serverLogger } from "./logger.js";

export const app = new Hono<AppEnv>();
const corsOrigins = config.corsOrigin.split(",").map((origin) => origin.trim()).filter(Boolean);

app.use("*", async (c, next) => {
  const startedAt = Date.now();
  const traceId = c.req.header("x-request-id") ?? randomUUID();
  const origin = c.req.header("x-origin") ?? c.req.header("origin") ?? "unknown";
  c.header("X-Request-Id", traceId);
  try {
    await next();
    serverLogger.info(origin, "http.request.complete", {
      traceId,
      method: c.req.method,
      path: c.req.path,
      status: c.res.status,
      durationMs: Date.now() - startedAt,
    });
  } catch (error) {
    serverLogger.error(origin, "http.request.failed", {
      traceId,
      method: c.req.method,
      path: c.req.path,
      durationMs: Date.now() - startedAt,
      message: error instanceof Error ? error.message : "Unknown error",
    });
    throw error;
  }
});
app.use("*", secureHeaders());
app.use("*", cors({
  origin: corsOrigins.includes("*") ? "*" : corsOrigins,
  allowHeaders: ["Authorization", "Content-Type", "Idempotency-Key", "If-Match", "X-Origin", "X-Request-Id"],
  allowMethods: ["GET", "POST", "PATCH", "OPTIONS"],
  exposeHeaders: ["ETag"],
}));

app.route("/health", healthRoutes);
app.route("/api/v1/events", eventRoutes);
app.route("/api/v1/assets", assetRoutes);
app.route("/api/v1/events", resourceRoutes);
app.route("/api/v1", externalRoutes);
app.route("/api/v1/simulator", simulatorRoutes);
app.route("/api/v1/integrations", integrationRoutes);

app.notFound((c) => c.json({ error: { code: "NOT_FOUND", message: "Route not found" } }, 404));

app.onError((error, c) => {
  const body: ApiErrorBody = {
    error: {
      code: "API_ERROR",
      message: error.message,
      traceId: randomUUID(),
    },
  };
  return c.json(body, 500);
});
