import type { IntegrationCapability } from "../../shared/contracts.js";
export const victimLocalizationCapability: IntegrationCapability = {
  id: "landslide.rssi-localization", domain: "landslide", kind: "ai", direction: "BIDIRECTIONAL",
  description: "RSSI·방위·TDOA/UWB·감쇠모델을 융합한 조난자 후보 위치·깊이 추정",
  inputFields: ["targetToken", "detections", "attenuationModel"], outputFields: ["candidateToken", "detectionStatus", "firstDetectedAt", "lastDetectedAt", "estimatedPosition", "estimatedDepthM", "confidence", "signalTypes"],
  endpointEnv: "AI_VICTIM_LOCALIZATION_URL", resultTarget: { schema: "landslide", table: "victim_candidate" },
};
