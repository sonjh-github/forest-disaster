import test from "node:test";
import assert from "node:assert/strict";
import { applyTestMode } from "../src/integration-tests/payload-modes.js";
import { ServerApi } from "../src/server-api.js";

const base = {
  context: { requestId: "10000000-0000-4000-8000-000000000001", sourceSystem: "test" },
  data: { status: "ACTIVE", signalStrengthDbm: -60, latencyMs: 20, throughputMbps: 10, confidence: 0.99, batteryPct: 100 },
};

test("통신 두절·고지연·약신호·복구 조건을 결정적으로 변환한다", () => {
  const outage = applyTestMode(base, { condition: "network-outage" });
  assert.equal(outage.data.status, "DEGRADED");
  assert.equal(outage.data.signalStrengthDbm, -120);
  assert.equal(outage.data.latencyMs, 5000);
  assert.equal(outage.data.throughputMbps, 0);
  assert.equal(applyTestMode(base, { condition: "high-latency" }).data.latencyMs, 2000);
  assert.equal(applyTestMode(base, { condition: "weak-signal" }).data.signalStrengthDbm, -105);
  const recovery = applyTestMode(base, { condition: "recovery" });
  assert.equal(recovery.data.status, "ACTIVE");
  assert.equal(recovery.data.signalStrengthDbm, -55);
  assert.equal(recovery.data.latencyMs, 30);
});

test("점진 변화는 cycle에 따라 증감하고 백분율 범위를 넘지 않는다", () => {
  const up = applyTestMode(base, { variationMode: "gradual", cycle: 0 });
  const down = applyTestMode(base, { variationMode: "gradual", cycle: 5 });
  assert.ok(up.data.signalStrengthDbm > base.data.signalStrengthDbm);
  assert.ok(down.data.signalStrengthDbm < base.data.signalStrengthDbm);
  assert.equal(up.data.batteryPct, 100);
  assert.equal(up.data.confidence, 1);
});

test("dry-run ServerApi는 네트워크 없이 요청 내용을 반환한다", async () => {
  const api = new ServerApi({ apiBaseUrl: undefined, dryRun: true, timeoutMs: 10 });
  const result = await api.testIntegration("landslide.gcs", "result", base);
  assert.equal(result.dryRun, true);
  assert.equal(result.capabilityId, "landslide.gcs");
});

test("ServerApi는 잘못된 모드와 HTTP 실패를 오류로 반환한다", async (t) => {
  const api = new ServerApi({ apiBaseUrl: "http://example.invalid", dryRun: false, timeoutMs: 100 });
  await assert.rejects(() => api.testIntegration("x", "bad", base), /mode/);
  const original = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ error: { message: "거부됨" } }), { status: 403, headers: { "content-type": "application/json" } });
  t.after(() => { globalThis.fetch = original; });
  await assert.rejects(() => api.testIntegration("x", "result", base), /거부됨/);
});
