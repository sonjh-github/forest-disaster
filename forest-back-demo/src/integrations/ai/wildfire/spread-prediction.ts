import type { IntegrationCapability } from "../../shared/contracts.js";
export const wildfireSpreadCapability: IntegrationCapability = {
  id: "wildfire.fireline-prediction", domain: "wildfire", kind: "ai", direction: "BIDIRECTIONAL",
  description: "화선·기상·지형·연료 정보를 이용한 산불 확산 예측",
  inputFields: ["firelineId", "weather", "terrainUri", "fuelMapUri"], outputFields: ["modelName", "modelVersion", "baseTime", "forecastTime", "predictedArea", "confidence"],
  endpointEnv: "AI_WILDFIRE_SPREAD_URL", resultTarget: { schema: "wildfire", table: "spread_prediction" },
};
