import type { IntegrationCapability } from "../../shared/contracts.js";
export const vehicleRoadAnalysisCapability: IntegrationCapability = {
  id: "wildfire.vehicle-road-analysis", domain: "wildfire", kind: "ai", direction: "BIDIRECTIONAL",
  description: "항공영상 차량 탐지와 도로 세그멘테이션",
  inputFields: ["mediaUri", "capturedAt"], outputFields: ["observedAt", "vehicleBoxes", "roadMask", "confidence"],
  endpointEnv: "AI_WILDFIRE_VEHICLE_ROAD_URL",
};
