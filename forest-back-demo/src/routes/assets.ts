import { Hono } from "hono";
import { requireJwt, requireScope } from "../middleware/auth.js";
import { assetResource, createRow, listRows } from "../services/database.js";
import type { AppEnv } from "../types.js";

export const assetRoutes = new Hono<AppEnv>();

assetRoutes.use("*", requireJwt);

assetRoutes.get("/", requireScope("forest.read"), async (c) => {
  return c.json(await listRows(assetResource, {
    limit: Number(c.req.query("limit") ?? 50),
    cursor: c.req.query("cursor"),
  }));
});

assetRoutes.post("/", requireScope("forest.write"), async (c) => {
  return c.json({ data: await createRow(assetResource, await c.req.json()) }, 201);
});
