import type { IntegrationCapability } from "../../shared/contracts.js";
export const relayPlacementCapability: IntegrationCapability = {
  id: "wildfire.relay-placement", domain: "wildfire", kind: "ai", direction: "BIDIRECTIONAL",
  description: "통신음영·지형·접근성·전원을 반영한 중계기 배치 후보 추천",
  inputFields: ["coverageResultId", "availableAssets", "constraints"], outputFields: ["analysisType", "targetType", "modelName", "modelVersion", "analyzedAt", "result"],
  endpointEnv: "AI_RELAY_PLACEMENT_URL", resultTarget: { schema: "core", table: "ai_analysis_result" },
};
