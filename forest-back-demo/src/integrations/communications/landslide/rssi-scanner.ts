import type { IntegrationCapability } from "../../shared/contracts.js";

export const rssiScannerCapability: IntegrationCapability = {
  id: "landslide.rover-ap",
  domain: "landslide", kind: "communication", direction: "INBOUND",
  description: "Ref_AP/Rover_AP의 익명 조난신호·RSSI·위상·진폭·RTT·RTK 위치 수집",
  inputFields: [],
  outputFields: ["targetToken", "detectorAssetId", "detectorRole", "detectedAt", "detectorPosition", "rssiDbm", "method"],
  resultTarget: { schema: "landslide", table: "rssi_detection" },
};
