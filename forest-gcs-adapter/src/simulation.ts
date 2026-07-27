import type { DroneTelemetry } from "./types.js";
import { TelemetryStore } from "./telemetry-store.js";

export function startSimulation(store: TelemetryStore, assetId: string, intervalMs: number) {
  const center = { longitude: 127.128, latitude: 36.812 };
  let tick = 0;
  const publish = () => {
    tick += 1;
    const angle = tick / 24;
    const telemetry: DroneTelemetry = {
      assetId,
      observedAt: new Date().toISOString(),
      geometry: {
        type: "Point",
        coordinates: [
          center.longitude + Math.cos(angle) * 0.002,
          center.latitude + Math.sin(angle) * 0.0014,
          82 + Math.sin(angle * 0.7) * 4,
        ],
      },
      operationalStatus: "OPERATING",
      attributes: {
        systemId: 1,
        componentId: 1,
        altitudeM: 82 + Math.sin(angle * 0.7) * 4,
        relativeAltitudeM: 64,
        headingDeg: (angle * 180 / Math.PI + 90) % 360,
        groundSpeedMps: 8.2,
        batteryPercent: Math.max(25, 96 - Math.floor(tick / 30)),
        batteryVoltageV: 22.4,
        rollDeg: Math.sin(angle) * 3,
        pitchDeg: Math.cos(angle) * 2,
        yawDeg: (angle * 180 / Math.PI) % 360,
        flightMode: 4,
        armed: true,
        missionSequence: Math.floor(tick / 10) % 8,
        mavlinkVersion: 3,
        source: "SIMULATION",
      },
    };
    store.update(telemetry);
  };
  publish();
  const timer = setInterval(publish, intervalMs);
  return () => clearInterval(timer);
}
