import { Hono, type Context } from "hono";
import { supabase } from "../config.js";
import { requireJwt, requireScope } from "../middleware/auth.js";
import {
  commonResources,
  createRow,
  landslideResources,
  listRows,
  updateRow,
  toApi,
  toDatabase,
  wildfireResources,
} from "../services/database.js";
import type { AppEnv, ResourceDefinition } from "../types.js";

export const resourceRoutes = new Hono<AppEnv>();

resourceRoutes.use("*", requireJwt);

const fixedResources: Record<string, ResourceDefinition> = {
  resources: { schema: "core", table: "event_resource", id: "event_resource_id", orderBy: "assigned_at" },
  networks: { schema: "core", table: "communication_network", id: "network_id", orderBy: "deployed_at" },
  "situation-reports": { schema: "core", table: "situation_report", id: "report_id", orderBy: "reported_at" },
  alerts: { schema: "core", table: "alert", id: "alert_id", orderBy: "created_at" },
};

function page(c: Context<AppEnv>) {
  return {
    limit: Number(c.req.query("limit") ?? 50),
    cursor: c.req.query("cursor"),
  };
}

resourceRoutes.post("/:eventId/:kind{asset-statuses|personnel-positions}:batch", requireScope("forest.ingest"), async (c) => {
  const body = await c.req.json<{ items?: unknown[] }>();
  const table = c.req.param("kind") === "asset-statuses" ? "asset_status" : "personnel_position";
  const items = (body.items ?? []).map((item) => ({ ...toDatabase(item), event_id: c.req.param("eventId") }));
  const results = await Promise.allSettled(items.map(async (item) => {
    const { data, error } = await supabase.schema("core").from(table).insert(item).select("*").single();
    if (error) throw error;
    return toApi(data);
  }));
  return c.json({ data: results.map((result, index) => result.status === "fulfilled"
    ? { index, success: true, data: result.value }
    : { index, success: false, error: { code: "ITEM_REJECTED", message: result.reason instanceof Error ? result.reason.message : "Rejected" } }) });
});

resourceRoutes.get("/:eventId/:kind{asset-statuses|personnel-positions}/latest", requireScope("forest.read"), async (c) => {
  const table = c.req.param("kind") === "asset-statuses" ? "asset_status" : "personnel_position";
  const definition: ResourceDefinition = { schema: "core", table, id: table === "asset_status" ? "asset_status_id" : "position_id", orderBy: "observed_at" };
  return c.json(await listRows(definition, { eventId: c.req.param("eventId"), ...page(c) }));
});

resourceRoutes.get("/:eventId/:resource", requireScope("forest.read"), async (c) => {
  const resource = fixedResources[c.req.param("resource")] ?? commonResources[c.req.param("resource")];
  if (!resource) return c.json({ error: { code: "NOT_FOUND", message: "지원하지 않는 자원입니다." } }, 404);
  return c.json(await listRows(resource, { eventId: c.req.param("eventId"), ...page(c) }));
});

resourceRoutes.post("/:eventId/:resource", requireScope("forest.write"), async (c) => {
  const resource = fixedResources[c.req.param("resource")] ?? commonResources[c.req.param("resource")];
  if (!resource) return c.json({ error: { code: "NOT_FOUND", message: "지원하지 않는 자원입니다." } }, 404);
  return c.json({ data: await createRow(resource, await c.req.json(), c.req.param("eventId")) }, 201);
});

resourceRoutes.get("/:eventId/:domain/:resource", requireScope("forest.read"), async (c) => {
  const definitions = c.req.param("domain") === "wildfire" ? wildfireResources
    : c.req.param("domain") === "landslide" ? landslideResources : {};
  const resource = definitions[c.req.param("resource")];
  if (!resource) return c.json({ error: { code: "NOT_FOUND", message: "지원하지 않는 도메인 자원입니다." } }, 404);
  return c.json(await listRows(resource, { eventId: c.req.param("eventId"), ...page(c) }));
});

resourceRoutes.post("/:eventId/:domain/:resource", requireScope("forest.write"), async (c) => {
  const definitions = c.req.param("domain") === "wildfire" ? wildfireResources
    : c.req.param("domain") === "landslide" ? landslideResources : {};
  const resource = definitions[c.req.param("resource")];
  if (!resource) return c.json({ error: { code: "NOT_FOUND", message: "지원하지 않는 도메인 자원입니다." } }, 404);
  return c.json({ data: await createRow(resource, await c.req.json(), c.req.param("eventId")) }, 201);
});

resourceRoutes.post("/:eventId/tasks/:resourceId/status", requireScope("forest.command"), async (c) => {
  const data = await updateRow(commonResources.tasks as ResourceDefinition, c.req.param("resourceId"), await c.req.json(), c.req.param("eventId"));
  return data ? c.json({ data }) : c.json({ error: { code: "NOT_FOUND", message: "작업을 찾을 수 없습니다." } }, 404);
});

resourceRoutes.post("/:eventId/recommendations/:resourceId/decision", requireScope("forest.command"), async (c) => {
  const body = await c.req.json<{ decision: string; decidedAt: string }>();
  const data = await updateRow(commonResources.recommendations as ResourceDefinition, c.req.param("resourceId"), {
    status: body.decision,
    decidedAt: body.decidedAt,
  }, c.req.param("eventId"));
  return data ? c.json({ data }) : c.json({ error: { code: "NOT_FOUND", message: "권고안을 찾을 수 없습니다." } }, 404);
});

resourceRoutes.post("/:eventId/alerts/:alertId/issue", requireScope("forest.command"), async (c) => {
  const body = await c.req.json<{ issuedAt: string; expiresAt?: string | null; recipients: Array<Record<string, unknown>> }>();
  const alert = await updateRow(fixedResources.alerts!, c.req.param("alertId"), {
    status: "ISSUED",
    issuedAt: body.issuedAt,
    expiresAt: body.expiresAt ?? null,
  }, c.req.param("eventId"));
  if (!alert) return c.json({ error: { code: "NOT_FOUND", message: "경보를 찾을 수 없습니다." } }, 404);
  const deliveries = body.recipients.map((recipient) => ({
    ...toDatabase(recipient),
    alert_id: c.req.param("alertId"),
    delivery_status: "QUEUED",
  }));
  const { error } = await supabase.schema("core").from("alert_delivery").insert(deliveries);
  if (error) throw error;
  return c.json({ data: alert });
});

resourceRoutes.post("/:eventId/alerts/:alertId/acknowledge", requireScope("forest.command"), async (c) => {
  const body = await c.req.json<{ recipientType: string; recipientKey: string; acknowledgedAt: string }>();
  const { data, error } = await supabase
    .schema("core")
    .from("alert_delivery")
    .update({ acknowledged_at: body.acknowledgedAt })
    .eq("alert_id", c.req.param("alertId"))
    .eq("recipient_type", body.recipientType)
    .eq("recipient_key", body.recipientKey)
    .select("*")
    .maybeSingle();
  if (error) throw error;
  return data ? c.json({ data: toApi(data) }) : c.json({ error: { code: "NOT_FOUND", message: "경보 수신 대상을 찾을 수 없습니다." } }, 404);
});
