import type { IntegrationCapability } from "../../shared/contracts.js";
export const victimLocalizationCapability: IntegrationCapability = {
  id: "landslide.rssi-localization", domain: "landslide", kind: "ai", direction: "BIDIRECTIONAL",
  description: "Ref_AP 3대(XY)·4대(XYZ), Rover_AP 그리드 관측과 RSSI·위상·진폭·RTK를 이용한 조난자 후보 추정",
  inputFields: ["targetToken", "coordinateMode", "detections", "attenuationModel"], outputFields: ["candidateToken", "detectionStatus", "firstDetectedAt", "lastDetectedAt", "estimatedPosition", "confidence", "method", "signalTypes", "evidenceStatus"],
  endpointEnv: "AI_VICTIM_LOCALIZATION_URL", resultTarget: { schema: "landslide", table: "victim_candidate" },
};
