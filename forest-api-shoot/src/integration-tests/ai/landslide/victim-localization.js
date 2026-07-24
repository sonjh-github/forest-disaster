import { definition, IDS, now, sitePoint } from "../../shared.js";
export default definition({
  id: "landslide.rssi-localization", name: "조난자 위치추정 AI", domain: "landslide", category: "ai", direction: "BIDIRECTIONAL",
  eventId: IDS.landslideEvent, sourceSystem: "mock-ai-victim-localization",
  invoke: { targetToken: "MOCK-TARGET-001", detections: [{ detectorAssetId: IDS.rssi1, rssiDbm: -73, bearingDeg: 112 }, { detectorAssetId: IDS.rssi2, rssiDbm: -78, bearingDeg: 248 }], attenuationModel: { soilType: "COLLAPSED_MIXED", coefficient: 2.8 } },
  result: () => ({ candidateToken: `MOCK-CANDIDATE-${Date.now()}`, detectionStatus: "ESTIMATED", firstDetectedAt: now(), lastDetectedAt: now(), estimatedPosition: sitePoint("landslide", 40, -30, 191), estimatedDepthM: 9.6, confidence: 0.79, signalTypes: ["WIFI_RSSI", "BEARING", "TDOA", "UWB"] }),
});
