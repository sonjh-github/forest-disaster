import { definition, IDS, now, sitePoint } from "../../shared.js";
export default definition({
  id: "landslide.rover-ap", name: "Rover AP RSSI 탐지기", domain: "landslide", category: "communication", direction: "INBOUND",
  eventId: IDS.landslideEvent, sourceSystem: "mock-rssi-scanner",
  result: () => ({
    targetToken: `MOCK-TARGET-${Date.now()}`,
    detectorAssetId: IDS.rssi1,
    detectorRole: "ROVER_AP",
    gridCellId: "GRID-12-08",
    detectedAt: now(),
    detectorPosition: sitePoint("landslide", -120, 80, 198),
    rssiDbm: -73,
    phaseDeg: 42.8,
    amplitude: 0.61,
    roundTripTimeNs: 84.2,
    frequencyMhz: 2437,
    confidence: 0.81,
    method: "ROVER_GRID_SCAN",
  }),
});
