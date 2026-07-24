import { serve } from "@hono/node-server";
import { app } from "./app.js";
import { config } from "./config.js";
import { serverLogger } from "./logger.js";

const server = serve({
  fetch: app.fetch,
  hostname: config.host,
  port: config.port,
});

serverLogger.info("server", "listening", { path: `http://${config.host}:${config.port}` });

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    server.close(() => process.exit(0));
  });
}
