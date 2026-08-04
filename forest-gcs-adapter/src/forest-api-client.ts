import { randomUUID } from "node:crypto";
import { config } from "./config.js";
import { logger } from "./logger.js";
import type { DroneTelemetry, IntegrationEnvelope } from "./types.js";
import { normalizeAssetIdentity } from "./asset-identity.js";

export class ForestApiClient {
  private eventId = config.forestEventId;
  private state = {
    apiUrl: config.forestApiUrl,
    webUrl: config.forestWebUrl,
    simulatorUrl: config.forestSimulatorUrl,
    capabilityId: config.integrationCapabilityId,
    eventId: config.forestEventId || null,
    connected: false,
    lastSuccessAt: null as string | null,
    lastError: null as string | null,
  };

  status() {
    return { ...this.state };
  }

  private headers() {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-Origin": config.sourceSystem,
    };
    if (config.forestApiToken) headers.Authorization = `Bearer ${config.forestApiToken}`;
    return headers;
  }

  private async resolveEventId() {
    if (this.eventId) return this.eventId;
    const response = await fetch(`${config.forestApiUrl}/api/v1/events?limit=100`, {
      headers: this.headers(),
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) throw new Error(`이벤트 조회 실패: HTTP ${response.status}`);
    const body = await response.json() as {
      data?: Array<{ eventId?: string; disasterType?: string; status?: string }>;
    };
    const events = body.data ?? [];
    const event = events.find((item) =>
      item.disasterType === config.forestEventType && item.status !== "CLOSED"
    ) ?? events.find((item) => item.disasterType === config.forestEventType);
    if (!event?.eventId) throw new Error(`${config.forestEventType} 이벤트를 찾을 수 없습니다.`);
    this.eventId = event.eventId;
    this.state.eventId = event.eventId;
    logger.ok("FOREST-API", `연결 이벤트 자동 선택: ${event.eventId}`);
    return event.eventId;
  }

  async probe() {
    try {
      await this.resolveEventId();
      this.state.connected = true;
      this.state.lastError = null;
    } catch (error) {
      this.state.connected = false;
      this.state.lastError = error instanceof Error ? error.message : String(error);
    }
    return this.status();
  }

  async send(telemetry: DroneTelemetry) {
    const eventId = await this.resolveEventId();
    const unifiedTelemetry = normalizeAssetIdentity(telemetry);
    const unifiedAssetId = unifiedTelemetry.assetId;
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(unifiedAssetId)) {
      throw new Error(`통합 자산 UUID가 필요합니다: ${unifiedAssetId}`);
    }
    const envelope: IntegrationEnvelope<DroneTelemetry> = {
      context: {
        eventId,
        requestId: randomUUID(),
        sourceSystem: config.sourceSystem,
        occurredAt: telemetry.observedAt,
        schemaVersion: "1.0",
      },
      data: unifiedTelemetry,
    };
    const response = await fetch(
      `${config.forestApiUrl}/api/v1/integrations/${config.integrationCapabilityId}/results`,
      {
        method: "POST",
        headers: { ...this.headers(), "Idempotency-Key": envelope.context.requestId },
        body: JSON.stringify(envelope),
        signal: AbortSignal.timeout(5_000),
      },
    );
    const body = await response.json().catch(() => ({ message: response.statusText }));
    if (!response.ok) {
      this.state.connected = false;
      this.state.lastError = `HTTP ${response.status}: ${JSON.stringify(body)}`;
      throw new Error(`forest-back-demo 응답 ${this.state.lastError}`);
    }
    this.state.connected = true;
    this.state.lastSuccessAt = new Date().toISOString();
    this.state.lastError = null;
    logger.ok("FOREST-API", `${unifiedAssetId} 상태 전송 완료`, {
      battery: telemetry.attributes.batteryPercent,
      position: telemetry.geometry.coordinates.slice(0, 2),
    });
    return body;
  }
}
