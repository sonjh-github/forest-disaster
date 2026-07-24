import { definition, IDS, now, sitePoint } from "../../shared.js";
export default definition({
  id: "landslide.rover-ap", name: "Rover AP RSSI 탐지기", domain: "landslide", category: "communication", direction: "INBOUND",
  eventId: IDS.landslideEvent, sourceSystem: "mock-rssi-scanner",
  result: () => ({ targetToken: `MOCK-TARGET-${Date.now()}`, detectorAssetId: IDS.rssi1, detectedAt: now(), detectorPosition: sitePoint("landslide", -120, 80, 198), rssiDbm: -73, frequencyMhz: 2437, confidence: 0.81, method: "REF_ROVER_FUSION" }),
});
