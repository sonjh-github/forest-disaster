import type { IntegrationCapability } from "../../shared/contracts.js";
export const attenuationCorrectionCapability: IntegrationCapability = {
  id: "landslide.attenuation-correction", domain: "landslide", kind: "ai", direction: "BIDIRECTIONAL",
  description: "붕괴지반 환경의 IR-UWB/GPR 신호 감쇠 보정",
  inputFields: ["rawSignal", "groundCondition"], outputFields: ["modelId", "resultType", "correctedSignal"],
  endpointEnv: "AI_LANDSLIDE_ATTENUATION_URL",
};
