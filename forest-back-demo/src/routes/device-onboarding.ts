import { createHash, randomBytes, randomUUID } from "node:crypto";
import { Hono } from "hono";
import { supabase } from "../config.js";
import { requireJwt, requireScope } from "../middleware/auth.js";
import { writeAuditLog } from "../services/audit.js";
import { toApi, toDatabase } from "../services/database.js";
import { assertAssetUuid, assertRegisteredAssetId } from "../services/asset-identity.js";
import type { AppEnv } from "../types.js";
import { sign } from "hono/jwt";
import { config } from "../config.js";
import { integrationRegistry } from "../integrations/catalog.js";

export const deviceOnboardingRoutes = new Hono<AppEnv>();
const hashCredential = (secret: string) => createHash("sha256").update(secret, "utf8").digest("hex");

deviceOnboardingRoutes.post("/assets/:assetId/credentials", requireJwt, requireScope("forest.asset.admin"), async (c) => {
  const assetId = c.req.param("assetId");
  assertAssetUuid(assetId);
  const body = await c.req.json<{ credentialType?: "API_KEY" | "CERTIFICATE"; expiresAt?: string }>();
  if ((body.credentialType ?? "API_KEY") !== "API_KEY") {
    return c.json({ error: { code: "CERTIFICATE_PROVISIONING_EXTERNAL", message: "인증서는 기관 PKI에서 발급하고 지문만 별도 등록해야 합니다." } }, 400);
  }
  if (body.expiresAt && Number.isNaN(Date.parse(body.expiresAt))) {
    return c.json({ error: { code: "INVALID_EXPIRY", message: "expiresAt은 ISO 8601 시각이어야 합니다." } }, 400);
  }
  if (body.expiresAt && Date.parse(body.expiresAt) <= Date.now()) {
    return c.json({ error: { code: "INVALID_EXPIRY", message: "expiresAt은 현재보다 미래여야 합니다." } }, 400);
  }
  const { data: asset, error: assetError } = await supabase.schema("core").from("asset")
    .select("asset_id,status").eq("asset_id", assetId).maybeSingle();
  if (assetError) throw assetError;
  if (!asset) return c.json({ error: { code: "ASSET_NOT_FOUND", message: "사전등록된 장치를 찾을 수 없습니다." } }, 404);
  if (["SUSPENDED", "LOST", "RETIRED"].includes(asset.status)) {
    return c.json({ error: { code: "DEVICE_NOT_OPERATIONAL", message: "정지·분실·폐기 장치에는 인증정보를 발급할 수 없습니다." } }, 409);
  }
  const secret = `fd_${randomBytes(32).toString("base64url")}`;
  const credentialId = randomUUID();
  const { data, error } = await supabase.schema("core").from("device_credential").insert({
    credential_id: credentialId, asset_id: assetId, credential_type: "API_KEY_HASH",
    credential_hash: hashCredential(secret), status: "ACTIVE", expires_at: body.expiresAt ?? null,
  }).select("credential_id,asset_id,credential_type,status,issued_at,expires_at").single();
  if (error) throw error;
  await writeAuditLog(c, { action: "DEVICE_CREDENTIAL_ISSUED", targetType: "device_credential", targetId: credentialId, afterValue: data });
  return c.json({ data: { ...(toApi(data) as Record<string, unknown>), secret, secretShownOnce: true } }, 201);
});

deviceOnboardingRoutes.get("/assets/:assetId/credentials", requireJwt, requireScope("forest.asset.admin"), async (c) => {
  const assetId = c.req.param("assetId");
  assertAssetUuid(assetId);
  const { data, error } = await supabase.schema("core").from("device_credential")
    .select("credential_id,asset_id,credential_type,status,issued_at,expires_at,revoked_at,last_authenticated_at")
    .eq("asset_id", assetId).order("issued_at", { ascending: false });
  if (error) throw error;
  return c.json({ data: toApi(data ?? []) });
});

deviceOnboardingRoutes.post("/assets/:assetId/credentials/:credentialId/revoke", requireJwt, requireScope("forest.asset.admin"), async (c) => {
  const assetId = c.req.param("assetId");
  assertAssetUuid(assetId);
  const { data, error } = await supabase.schema("core").from("device_credential")
    .update({ status: "REVOKED", revoked_at: new Date().toISOString() })
    .eq("credential_id", c.req.param("credentialId")).eq("asset_id", assetId)
    .select("credential_id,asset_id,status,revoked_at").maybeSingle();
  if (error) throw error;
  if (!data) return c.json({ error: { code: "NOT_FOUND", message: "장치 인증정보를 찾을 수 없습니다." } }, 404);
  await writeAuditLog(c, { action: "DEVICE_CREDENTIAL_REVOKED", targetType: "device_credential", targetId: c.req.param("credentialId"), afterValue: data });
  return c.json({ data: toApi(data) });
});

