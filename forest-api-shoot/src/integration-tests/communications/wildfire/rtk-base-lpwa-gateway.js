import { definition, IDS, now } from "../../shared.js";
export default definition({
  id: "wildfire.rtk-base-lpwa-gateway", name: "RTK 기준국·LPWA 게이트웨이", domain: "wildfire", category: "communication", direction: "BIDIRECTIONAL",
  eventId: IDS.wildfireEvent, sourceSystem: "mock-rtk-base",
  invoke: { deviceId: "RTK-BASE-001", action: "request-status" },
  result: () => ({ deviceId: "RTK-BASE-001", status: "online", observedAt: now(), rtcmCorrection: { format: "RTCM3", ageSeconds: 0.8 }, links: [{ channel: "lpwa", signalStrengthDbm: -71, latencyMs: 180 }] }),
});
