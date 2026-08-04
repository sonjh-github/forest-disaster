import { definition, IDS, now, sitePoint } from "../../shared.js";
export default definition({
  id: "landslide.rssi-localization", name: "조난자 위치추정 AI", domain: "landslide", category: "ai", direction: "BIDIRECTIONAL",
  eventId: IDS.landslideEvent, sourceSystem: "mock-ai-victim-localization",
  invoke: {
    targetToken: "MOCK-TARGET-001",
    coordinateMode: "XYZ",
    detections: [
      { detectorAssetId: IDS.rssi1, detectorRole: "REF_AP", detectorPosition: sitePoint("landslide", -80, -60, 198), rssiDbm: -73, phaseDeg: 42.8, amplitude: 0.61 },
      { detectorAssetId: IDS.rssi2, detectorRole: "REF_AP", detectorPosition: sitePoint("landslide", 80, -60, 201), rssiDbm: -78, phaseDeg: 51.2, amplitude: 0.55 },
      { detectorAssetId: IDS.rssi3, detectorRole: "REF_AP", detectorPosition: sitePoint("landslide", -80, 60, 203), rssiDbm: -76, phaseDeg: 47.1, amplitude: 0.58 },
      { detectorAssetId: IDS.rssi4, detectorRole: "REF_AP", detectorPosition: sitePoint("landslide", 80, 60, 200), rssiDbm: -75, phaseDeg: 45.6, amplitude: 0.59 },
    ],
    roverGridObservations: [{ gridCellId: "GRID-12-08", rssiDbm: -71, roundTripTimeNs: 84.2 }],
    attenuationModel: { soilType: "COLLAPSED_MIXED", coefficient: 2.8 },
  },
  result: () => ({
    candidateToken: `MOCK-CANDIDATE-${Date.now()}`,
    detectionStatus: "ESTIMATED_UNREVIEWED",
    firstDetectedAt: now(),
    lastDetectedAt: now(),
    estimatedPosition: sitePoint("landslide", 40, -30, 194.5),
    estimatedDepthM: 3.5,
    horizontalErrorRadiusM: 7.5,
    confidence: 0.79,
    method: "REF_AP_4_XYZ_WITH_ROVER_GRID",
    signalTypes: ["WIFI_RSSI", "PHASE", "AMPLITUDE", "RTK", "ROUND_TRIP_TIME"],
    evidenceStatus: "SIMULATED_NOT_FIELD_MEASURED",
  }),
});
