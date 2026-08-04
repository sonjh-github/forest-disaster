import { definition, IDS, now, sitePoint } from "../../shared.js";
export default definition({
  id: "landslide.gcs", name: "드론 GCS", domain: "landslide", category: "communication", direction: "BIDIRECTIONAL",
  eventId: IDS.landslideEvent, sourceSystem: "mock-gcs",
  reportedByAssetId: IDS.gcs, reportingRole: "GCS",
  invoke: { command: "START_MISSION", assetId: IDS.landslideUav, missionId: "MOCK-MISSION-001" },
  result: () => ({ assetId: IDS.landslideUav, observedAt: now(), geometry: sitePoint("landslide", 100, 160, 180), operationalStatus: "ACTIVE", batteryPct: 82, attributes: { missionId: "MOCK-MISSION-001", headingDeg: 125, mediaUri: "mock://gcs/live/001" } }),
});
