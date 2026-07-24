import type { IntegrationCapability } from "../../shared/contracts.js";
export const landslideRiskCapability: IntegrationCapability = {
  id: "landslide.risk-analysis", domain: "landslide", kind: "ai", direction: "BIDIRECTIONAL",
  description: "지형·지질·강우·변위를 이용한 사면 위험도와 설명 결과 산출",
  inputFields: ["slopeId", "terrainUri", "rainfall", "sensorObservations"], outputFields: ["externalSlopeId", "assessedAt", "riskScore", "riskLevel", "probability", "modelName", "modelVersion", "result"],
  endpointEnv: "AI_LANDSLIDE_RISK_URL", resultTarget: { schema: "landslide", table: "slope_assessment" },
};
