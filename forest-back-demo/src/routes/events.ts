import { Hono } from "hono";
import { requireJwt, requireScope } from "../middleware/auth.js";
import {
  createRow,
  eventResource,
  findRow,
  listRows,
  updateRow,
} from "../services/database.js";
import type { AppEnv } from "../types.js";

export const eventRoutes = new Hono<AppEnv>();

eventRoutes.use("*", requireJwt);

eventRoutes.get("/", requireScope("forest.read"), async (c) => {
  return c.json(await listRows(eventResource, {
    limit: Number(c.req.query("limit") ?? 50),
    cursor: c.req.query("cursor"),
  }));
});

eventRoutes.post("/", requireScope("forest.write"), async (c) => {
  return c.json({ data: await createRow(eventResource, await c.req.json()) }, 201);
});

eventRoutes.get("/:eventId", requireScope("forest.read"), async (c) => {
  const data = await findRow(eventResource, c.req.param("eventId"));
  return data ? c.json({ data }) : c.json({ error: { code: "NOT_FOUND", message: "사건을 찾을 수 없습니다." } }, 404);
});

eventRoutes.patch("/:eventId", requireScope("forest.write"), async (c) => {
  const data = await updateRow(eventResource, c.req.param("eventId"), await c.req.json());
  return data ? c.json({ data }) : c.json({ error: { code: "NOT_FOUND", message: "사건을 찾을 수 없습니다." } }, 404);
});

eventRoutes.post("/:eventId/status", requireScope("forest.command"), async (c) => {
  const body = await c.req.json<{ status: string }>();
  const data = await updateRow(eventResource, c.req.param("eventId"), {
    status: body.status,
    updatedAt: new Date().toISOString(),
  });
  return data ? c.json({ data }) : c.json({ error: { code: "NOT_FOUND", message: "사건을 찾을 수 없습니다." } }, 404);
});
