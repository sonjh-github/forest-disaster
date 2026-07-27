import { common, minimal, type MavLinkData } from "node-mavlink";
import { createHash } from "node:crypto";
import type { DroneTelemetry } from "../types.js";

type VehicleState = {
  systemId: number;
  componentId?: number;
  lat?: number;
  lon?: number;
  altitudeM?: number;
  relativeAltitudeM?: number;
  headingDeg?: number;
  groundSpeedMps?: number;
  batteryPercent?: number;
  batteryVoltageV?: number;
  rollDeg?: number;
  pitchDeg?: number;
  yawDeg?: number;
  flightMode?: number;
  armed?: boolean;
  missionSequence?: number;
  mavlinkVersion?: number;
  lastHeartbeatAt?: number;
  sourceAddress: string;
};

const radiansToDegrees = (value: number) => value * 180 / Math.PI;
const DRONE_NAMESPACE = "6ba7b8119dad11d180b400c04fd430c8";

function stableUuid(name: string) {
  const namespace = Buffer.from(DRONE_NAMESPACE, "hex");
  const bytes = createHash("sha1").update(namespace).update(name).digest().subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export class TelemetryAggregator {
  #states = new Map<string, VehicleState>();

  accept(sourceAddress: string, systemId: number, componentId: number, message: MavLinkData): DroneTelemetry | null {
    const sourceKey = `${sourceAddress}:${systemId}`;
    const state = this.#states.get(sourceKey) ?? { systemId, sourceAddress };
    state.componentId = componentId;

    if (message instanceof minimal.Heartbeat) {
      state.flightMode = message.customMode;
      state.armed = (Number(message.baseMode) & 128) === 128;
      state.mavlinkVersion = message.mavlinkVersion;
      state.lastHeartbeatAt = Date.now();
    } else if (message instanceof common.GlobalPositionInt) {
      state.lat = message.lat / 1e7;
      state.lon = message.lon / 1e7;
      state.altitudeM = message.alt / 1000;
      state.relativeAltitudeM = message.relativeAlt / 1000;
      state.headingDeg = message.hdg === 65535 ? undefined : message.hdg / 100;
      state.groundSpeedMps = Math.hypot(message.vx, message.vy) / 100;
    } else if (message instanceof common.SysStatus) {
      state.batteryPercent = message.batteryRemaining < 0 ? undefined : message.batteryRemaining;
      state.batteryVoltageV = message.voltageBattery === 65535 ? undefined : message.voltageBattery / 1000;
    } else if (message instanceof common.Attitude) {
      state.rollDeg = radiansToDegrees(message.roll);
      state.pitchDeg = radiansToDegrees(message.pitch);
      state.yawDeg = radiansToDegrees(message.yaw);
    } else if (message instanceof common.MissionCurrent) {
      state.missionSequence = message.seq;
    } else {
      return null;
    }

    this.#states.set(sourceKey, state);
    if (state.lat === undefined || state.lon === undefined) return null;
    const heartbeatAge = state.lastHeartbeatAt ? Date.now() - state.lastHeartbeatAt : Number.POSITIVE_INFINITY;
    const operationalStatus = heartbeatAge > 10_000 ? "DEGRADED" : state.armed ? "OPERATING" : "ONLINE";
    return {
      assetId: stableUuid(`forest-gcs:${sourceKey}`),
      observedAt: new Date().toISOString(),
      geometry: { type: "Point", coordinates: [state.lon, state.lat, state.altitudeM] },
      operationalStatus,
      attributes: { ...state, source: "MAVLINK" },
    };
  }
}
