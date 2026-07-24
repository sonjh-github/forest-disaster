import type { IntegrationCapability } from "../../shared/contracts.js";
export const fixedRelayCapability: IntegrationCapability = {
  id: "landslide.fixed-relay", domain: "landslide", kind: "communication", direction: "BIDIRECTIONAL",
  description: "TVWS 기반 설치형 임시 중계기 상태·제어",
  inputFields: ["deviceId", "action"], outputFields: ["deviceId", "status", "position", "links"],
  endpointEnv: "DEVICE_LANDSLIDE_FIXED_RELAY_URL",
};