deviceOnboardingRoutes.get("/events/:eventId/personnel-device-assignments", requireJwt, requireScope("forest.read"), async (c) => {
  const { data, error } = await supabase.schema("core").from("personnel_device_assignment")
    .select("*").eq("event_id", c.req.param("eventId")).order("assigned_at", { ascending: false });
  if (error) throw error;
  return c.json({ data: toApi(data ?? []) });
});

deviceOnboardingRoutes.post("/events/:eventId/personnel-device-assignments", requireJwt, requireScope("forest.command"), async (c) => {
  const body = await c.req.json<{ personExternalId: string; assetId: string; assignedAt: string; assignedBy?: string }>();
  assertAssetUuid(body.assetId);
  if (!body.personExternalId?.trim() || Number.isNaN(Date.parse(body.assignedAt))) {
    return c.json({ error: { code: "INVALID_ASSIGNMENT", message: "personExternalId와 ISO 8601 assignedAt이 필요합니다." } }, 400);
  }
  const { data: asset, error: assetError } = await supabase.schema("core").from("asset")
    .select("asset_id,asset_type,status,specifications").eq("asset_id", body.assetId).maybeSingle();
  if (assetError) throw assetError;
  if (!asset) return c.json({ error: { code: "ASSET_NOT_FOUND", message: "사전등록된 장치를 찾을 수 없습니다." } }, 404);
  if (["SUSPENDED", "LOST", "RETIRED"].includes(asset.status)) {
    return c.json({ error: { code: "DEVICE_NOT_OPERATIONAL", message: "운용 가능한 장치만 배정할 수 있습니다." } }, 409);
  }
  if (!["PERSONNEL_TERMINAL", "RTK_TERMINAL"].includes(asset.asset_type)) {
    return c.json({ error: { code: "NOT_PERSONNEL_TERMINAL", message: "대원용 통합단말만 대원에게 배정할 수 있습니다." } }, 400);
  }
  const assignmentId = randomUUID();
  const { data, error } = await supabase.schema("core").from("personnel_device_assignment").insert(toDatabase({
    assignmentId, eventId: c.req.param("eventId"), personExternalId: body.personExternalId,
    assetId: body.assetId, assignedAt: body.assignedAt, assignedBy: body.assignedBy ?? null,
  })).select("*").single();
  if (error?.code === "23505") {
    return c.json({ error: { code: "ACTIVE_ASSIGNMENT_CONFLICT", message: "대원 또는 단말에 이미 활성 배정이 있습니다." } }, 409);
  }
  if (error) throw error;
  await writeAuditLog(c, { eventId: c.req.param("eventId"), action: "DEVICE_ASSIGNED_TO_PERSON", targetType: "personnel_device_assignment", targetId: assignmentId, afterValue: data });
  return c.json({ data: toApi(data) }, 201);
});

deviceOnboardingRoutes.post("/events/:eventId/personnel-device-assignments/:assignmentId/release", requireJwt, requireScope("forest.command"), async (c) => {
  const body = await c.req.json<{ releasedAt: string }>();
  if (Number.isNaN(Date.parse(body.releasedAt))) {
    return c.json({ error: { code: "INVALID_RELEASE_TIME", message: "releasedAt은 ISO 8601 시각이어야 합니다." } }, 400);
  }
  const { data, error } = await supabase.schema("core").from("personnel_device_assignment")
    .update({ released_at: body.releasedAt }).eq("assignment_id", c.req.param("assignmentId"))
    .eq("event_id", c.req.param("eventId")).is("released_at", null).select("*").maybeSingle();
  if (error) throw error;
  if (!data) return c.json({ error: { code: "NOT_FOUND", message: "활성 배정을 찾을 수 없습니다." } }, 404);
  await writeAuditLog(c, { eventId: c.req.param("eventId"), action: "DEVICE_RELEASED_FROM_PERSON", targetType: "personnel_device_assignment", targetId: c.req.param("assignmentId"), afterValue: data });
  return c.json({ data: toApi(data) });
});

deviceOnboardingRoutes.get("/events/:eventId/reporting-routes", requireJwt, requireScope("forest.read"), async (c) => {
  const { data, error } = await supabase.schema("core").from("reporting_route")
    .select("*").eq("event_id", c.req.param("eventId")).order("created_at", { ascending: false });
  if (error) throw error;
  return c.json({ data: toApi(data ?? []) });
});

