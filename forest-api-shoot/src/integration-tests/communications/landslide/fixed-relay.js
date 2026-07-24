import { definition, IDS, now, sitePoint } from "../../shared.js";
export default definition({
  id: "landslide.fixed-relay", name: "설치형 임시 중계기", domain: "landslide", category: "communication", direction: "BIDIRECTIONAL",
  eventId: IDS.landslideEvent, sourceSystem: "mock-fixed-relay",
  invoke: { deviceId: "FIXED-RELAY-001", action: "request-status" },
  result: () => ({ deviceId: "FIXED-RELAY-001", status: "online", observedAt: now(), position: sitePoint("landslide", -260, -120, 42), links: [{ channel: "tvws", signalStrengthDbm: -67, latencyMs: 42 }] }),
});
