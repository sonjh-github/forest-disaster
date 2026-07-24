import { Hono } from "hono";
import { config, supabase } from "../config.js";
import type { AppEnv } from "../types.js";

export const healthRoutes = new Hono<AppEnv>();

healthRoutes.get("/", (c) => c.json({
  status: "ok",
  service: "forest-back-demo",
  framework: "hono",
  contractVersion: "1.0.0",
}));

healthRoutes.get("/db", async (c) => {
  const { count, error } = await supabase
    .schema(config.healthSchema)
    .from(config.healthTable)
    .select("*", { count: "exact", head: true });
  if (error) throw error;
  return c.json({ status: "ok", provider: "supabase-js", rowCount: count });
});
