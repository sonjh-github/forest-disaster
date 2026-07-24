import type { IntegrationCapability } from "../../shared/contracts.js";
export const changeDetectionCapability: IntegrationCapability = {
  id: "landslide.change-detection", domain: "landslide", kind: "ai", direction: "BIDIRECTIONAL",
  description: "시계열 드론영상의 산사태 지형 변화 탐지",
  inputFields: ["beforeMediaUri", "afterMediaUri"], outputFields: ["observedAt", "changeGeometry", "confidence"],
  endpointEnv: "AI_LANDSLIDE_CHANGE_DETECTION_URL",
};
