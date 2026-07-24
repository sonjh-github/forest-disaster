import test from "node:test";
import assert from "node:assert/strict";
import { integrationTests } from "../src/integration-tests/catalog.js";
import { applyTestMode } from "../src/integration-tests/payload-modes.js";
import { SITES } from "../src/integration-tests/shared.js";

test("문서화된 장비·AI 26종에 각각 모사 테스트가 있다", () => {
  assert.equal(integrationTests.length, 26);
  assert.equal(new Set(integrationTests.map(({ id }) => id)).size, 26);
});

test("모든 모사 데이터가 공통 봉투 계약을 만족한다", () => {
  for (const item of integrationTests) {
    for (const mode of item.modes) {
      const envelope = item.createEnvelope(mode);
      assert.match(envelope.context.eventId, /^[0-9a-f-]{36}$/i, item.id);
      assert.match(envelope.context.requestId, /^[0-9a-f-]{36}$/i, item.id);
      assert.equal(envelope.context.schemaVersion, "1.0", item.id);
      assert.ok(Number.isFinite(Date.parse(envelope.context.occurredAt)), item.id);
      assert.equal(typeof envelope.data, "object", item.id);
    }
  }
});

test("미세 변화와 통신 장애 상황을 공통 형식을 유지하며 적용한다", () => {
  const envelope = {
    context: { sourceSystem: "mock", eventId: "x", requestId: "y", occurredAt: "2026-01-01T00:00:00Z", schemaVersion: "1.0" },
    data: { status: "ACTIVE", signalStrengthDbm: -70, latencyMs: 30, confidence: 0.9 },
  };
  const gradual = applyTestMode(envelope, { variationMode: "gradual", cycle: 1 });
  assert.notEqual(gradual.data.signalStrengthDbm, envelope.data.signalStrengthDbm);
  assert.notEqual(gradual.data.confidence, envelope.data.confidence);

  const outage = applyTestMode(envelope, { condition: "network-outage" });
  assert.equal(outage.data.status, "DEGRADED");
  assert.equal(outage.data.signalStrengthDbm, -120);
  assert.equal(outage.data.latencyMs, 5_000);
  assert.match(outage.context.sourceSystem, /network-outage$/);
});

function coordinatePairs(value, pairs = [], insideCoordinates = false) {
  if (Array.isArray(value)) {
    if (insideCoordinates && value.length >= 2 && typeof value[0] === "number" && typeof value[1] === "number") pairs.push(value);
    else value.forEach((item) => coordinatePairs(item, pairs, insideCoordinates));
  } else if (value && typeof value === "object") {
    if (value.type && value.coordinates) coordinatePairs(value.coordinates, pairs, true);
    else Object.values(value).forEach((item) => coordinatePairs(item, pairs, false));
  }
  return pairs;
}

test("산불·산사태 좌표는 각 현장 허용 반경을 벗어나지 않는다", () => {
  for (const item of integrationTests.filter(({ domain }) => domain in SITES)) {
    const site = SITES[item.domain];
    for (const mode of item.modes) {
      const envelope = item.createEnvelope(mode);
      for (const [longitude, latitude] of coordinatePairs(envelope.data)) {
        const northM = (latitude - site.latitude) * 111_320;
        const eastM = (longitude - site.longitude) * 111_320 * Math.cos(site.latitude * Math.PI / 180);
        assert.ok(Math.hypot(eastM, northM) <= site.maxRadiusM + 1, `${item.id} 좌표가 ${item.domain} 현장을 벗어남`);
      }
    }
  }
});
