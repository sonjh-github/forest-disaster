import { definition, IDS, now, sitePoint } from "../../shared.js";
export default definition({
  id: "wildfire.rtk-terminal", name: "RTK/GNSS 대원 위치", domain: "wildfire", category: "communication", direction: "INBOUND",
  eventId: IDS.wildfireEvent, sourceSystem: "mock-rtk-terminal",
  reportedByAssetId: IDS.rtkGateway, reportingRole: "GATEWAY",
  result: () => {
    const observedAt = now();
    return {
      personExternalId: "MOCK-PERSON-001",
      observedAt,
      transmittedAt: observedAt,
      geometry: sitePoint("wildfire", 80, -60, 242),
      horizontalAccuracyM: 0.12,
      positioningMethod: "RTK_FIXED",
      gnssFixQuality: "FIX",
      primaryLink: "LPWA",
      fallbackLink: "LTE",
      activeLink: "LPWA",
      fallbackActivated: false,
      lastPrimaryLinkAt: observedAt,
      signalStrengthDbm: -58,
      batteryPercent: 86,
      activityStatus: "MOVING",
      safetyStatus: "SAFE",
      emergency: false,
      sourceAssetId: IDS.rtk,
      sourceSystem: "mock-rtk-terminal",
      qualityStatus: "VALIDATED",
    };
  },
});
