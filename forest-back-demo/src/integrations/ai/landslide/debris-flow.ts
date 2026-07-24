import type { IntegrationCapability } from "../../shared/contracts.js";
export const debrisFlowCapability: IntegrationCapability = {
  id: "landslide.debris-flow", domain: "landslide", kind: "ai", direction: "BIDIRECTIONAL",
  description: "사면 위험·토질·강우를 이용한 토석류 경로·영향범위 예측",
  inputFields: ["slopeId", "terrainUri", "soil", "rainfall"], outputFields: ["externalSlopeId", "baseTime", "forecastTime", "flowPath", "affectedArea", "estimatedVolumeM3", "maxVelocityMps", "result"],
  endpointEnv: "AI_DEBRIS_FLOW_URL", resultTarget: { schema: "landslide", table: "debris_flow_prediction" },
};
