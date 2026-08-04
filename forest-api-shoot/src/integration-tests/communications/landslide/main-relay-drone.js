import { definition, IDS, now, sitePoint } from "../../shared.js";
export default definition({
  id: "landslide.main-relay-drone", name: "메인 중계기 드론", domain: "landslide", category: "communication", direction: "BIDIRECTIONAL",
  eventId: IDS.landslideEvent, sourceSystem: "mock-main-relay",
  reportedByAssetId: IDS.gcs, reportingRole: "GCS",
  invoke: { deviceId: "MAIN-RELAY-001", action: "request-status" },
  result: () => ({ sourceAssetId: IDS.landslideUav, deviceId: "MAIN-RELAY-001", status: "operating", observedAt: now(), position: sitePoint("landslide", 180, 220, 180), links: [{ channel: "tvws", signalStrengthDbm: -62, latencyMs: 35 }] }),
});
