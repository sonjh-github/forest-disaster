import { Hono } from "hono";
import { integrationRegistry } from "../integrations/catalog.js";
import { assertEnvelope, assertIdempotencyKey, assertRequiredFields } from "../integrations/shared/contracts.js";
import { integrationGovernance } from "../integrations/shared/governance.js";
import { invokeJsonService } from "../integrations/shared/json-http-adapter.js";
import {
  beginIntegrationMessage,
  findIntegrationMessage,
  finishIntegrationMessage,
} from "../integrations/shared/message-log.js";
import { storeIntegrationResult } from "../integrations/shared/result-store.js";
import { serverLogger } from "../logger.js";
import { requireJwt, requireScope } from "../middleware/auth.js";
import type { AppEnv, JwtPayload } from "../types.js";
import { assertPersonnelPosition } from "../integrations/communications/common/rtk-gnss.js";
import { assertRtkLpwaGatewayStatus } from "../integrations/communications/wildfire/rtk-base-lpwa-gateway.js";
import { assertTvwsLinkObservation } from "../integrations/communications/wildfire/tvws-station.js";
import { assertReportingAuthority, assertRegisteredAssetId } from "../services/asset-identity.js";

export const integrationRoutes = new Hono<AppEnv>();
integrationRoutes.use("*", requireJwt);

function errorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
    return error.message;
  }
  return fallback;
}

async function assertDeviceClaims(c: { get(key: "jwtPayload"): unknown }, capabilityId: string, envelope: {
  context: { eventId: string };
  data: Record<string, unknown>;
}) {
  const payload = c.get("jwtPayload") as JwtPayload | undefined;
  const context = envelope.context as typeof envelope.context & { reportedByAssetId?: string; reportingRole?: string };
  const sourceAssetId = envelope.data.sourceAssetId
    ?? envelope.data.assetId
    ?? envelope.data.cpeAssetId
    ?? envelope.data.baseAssetId;
  if (context.reportedByAssetId) await assertRegisteredAssetId(context.reportedByAssetId);
  if (!payload?.assetId) return;
  const reporterAssetId = context.reportedByAssetId ?? sourceAssetId;
  if (payload.eventId !== envelope.context.eventId) throw new Error("장치 토큰의 eventId와 요청 eventId가 다릅니다.");
  if (reporterAssetId !== payload.assetId) throw new Error("장치 토큰의 assetId와 실제 API 호출 주체가 다릅니다.");
  if (context.reportingRole && payload.reportingRole && context.reportingRole !== payload.reportingRole) {
    throw new Error("장치 토큰과 요청의 reportingRole이 다릅니다.");
  }
  if (sourceAssetId && reporterAssetId) {
    await assertReportingAuthority(envelope.context.eventId, reporterAssetId, sourceAssetId, capabilityId);
  }
  if (reporterAssetId === sourceAssetId && payload.personExternalId && envelope.data.personExternalId !== undefined
    && envelope.data.personExternalId !== payload.personExternalId) {
    throw new Error("장치 토큰에 배정된 대원과 보고 대원이 다릅니다.");
  }
}

