import { Hono } from "hono";
import { randomUUID } from "node:crypto";
import { requireJwt, requireScope } from "../middleware/auth.js";
import { assetResource, createRow, listRows, toApi } from "../services/database.js";
import type { AppEnv } from "../types.js";
import { writeAuditLog } from "../services/audit.js";
import { supabase } from "../config.js";

export const assetRoutes = new Hono<AppEnv>();

assetRoutes.use("*", requireJwt);

assetRoutes.get("/", requireScope("forest.read"), async (c) => {
  return c.json(await listRows(assetResource, {
    limit: Number(c.req.query("limit") ?? 50),
    cursor: c.req.query("cursor"),
  }));
});

assetRoutes.post("/", requireScope("forest.asset.admin"), async (c) => {
  const body = await c.req.json<Record<string, unknown>>();
  for (const field of ["assetCode", "assetType", "serialNumber"] as const) {
    if (typeof body[field] !== "string" || !body[field].trim()) {
      return c.json({ error: { code: "INVALID_ASSET", message: `${field} 문자열이 필요합니다.` } }, 400);
    }
  }
  const requestedId = body.assetId;
  if (requestedId !== undefined && (
    typeof requestedId !== "string"
    || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestedId)
  )) {
    return c.json({ error: { code: "INVALID_ASSET_ID", message: "assetId는 통합 UUID 형식이어야 합니다." } }, 400);
  }
  const capabilities = body.capabilities;
  if (!Array.isArray(capabilities) || capabilities.some((item) => typeof item !== "string")) {
    return c.json({ error: { code: "INVALID_CAPABILITIES", message: "capabilities 문자열 배열이 필요합니다." } }, 400);
  }
  if (capabilities.length === 0 || new Set(capabilities).size !== capabilities.length) {
    return c.json({ error: { code: "INVALID_CAPABILITIES", message: "capabilities는 중복 없는 문자열을 하나 이상 포함해야 합니다." } }, 400);
  }
  if (body.assetType === "PERSONNEL_TERMINAL") {
    const requiredCapabilities = ["GNSS", "WIFI", "LTE", "LPWA"];
    const missing = requiredCapabilities.filter((item) => !capabilities.includes(item));
    if (missing.length) {
      return c.json({ error: { code: "MISSING_PERSONNEL_CAPABILITY", message: `대원 통합단말 필수 기능이 없습니다: ${missing.join(", ")}` } }, 400);
    }
  }
  const assetId = requestedId ?? randomUUID();
  const requestedSpecifications = body.specifications;
  const data = await createRow(assetResource, {
    assetId,
    assetCode: body.assetCode,
    assetType: body.assetType,
    assetName: body.assetName ?? null,
    ownerOrgCode: body.ownerOrgCode ?? null,
    modelName: body.modelName ?? null,
    serialNumber: body.serialNumber,
    status: "REGISTERED",
    specifications: {
      ...(requestedSpecifications && typeof requestedSpecifications === "object" ? requestedSpecifications : {}),
      capabilities,
      registrationMode: "PRE_REGISTERED",
    },
  });
  await writeAuditLog(c, {
    action: "ASSET_REGISTERED", targetType: "asset", targetId: String(assetId), afterValue: data,
  });
  return c.json({ data }, 201);
});

assetRoutes.post("/:assetId/status", requireScope("forest.asset.admin"), async (c) => {
  const assetId = c.req.param("assetId");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(assetId)) {
    return c.json({ error: { code: "INVALID_ASSET_ID", message: "assetId는 UUID여야 합니다." } }, 400);
  }
  const body = await c.req.json<{ status: string; reason?: string }>();
  const allowed = ["REGISTERED", "ACTIVE", "SUSPENDED", "LOST", "RETIRED"];
  if (!allowed.includes(body.status)) {
    return c.json({ error: { code: "INVALID_ASSET_STATUS", message: `status는 ${allowed.join(", ")} 중 하나여야 합니다.` } }, 400);
  }
  const { data, error } = await supabase.schema("core").from("asset")
    .update({ status: body.status, updated_at: new Date().toISOString() })
    .eq("asset_id", assetId).select("*").maybeSingle();
  if (error) throw error;
  if (!data) return c.json({ error: { code: "ASSET_NOT_FOUND", message: "장치를 찾을 수 없습니다." } }, 404);
  await writeAuditLog(c, {
    action: "ASSET_STATUS_CHANGED", targetType: "asset", targetId: assetId,
    afterValue: { ...data, reason: body.reason ?? null },
  });
  return c.json({ data: toApi(data) });
});