deviceOnboardingRoutes.post("/events/:eventId/reporting-routes", requireJwt, requireScope("forest.asset.admin"), async (c) => {
  const body = await c.req.json<{
    reporterAssetId: string;
    sourceAssetId: string;
    capabilityId?: string;
    reportingRole: "GATEWAY" | "GCS" | "NMS" | "DEVICE" | "SERVICE";
    validFrom?: string;
    validTo?: string | null;
  }>();
  await assertRegisteredAssetId(body.reporterAssetId);
  await assertRegisteredAssetId(body.sourceAssetId);
  if (body.reporterAssetId === body.sourceAssetId) {
    return c.json({ error: { code: "SELF_REPORT_ROUTE_NOT_REQUIRED", message: "동일 자산의 직접 보고에는 대리 보고 경로가 필요하지 않습니다." } }, 400);
  }
  if (!["GATEWAY", "GCS", "NMS", "DEVICE", "SERVICE"].includes(body.reportingRole)) {
    return c.json({ error: { code: "INVALID_REPORTING_ROLE", message: "지원하지 않는 reportingRole입니다." } }, 400);
  }
  const validFrom = body.validFrom ?? new Date().toISOString();
  if (Number.isNaN(Date.parse(validFrom)) || body.validTo && Number.isNaN(Date.parse(body.validTo))) {
    return c.json({ error: { code: "INVALID_ROUTE_TIME", message: "validFrom과 validTo는 ISO 8601 시각이어야 합니다." } }, 400);
  }
  if (body.validTo && Date.parse(body.validTo) <= Date.parse(validFrom)) {
    return c.json({ error: { code: "INVALID_ROUTE_TIME", message: "validTo는 validFrom보다 이후여야 합니다." } }, 400);
  }
  if (body.capabilityId && !integrationRegistry.get(body.capabilityId)) {
    return c.json({ error: { code: "UNKNOWN_CAPABILITY", message: "등록되지 않은 capabilityId입니다." } }, 400);
  }
  const { data, error } = await supabase.schema("core").from("reporting_route").insert(toDatabase({
    reportingRouteId: randomUUID(), eventId: c.req.param("eventId"),
    reporterAssetId: body.reporterAssetId, sourceAssetId: body.sourceAssetId,
    capabilityId: body.capabilityId ?? null, reportingRole: body.reportingRole,
    status: "ACTIVE", validFrom, validTo: body.validTo ?? null,
  })).select("*").single();
  if (error) throw error;
  await writeAuditLog(c, { eventId: c.req.param("eventId"), action: "REPORTING_ROUTE_CREATED", targetType: "reporting_route", targetId: data.reporting_route_id, afterValue: data });
  return c.json({ data: toApi(data) }, 201);
});

deviceOnboardingRoutes.post("/gateways/activate", async (c) => {
  const body = await c.req.json<{
    assetId: string;
    credential: string;
    eventId: string;
    reportingRole: "GATEWAY" | "GCS" | "NMS" | "SERVICE";
  }>();
  assertAssetUuid(body.assetId);
  if (!body.credential || !body.eventId || !["GATEWAY", "GCS", "NMS", "SERVICE"].includes(body.reportingRole)) {
    return c.json({ error: { code: "INVALID_GATEWAY_ACTIVATION", message: "assetId, credential, eventId와 올바른 reportingRole이 필요합니다." } }, 400);
  }
  const now = new Date().toISOString();
  const { data: credential, error: credentialError } = await supabase.schema("core").from("device_credential")
    .select("credential_id,asset_id,status,expires_at").eq("asset_id", body.assetId)
    .eq("credential_hash", hashCredential(body.credential)).eq("status", "ACTIVE").maybeSingle();
  if (credentialError) throw credentialError;
  if (!credential || credential.expires_at && credential.expires_at <= now) {
    return c.json({ error: { code: "DEVICE_AUTHENTICATION_FAILED", message: "유효한 게이트웨이 인증정보가 아닙니다." } }, 401);
  }
  const { data: asset, error: assetError } = await supabase.schema("core").from("asset")
    .select("asset_type,status").eq("asset_id", body.assetId).maybeSingle();
  if (assetError) throw assetError;
  const gatewayTypes = ["COMMAND_VEHICLE", "RTK_BASE_LPWA_GATEWAY", "TVWS_BASE_STATION", "LTE_GATEWAY", "PRIVATE_5G_NTN_GATEWAY", "RADIO_GATEWAY_400MHZ", "MOBILE_RELAY", "GCS"];
  if (!asset || !gatewayTypes.includes(asset.asset_type) || ["SUSPENDED", "LOST", "RETIRED"].includes(asset.status)) {
    return c.json({ error: { code: "NOT_REPORTING_GATEWAY", message: "등록된 게이트웨이·GCS·NMS 자산만 활성화할 수 있습니다." } }, 403);
  }
  const { data: assigned, error: assignmentError } = await supabase.schema("core").from("event_resource")
    .select("event_resource_id").eq("event_id", body.eventId).eq("asset_id", body.assetId)
    .is("released_at", null).limit(1).maybeSingle();
  if (assignmentError) throw assignmentError;
  if (!assigned) return c.json({ error: { code: "GATEWAY_NOT_ASSIGNED", message: "해당 사건에 배정된 게이트웨이·GCS·NMS가 아닙니다." } }, 403);
  const { error: updateError } = await supabase.schema("core").from("device_credential")
    .update({ last_authenticated_at: now }).eq("credential_id", credential.credential_id);
  if (updateError) throw updateError;
  const issuedAt = Math.floor(Date.now() / 1000);
  const expiresIn = 15 * 60;
  const accessToken = await sign({
    sub: `reporter:${body.assetId}`, assetId: body.assetId, eventId: body.eventId,
    reportingRole: body.reportingRole, scopes: ["forest.ingest"], iat: issuedAt, exp: issuedAt + expiresIn,
  }, config.jwtSecret, "HS256");
  return c.json({ data: { activated: true, assetId: body.assetId, reportingRole: body.reportingRole, accessToken, tokenType: "Bearer", expiresIn } });
});

