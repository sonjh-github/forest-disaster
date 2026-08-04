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
import type { AppEnv, JwtPayload, ResourceDefinition } from "../types.js";
import { assertActivePersonnelAssignment, assertRegisteredAssetId, assertReportingAuthority } from "../services/asset-identity.js";
import { writeAuditLog } from "../services/audit.js";
import { assertPersonnelPosition } from "../integrations/communications/common/rtk-gnss.js";

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
  const body = await c.req.json<{
    reportedByAssetId?: string;
    reportingRole?: "GATEWAY" | "GCS" | "NMS" | "DEVICE" | "SERVICE";
    items?: unknown[];
  }>();
  if (!Array.isArray(body.items) || body.items.length === 0 || body.items.length > 500) {
    return c.json({ error: { code: "INVALID_BATCH", message: "items는 1~500개 배열이어야 합니다." } }, 400);
  }
  const table = c.req.param("kind") === "asset-statuses" ? "asset_status" : "personnel_position";
  const deviceClaims = c.get("jwtPayload") as JwtPayload | undefined;
  if ((body.reportedByAssetId && !body.reportingRole) || (!body.reportedByAssetId && body.reportingRole)) {
    return c.json({ error: { code: "INVALID_REPORTER_CONTEXT", message: "reportedByAssetId와 reportingRole은 함께 전송해야 합니다." } }, 400);
  }
  if (deviceClaims?.assetId && deviceClaims.eventId !== c.req.param("eventId")) {
    return c.json({ error: { code: "DEVICE_EVENT_MISMATCH", message: "장치 토큰과 요청 사건이 다릅니다." } }, 403);
  }
  const effectiveReporter = body.reportedByAssetId ?? deviceClaims?.assetId;
  const effectiveRole = body.reportingRole ?? (deviceClaims?.assetId ? "DEVICE" : undefined);
  const items: Record<string, unknown>[] = body.items.map((item) => ({
    ...toDatabase(item),
    event_id: c.req.param("eventId"),
    ...(effectiveReporter ? { reported_by_asset_id: effectiveReporter, reporting_role: effectiveRole } : {}),
  }));
  if (table === "personnel_position") items.forEach(assertPersonnelPosition);
  if (deviceClaims?.assetId) {
    if (effectiveReporter !== deviceClaims.assetId) {
      return c.json({ error: { code: "REPORTER_IDENTITY_MISMATCH", message: "장치 토큰과 reportedByAssetId가 다릅니다." } }, 403);
    }
    if (deviceClaims.reportingRole && effectiveRole !== deviceClaims.reportingRole) {
      return c.json({ error: { code: "REPORTING_ROLE_MISMATCH", message: "장치 토큰과 reportingRole이 다릅니다." } }, 403);
    }
  }
  const results = await Promise.allSettled(items.map(async (item) => {
    if (table === "asset_status") {
      item.asset_id = await assertRegisteredAssetId(item.asset_id);
      if (effectiveReporter) await assertReportingAuthority(c.req.param("eventId"), effectiveReporter, item.asset_id);
    } else if (item.source_asset_id !== undefined) {
      item.source_asset_id = await assertRegisteredAssetId(item.source_asset_id);
      if (effectiveReporter) await assertReportingAuthority(c.req.param("eventId"), effectiveReporter, item.source_asset_id, "wildfire.rtk-terminal");
      await assertActivePersonnelAssignment(item.event_id, item.person_external_id, item.source_asset_id);
    }
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

resourceRoutes.get("/:eventId/timeline", requireScope("forest.read"), async (c) => {
  const to = new Date(c.req.query("to") ?? Date.now());
  const from = new Date(c.req.query("from") ?? to.getTime() - 60 * 60_000);
  const stepMinutes = Number(c.req.query("stepMinutes") ?? 1);
  if (!Number.isFinite(from.getTime()) || !Number.isFinite(to.getTime()) || from >= to) {
    return c.json({ error: { code: "INVALID_TIME_RANGE", message: "from과 to는 올바른 시간 범위여야 합니다." } }, 400);
  }
  if (to.getTime() - from.getTime() > 24 * 60 * 60_000 || stepMinutes !== 1) {
    return c.json({ error: { code: "UNSUPPORTED_TIMELINE_RANGE", message: "재생 범위는 최대 24시간, 스냅샷 간격은 1분입니다." } }, 400);
  }

  const eventId = c.req.param("eventId");
  const toIso = to.toISOString();
  const [assetResult, personnelResult] = await Promise.all([
    supabase
      .schema("core")
      .from("asset_status")
      .select("*")
      .eq("event_id", eventId)
      .lte("observed_at", toIso)
      .order("observed_at", { ascending: false })
      .limit(5_000),
    supabase
      .schema("core")
      .from("personnel_position")
      .select("*")
      .eq("event_id", eventId)
      .lte("observed_at", toIso)
      .order("observed_at", { ascending: false })
      .limit(5_000),
  ]);
  if (assetResult.error) throw assetResult.error;
  if (personnelResult.error) throw personnelResult.error;

  return c.json({
    data: {
      from: from.toISOString(),
      to: toIso,
      stepMinutes,
      assetStatuses: toApi(assetResult.data ?? []),
      personnelPositions: toApi(personnelResult.data ?? []),
    },
  });
});

resourceRoutes.get("/:eventId/network-topology", requireScope("forest.read"), async (c) => {
  const eventId = c.req.param("eventId");
  const { data: networks, error: networksError } = await supabase
    .schema("core")
    .from("communication_network")
    .select("*")
    .eq("event_id", eventId)
    .order("deployed_at", { ascending: false });
  if (networksError) throw networksError;

  const networkIds = (networks ?? []).map((network) => network.network_id);
  if (networkIds.length === 0) {
    return c.json({ data: { networks: [], nodes: [], links: [] } });
  }

  const [nodeResult, linkResult] = await Promise.all([
    supabase
      .schema("core")
      .from("communication_topology_node")
      .select("*")
      .in("network_id", networkIds)
      .order("sort_order", { ascending: true }),
    supabase
      .schema("core")
      .from("communication_topology_link")
      .select("*")
      .in("network_id", networkIds)
      .order("priority", { ascending: true }),
  ]);
  if (nodeResult.error) throw nodeResult.error;
  if (linkResult.error) throw linkResult.error;

  return c.json({
    data: {
      networks: toApi(networks ?? []),
      nodes: toApi(nodeResult.data ?? []),
      links: toApi(linkResult.data ?? []),
    },
  });
});

resourceRoutes.get("/:eventId/:resource", requireScope("forest.read"), async (c) => {
  const resource = fixedResources[c.req.param("resource")] ?? commonResources[c.req.param("resource")];
  if (!resource) return c.json({ error: { code: "NOT_FOUND", message: "지원하지 않는 자원입니다." } }, 404);
  return c.json(await listRows(resource, { eventId: c.req.param("eventId"), ...page(c) }));
});

resourceRoutes.post("/:eventId/:resource", requireScope("forest.write"), async (c) => {
  const resource = fixedResources[c.req.param("resource")] ?? commonResources[c.req.param("resource")];
  if (!resource) return c.json({ error: { code: "NOT_FOUND", message: "지원하지 않는 자원입니다." } }, 404);
  if (c.req.param("resource") === "audit-logs") {
    return c.json({ error: { code: "READ_ONLY_RESOURCE", message: "감사기록은 서버가 생성하며 API에서 직접 등록할 수 없습니다." } }, 405);
  }
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
  if (data) await writeAuditLog(c, {
    eventId: c.req.param("eventId"), action: "TASK_STATUS_CHANGED",
    targetType: "task", targetId: c.req.param("resourceId"), afterValue: data,
  });
  return data ? c.json({ data }) : c.json({ error: { code: "NOT_FOUND", message: "작업을 찾을 수 없습니다." } }, 404);
});

resourceRoutes.post("/:eventId/recommendations/:resourceId/decision", requireScope("forest.command"), async (c) => {
  const body = await c.req.json<{ decision: string; decidedAt: string }>();
  const data = await updateRow(commonResources.recommendations as ResourceDefinition, c.req.param("resourceId"), {
    status: body.decision,
    decidedAt: body.decidedAt,
  }, c.req.param("eventId"));
  if (data) await writeAuditLog(c, {
    eventId: c.req.param("eventId"), action: "RECOMMENDATION_DECIDED",
    targetType: "recommendation", targetId: c.req.param("resourceId"), afterValue: data,
  });
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
  await writeAuditLog(c, {
    eventId: c.req.param("eventId"), action: "ALERT_ISSUED",
    targetType: "alert", targetId: c.req.param("alertId"),
    afterValue: { alert, recipients: body.recipients },
  });
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
  if (data) await writeAuditLog(c, {
    eventId: c.req.param("eventId"), action: "ALERT_ACKNOWLEDGED",
    targetType: "alert_delivery", targetId: c.req.param("alertId"), afterValue: toApi(data),
  });
  return data ? c.json({ data: toApi(data) }) : c.json({ error: { code: "NOT_FOUND", message: "경보 수신 대상을 찾을 수 없습니다." } }, 404);
});
