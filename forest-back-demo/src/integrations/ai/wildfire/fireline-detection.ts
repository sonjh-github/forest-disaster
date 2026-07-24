import type { IntegrationCapability } from "../../shared/contracts.js";
export const firelineDetectionCapability: IntegrationCapability = {
  id: "wildfire.ignition-detection", domain: "wildfire", kind: "ai", direction: "BIDIRECTIONAL",
  description: "위성영상에서 ViT 기반 산불 발화점 영역을 탐지",
  inputFields: ["mediaUri", "capturedAt"], outputFields: ["observedAt", "ignitionPoints", "confidence", "sourceSystem"],
  endpointEnv: "AI_WILDFIRE_IGNITION_URL",
};
