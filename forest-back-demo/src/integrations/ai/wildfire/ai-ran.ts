import type { IntegrationCapability } from "../../shared/contracts.js";
export const aiRanCapability: IntegrationCapability = {
  id: "wildfire.ai-ran", domain: "wildfire", kind: "ai", direction: "BIDIRECTIONAL",
  description: "TN·NTN 셀 커버리지와 QoS 자원 최적화",
  inputFields: ["input"], outputFields: ["modelId", "resultType", "output"],
  endpointEnv: "AI_WILDFIRE_RAN_URL",
};
