import type { IntegrationCapability } from "../../shared/contracts.js";
export const communicationCoverageCapability: IntegrationCapability = {
  id: "common.gis-coverage", domain: "common", kind: "ai", direction: "BIDIRECTIONAL",
  description: "DEM/DSM·중계기·안테나 정보를 이용한 가시권 및 통신 음영 분석",
  inputFields: ["demUri", "nodes", "analysisArea"], outputFields: ["analysisType", "targetType", "modelName", "modelVersion", "analyzedAt", "result"],
  endpointEnv: "AI_COMMUNICATION_COVERAGE_URL", resultTarget: { schema: "core", table: "ai_analysis_result" },
};
