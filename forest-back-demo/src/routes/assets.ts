import { Hono } from "hono";
import { randomUUID } from "node:crypto";
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
  const body = await c.req.json<Record<string, unknown>>();
  const requestedId = body.assetId;
  if (requestedId !== undefined && (
    typeof requestedId !== "string"
    || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestedId)
  )) {
    return c.json({ error: { code: "INVALID_ASSET_ID", message: "assetId는 통합 UUID 형식이어야 합니다." } }, 400);
  }
  return c.json({
    data: await createRow(assetResource, { ...body, assetId: requestedId ?? randomUUID() }),
  }, 201);
});