integrationRoutes.get("/", requireScope("forest.read"), (c) => {
  const data = integrationRegistry.list().map((capability) => ({
    ...capability,
    ...integrationGovernance(capability),
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
  let messageId: string | null = null;
  try {
    const envelope = await c.req.json();
    assertEnvelope(envelope);
    assertIdempotencyKey(envelope.context.requestId, c.req.header("Idempotency-Key"));
    await assertDeviceClaims(c, capability.id, envelope);
    assertRequiredFields(envelope.data, capability.inputFields);
    const log = await beginIntegrationMessage(capability, envelope, "OUTBOUND");
    messageId = String(log.message.messageId);
    if (log.duplicate) {
      return c.json({
        data: {
          duplicate: true,
          requestId: envelope.context.requestId,
          status: log.message.status,
          response: log.message.response ?? null,
        },
      }, 200);
    }
    const result = await invokeJsonService(capability, envelope);
    await finishIntegrationMessage(messageId, "SUCCEEDED", { response: result });
    serverLogger.info(capability.id, "integration.invoke.complete", {
      requestId: envelope.context.requestId,
      eventId: envelope.context.eventId,
      status: result.status,
    });
    return c.json({ data: result }, 200);
  } catch (error) {
    if (messageId) {
      await finishIntegrationMessage(messageId, "FAILED", {
        errorCode: "INTEGRATION_INVOKE_FAILED",
        errorDetail: errorMessage(error, "연동 호출 실패"),
      }).catch(() => undefined);
    }
    return c.json({ error: { code: "INTEGRATION_INVOKE_FAILED", message: errorMessage(error, "연동 호출 실패") } }, 400);
  }
});

integrationRoutes.post("/:capabilityId/results", requireScope("forest.ingest"), async (c) => {
  const capability = integrationRegistry.get(c.req.param("capabilityId"));
  if (!capability) return c.json({ error: { code: "CAPABILITY_NOT_FOUND", message: "연동 기능을 찾을 수 없습니다." } }, 404);
  if (capability.direction === "OUTBOUND") {
    return c.json({ error: { code: "DIRECTION_NOT_SUPPORTED", message: "결과 수신을 지원하지 않는 송신 전용 기능입니다." } }, 405);
  }
  let messageId: string | null = null;
  try {
    const envelope = await c.req.json();
    assertEnvelope(envelope);
    assertIdempotencyKey(envelope.context.requestId, c.req.header("Idempotency-Key"));
    await assertDeviceClaims(c, capability.id, envelope);
    assertRequiredFields(envelope.data, capability.outputFields);
    if (capability.id === "wildfire.rtk-terminal") assertPersonnelPosition(envelope.data);
    if (capability.id === "wildfire.rtk-base-lpwa-gateway") assertRtkLpwaGatewayStatus(envelope.data);
    if (capability.id === "wildfire.tvws-network") assertTvwsLinkObservation(envelope.data);
    const log = await beginIntegrationMessage(capability, envelope, "INBOUND");
    messageId = String(log.message.messageId);
    if (log.duplicate) {
      return c.json({
        data: {
          accepted: true,
          duplicate: true,
          capabilityId: capability.id,
          requestId: envelope.context.requestId,
          status: log.message.status,
        },
      }, 200);
    }
    const stored = await storeIntegrationResult(capability, envelope);
    await finishIntegrationMessage(messageId, "ACCEPTED", { response: stored });
    serverLogger.info(capability.id, "integration.result.accepted", {
      requestId: envelope.context.requestId,
      eventId: envelope.context.eventId,
      stored: stored.stored,
    });
    return c.json({ data: { accepted: true, capabilityId: capability.id, ...stored } }, 200);
  } catch (error) {
    if (messageId) {
      await finishIntegrationMessage(messageId, "REJECTED", {
        errorCode: "INTEGRATION_RESULT_REJECTED",
        errorDetail: errorMessage(error, "연동 결과 수신 실패"),
      }).catch(() => undefined);
    }
    return c.json({ error: { code: "INTEGRATION_RESULT_REJECTED", message: errorMessage(error, "연동 결과 수신 실패") } }, 400);
  }
});

integrationRoutes.get("/:capabilityId/messages/:requestId", requireScope("forest.read"), async (c) => {
  const capability = integrationRegistry.get(c.req.param("capabilityId"));
  if (!capability) return c.json({ error: { code: "CAPABILITY_NOT_FOUND", message: "연동 기능을 찾을 수 없습니다." } }, 404);
  const requestedDirection = c.req.query("direction");
  if (requestedDirection !== "INBOUND" && requestedDirection !== "OUTBOUND") {
    return c.json({ error: { code: "INVALID_DIRECTION", message: "direction은 INBOUND 또는 OUTBOUND여야 합니다." } }, 400);
  }
  const direction = requestedDirection;
  const message = await findIntegrationMessage(capability.id, direction, c.req.param("requestId"));
  return message
    ? c.json({ data: message })
    : c.json({ error: { code: "MESSAGE_NOT_FOUND", message: "연동 메시지를 찾을 수 없습니다." } }, 404);
});
