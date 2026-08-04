import test from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../src/app.js";
import { TelemetryStore } from "../src/telemetry-store.js";
import type { DroneTelemetry } from "../src/types.js";

const telemetry = (assetId: string, observedAt = "2026-08-04T00:00:00Z"): DroneTelemetry => ({
  assetId, observedAt, operationalStatus: "OPERATING",
  geometry: { type: "Point", coordinates: [127.128, 36.812, 82] }, attributes: {},
});

function fixture() {
  const store = new TelemetryStore();
  const client = {
    status: () => ({ connected: true }),
    probe: async () => ({ connected: true, eventId: "event-1" }),
  };
  return { store, app: createApp(store, client as never) };
}

test("TelemetryStore는 자산별 최신값을 보관하고 최신 관측순으로 반환한다", () => {
  const store = new TelemetryStore();
  store.update(telemetry("a", "2026-08-04T00:00:00Z"));
  store.update(telemetry("b", "2026-08-04T00:00:02Z"));
  store.update(telemetry("a", "2026-08-04T00:00:03Z"));
  assert.equal(store.get().length, 2);
  assert.equal(store.get()[0].assetId, "a");
  assert.equal(store.get("a")?.observedAt, "2026-08-04T00:00:03Z");
  assert.equal(store.get("missing"), null);
});

test("TelemetryStore 구독자는 갱신을 받고 해제 후에는 받지 않는다", () => {
  const store = new TelemetryStore();
  const received: string[] = [];
  const unsubscribe = store.subscribe((item) => received.push(item.assetId));
  store.update(telemetry("a"));
  unsubscribe();
  store.update(telemetry("b"));
  assert.deepEqual(received, ["a"]);
});

test("GCS 어댑터 health·bridge·telemetry 조회가 동작한다", async () => {
  const { app, store } = fixture();
  store.update(telemetry("10000000-0000-4000-8000-000000000001"));
  assert.equal((await app.request("/health")).status, 200);
  assert.equal((await app.request("/bridge/status")).status, 200);
  const response = await app.request("/telemetry");
  assert.equal(response.status, 200);
  assert.equal((await response.json()).data.length, 1);
  assert.equal((await app.request("/telemetry/missing")).status, 200);
});

test("HTTP 텔레메트리는 필수값을 검증하고 수신 출처를 기록한다", async () => {
  const { app, store } = fixture();
  const invalid = await app.request("/telemetry", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
  assert.equal(invalid.status, 400);
  const valid = await app.request("/telemetry", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(telemetry("drone-1")) });
  assert.equal(valid.status, 200);
  assert.equal(store.get("drone-1")?.attributes.source, "HTTP");
});

test("상태 조회는 허용하지만 비행 제어 명령은 안전 승인 전 차단한다", async () => {
  const { app } = fixture();
  const ping = await app.request("/command", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ command: "PING" }) });
  const flight = await app.request("/command", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ command: "TAKEOFF" }) });
  assert.equal(ping.status, 200);
  assert.equal(flight.status, 501);
  assert.equal((await flight.json()).error.code, "FLIGHT_COMMAND_DISABLED");
  assert.equal((await app.request("/unknown")).status, 404);
});
