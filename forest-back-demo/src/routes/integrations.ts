import { Hono } from "hono";
import { integrationRegistry } from "../integrations/catalog.js";
import { assertEnvelope, assertRequiredFields } from "../integrations/shared/contracts.js";
import { invokeJsonService } from "../integrations/shared/json-http-adapter.js";
import { storeIntegrationResult } from "../integrations/shared/result-store.js";
import { serverLogger } from "../logger.js";
import { requireJwt, requireScope } from "../middleware/auth.js";
import type { AppEnv } from "../types.js";

export const integrationRoutes = new Hono<AppEnv>();
integrationRoutes.use("*", requireJwt);

function errorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
    return error.message;
  }
  return fallback;
}

integrationRoutes.get("/", requireScope("forest.read"), (c) => {
  const data = integrationRegistry.list().map((capability) => ({
    ...capability,
    configured: capability.endpointEnv ? Boolean(process.env[capability.endpointEnv]?.trim()) : true,
  }));
  return c.json({ data });
});

integrationRoutes.post("/:capabilityId/invoke", requireScope("forest.write"), async (c) => {
  const capability = integrationRegistry.get(c.req.param("capabilityId"));
  if (!capability) return c.json({ error: { code: "CAPABILITY_NOT_FOUND", message: "연동 기능을 찾을 수 없습니다." } }, 404);
  if (capability.direction === "INBOUND") {
    return c.json({ error: { code: "DIRECTION_NOT_SUPPORTED", message: "외부 호출을 지원하지 않는 수신 전용 기능입니다." } }, 405);
  }
  try {
    const envelope = await c.req.json();
    assertEnvelope(envelope);
    assertRequiredFields(envelope.data, capability.inputFields);
    const result = await invokeJsonService(capability, envelope);
    serverLogger.info(capability.id, "integration.invoke.complete", {
      requestId: envelope.context.requestId,
      eventId: envelope.context.eventId,
      status: result.status,
    });
    return c.json({ data: result }, 200);
  } catch (error) {
    return c.json({ error: { code: "INTEGRATION_INVOKE_FAILED", message: errorMessage(error, "연동 호출 실패") } }, 400);
  }
});

integrationRoutes.post("/:capabilityId/results", requireScope("forest.ingest"), async (c) => {
  const capability = integrationRegistry.get(c.req.param("capabilityId"));
  if (!capability) return c.json({ error: { code: "CAPABILITY_NOT_FOUND", message: "연동 기능을 찾을 수 없습니다." } }, 404);
  if (capability.direction === "OUTBOUND") {
    return c.json({ error: { code: "DIRECTION_NOT_SUPPORTED", message: "결과 수신을 지원하지 않는 송신 전용 기능입니다." } }, 405);
  }
  try {
    const envelope = await c.req.json();
    assertEnvelope(envelope);
    assertRequiredFields(envelope.data, capability.outputFields);
    const stored = await storeIntegrationResult(capability, envelope);
    serverLogger.info(capability.id, "integration.result.accepted", {
      requestId: envelope.context.requestId,
      eventId: envelope.context.eventId,
      stored: stored.stored,
    });
    return c.json({ data: { accepted: true, capabilityId: capability.id, ...stored } }, 200);
  } catch (error) {
    return c.json({ error: { code: "INTEGRATION_RESULT_REJECTED", message: errorMessage(error, "연동 결과 수신 실패") } }, 400);
  }
});