deviceOnboardingRoutes.post("/devices/activate", async (c) => {
  const body = await c.req.json<{ assetId: string; credential: string; eventId: string; personExternalId: string }>();
  assertAssetUuid(body.assetId);
  if (!body.credential || !body.eventId || !body.personExternalId) {
    return c.json({ error: { code: "INVALID_ACTIVATION", message: "assetId, credential, eventId, personExternalId가 필요합니다." } }, 400);
  }
  const now = new Date().toISOString();
  const { data: credential, error: credentialError } = await supabase.schema("core").from("device_credential")
    .select("credential_id,asset_id,status,expires_at").eq("asset_id", body.assetId)
    .eq("credential_hash", hashCredential(body.credential)).eq("status", "ACTIVE").maybeSingle();
  if (credentialError) throw credentialError;
  if (!credential || (credential.expires_at && credential.expires_at <= now)) {
    return c.json({ error: { code: "DEVICE_AUTHENTICATION_FAILED", message: "유효한 장치 인증정보가 아닙니다." } }, 401);
  }
  const { data: asset, error: assetError } = await supabase.schema("core").from("asset")
    .select("status").eq("asset_id", body.assetId).maybeSingle();
  if (assetError) throw assetError;
  if (!asset || ["REVOKED", "RETIRED", "LOST", "SUSPENDED"].includes(asset.status)) {
    return c.json({ error: { code: "DEVICE_NOT_OPERATIONAL", message: "운용 가능한 등록 장치가 아닙니다." } }, 403);
  }
  const { data: assignment, error: assignmentError } = await supabase.schema("core").from("personnel_device_assignment")
    .select("assignment_id").eq("event_id", body.eventId).eq("asset_id", body.assetId)
    .eq("person_external_id", body.personExternalId).is("released_at", null).maybeSingle();
  if (assignmentError) throw assignmentError;
  if (!assignment) return c.json({ error: { code: "DEVICE_NOT_ASSIGNED", message: "해당 사건과 대원에게 활성 배정된 장치가 아닙니다." } }, 403);
  const { error: updateError } = await supabase.schema("core").from("device_credential")
    .update({ last_authenticated_at: now }).eq("credential_id", credential.credential_id);
  if (updateError) throw updateError;
  if (asset.status !== "ACTIVE") {
    const { error: assetUpdateError } = await supabase.schema("core").from("asset")
      .update({ status: "ACTIVE", updated_at: now }).eq("asset_id", body.assetId);
    if (assetUpdateError) throw assetUpdateError;
  }
  const issuedAt = Math.floor(Date.now() / 1000);
  const expiresIn = 15 * 60;
  const accessToken = await sign({
    sub: `device:${body.assetId}`,
    assetId: body.assetId,
    eventId: body.eventId,
    personExternalId: body.personExternalId,
    scopes: ["forest.ingest"],
    iat: issuedAt,
    exp: issuedAt + expiresIn,
  }, config.jwtSecret, "HS256");
  return c.json({ data: {
    activated: true, assetId: body.assetId, assignmentId: assignment.assignment_id,
    activatedAt: now, accessToken, tokenType: "Bearer", expiresIn,
  } });
});
