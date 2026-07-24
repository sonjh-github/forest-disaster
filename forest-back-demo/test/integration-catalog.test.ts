import test from "node:test";
import assert from "node:assert/strict";
import { integrationRegistry } from "../src/integrations/catalog.js";
import { assertEnvelope } from "../src/integrations/shared/contracts.js";

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
});
