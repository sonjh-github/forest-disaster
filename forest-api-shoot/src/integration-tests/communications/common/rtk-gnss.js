import { definition, IDS, now, sitePoint } from "../../shared.js";
export default definition({
  id: "wildfire.rtk-terminal", name: "RTK/GNSS 대원 위치", domain: "wildfire", category: "communication", direction: "INBOUND",
  eventId: IDS.wildfireEvent, sourceSystem: "mock-rtk-terminal",
  result: () => ({ personExternalId: "MOCK-PERSON-001", observedAt: now(), geometry: sitePoint("wildfire", 80, -60, 242), horizontalAccuracyM: 0.12, positioningMethod: "RTK_FIXED", activityStatus: "MOVING", safetyStatus: "SAFE", sourceAssetId: IDS.rtk, sourceSystem: "mock-rtk-terminal", qualityStatus: "VALIDATED" }),
});
