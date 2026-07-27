import assert from "node:assert/strict";
import test from "node:test";
import { common, minimal } from "node-mavlink";
import { TelemetryAggregator } from "../src/mavlink/telemetry-aggregator.js";

test("MAVLink 위치와 상태를 공통 텔레메트리로 변환한다", () => {
  const aggregator = new TelemetryAggregator();
  const heartbeat = new minimal.Heartbeat();
  heartbeat.baseMode = 128;
  heartbeat.customMode = 4;
  heartbeat.mavlinkVersion = 3;
  aggregator.accept("172.30.1.50", 1, 1, heartbeat);

  const battery = new common.SysStatus();
  battery.batteryRemaining = 73;
  battery.voltageBattery = 22400;
  aggregator.accept("172.30.1.50", 1, 1, battery);

  const position = new common.GlobalPositionInt();
  position.lat = 368120000;
  position.lon = 1271280000;
  position.alt = 82000;
  position.relativeAlt = 64000;
  position.hdg = 12500;
  position.vx = 820;
  position.vy = 0;
  const result = aggregator.accept("172.30.1.50", 1, 1, position);

  assert.ok(result);
  assert.deepEqual(result.geometry.coordinates, [127.128, 36.812, 82]);
  assert.equal(result.operationalStatus, "OPERATING");
  assert.equal(result.attributes.batteryPercent, 73);
  assert.equal(result.attributes.headingDeg, 125);
  assert.equal(result.attributes.sourceAddress, "172.30.1.50");
  assert.match(result.assetId, /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
});
