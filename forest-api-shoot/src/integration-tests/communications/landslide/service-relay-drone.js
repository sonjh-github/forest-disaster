import { definition, IDS, now, sitePoint } from "../../shared.js";
export default definition({
  id: "landslide.service-relay-drone", name: "서비스 중계기 드론", domain: "landslide", category: "communication", direction: "BIDIRECTIONAL",
  eventId: IDS.landslideEvent, sourceSystem: "mock-service-relay",
  reportedByAssetId: IDS.gcs, reportingRole: "GCS",
  invoke: { deviceId: "SERVICE-RELAY-001", action: "request-status" },
  result: () => ({ sourceAssetId: IDS.relay, deviceId: "SERVICE-RELAY-001", status: "operating", observedAt: now(), position: sitePoint("landslide", 80, -180, 120), links: [{ channel: "wifi", signalStrengthDbm: -58, latencyMs: 18 }] }),
});
