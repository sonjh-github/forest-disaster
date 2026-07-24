import type { IntegrationCapability } from "../../shared/contracts.js";
export const vitalSignalAnalysisCapability: IntegrationCapability = {
  id: "landslide.vital-signal-analysis", domain: "landslide", kind: "ai", direction: "BIDIRECTIONAL",
  description: "IR-UWB/GPR 신호 기반 생체신호 분석",
  inputFields: ["rawSignal"], outputFields: ["modelId", "resultType", "output"],
  endpointEnv: "AI_LANDSLIDE_VITAL_SIGNAL_URL",
};
