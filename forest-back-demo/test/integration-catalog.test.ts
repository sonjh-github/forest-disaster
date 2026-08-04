import test from "node:test";
import assert from "node:assert/strict";
import { integrationRegistry } from "../src/integrations/catalog.js";
import { assertEnvelope, assertIdempotencyKey } from "../src/integrations/shared/contracts.js";
import { assertPersonnelPosition } from "../src/integrations/communications/common/rtk-gnss.js";
import { assertRtkLpwaGatewayStatus } from "../src/integrations/communications/wildfire/rtk-base-lpwa-gateway.js";
import { assertTvwsLinkObservation } from "../src/integrations/communications/wildfire/tvws-station.js";

const expectedIds = [
  "common.network-bonding", "common.gis-coverage",
  "wildfire.rtk-terminal", "wildfire.rtk-base-lpwa-gateway", "wildfire.tvws-network",
  "wildfire.mobile-command-hub", "wildfire.private-5g-ntn", "wildfire.radio-gateway",
  "wildfire.ai-ran", "wildfire.relay-placement", "wildfire.ignition-detection",
  "wildfire.fireline-prediction", "wildfire.vehicle-road-analysis",
  "landslide.main-relay-drone", "landslide.service-relay-drone", "landslide.fixed-relay",
  "landslide.gcs", "landslide.ref-ap", "landslide.rover-ap", "landslide.ir-uwb-gpr",
  "landslide.risk-analysis", "landslide.debris-flow", "landslide.change-detection",
  "landslide.rssi-localization", "landslide.vital-signal-analysis", "landslide.attenuation-correction",
].sort();

test("문서화된 장비·AI 기능 26개가 모두 등록된다", () => {
  assert.deepEqual(integrationRegistry.list().map(({ id }) => id).sort(), expectedIds);
});

test("대원 위치는 GNSS 측위와 LPWA 기본망·LTE 보조망을 분리한다", () => {
  const valid = {
    positioningMethod: "RTK_FIXED",
    primaryLink: "LPWA",
    fallbackLink: "LTE",
    activeLink: "LPWA",
    fallbackActivated: false,
    observedAt: "2026-07-31T00:00:00Z",
    transmittedAt: "2026-07-31T00:00:01Z",
    batteryPercent: 80,
  };
  assert.doesNotThrow(() => assertPersonnelPosition(valid));
  assert.doesNotThrow(() => assertPersonnelPosition({
    ...valid, activeLink: "LTE", fallbackActivated: true, lastPrimaryLinkAt: valid.observedAt,
  }));
  assert.throws(() => assertPersonnelPosition({
    ...valid, activeLink: "LTE", fallbackActivated: false,
  }), /LTE/);
  assert.throws(() => assertPersonnelPosition({
    ...valid, primaryLink: "WIFI",
  }), /primaryLink/);
});

test("RTK 게이트웨이와 TVWS 링크 계약을 검증한다", () => {
  assert.doesNotThrow(() => assertRtkLpwaGatewayStatus({
    observedAt: "2026-07-31T00:00:00Z", operationalStatus: "ONLINE",
    deliveryMode: "BROADCAST", beaconChannel: 1, uplinkChannelCount: 7, connectedTerminals: 4,
  }));
  assert.doesNotThrow(() => assertTvwsLinkObservation({
    observedAt: "2026-07-31T00:00:00Z", operationalStatus: "ONLINE",
    ingressMedium: "ETHERNET", backhaulType: "5G",
  }));
  assert.throws(() => assertTvwsLinkObservation({
    observedAt: "2026-07-31T00:00:00Z", operationalStatus: "ONLINE",
    ingressMedium: "WIRELESS", backhaulType: "5G",
  }), /ETHERNET/);
});

test("통합 봉투는 UUID·ISO 시각·1.0 버전을 검증한다", () => {
  const valid = {
    context: {
      eventId: "10000000-0000-4000-8000-000000000001",
      requestId: "274e2c46-8fa8-4b01-bad7-623a62c91146",
      sourceSystem: "test-adapter",
      occurredAt: "2026-07-23T06:49:22.405Z",
      schemaVersion: "1.0",
    },
    data: { deviceId: "TEST-001" },
  };
  assert.doesNotThrow(() => assertEnvelope(valid));
  assert.throws(() => assertEnvelope({ ...valid, context: { ...valid.context, requestId: "not-uuid" } }), /UUID/);
  assert.doesNotThrow(() => assertEnvelope({
    ...valid,
    context: {
      ...valid.context,
      reportedByAssetId: "20000000-0000-4000-8000-000000000003",
      reportingRole: "GATEWAY",
    },
  }));
  assert.throws(() => assertEnvelope({
    ...valid,
    context: { ...valid.context, reportingRole: "GATEWAY" },
  }), /함께/);
  assert.doesNotThrow(() => assertIdempotencyKey(valid.context.requestId, valid.context.requestId));
  assert.throws(() => assertIdempotencyKey(valid.context.requestId), /Idempotency-Key/);
  assert.throws(() => assertIdempotencyKey(valid.context.requestId, crypto.randomUUID()), /requestId/);
  assert.throws(() => assertEnvelope({
    ...valid,
    context: { ...valid.context, occurredAt: new Date(Date.now() + 10 * 60_000).toISOString() },
  }), /5/);
});
