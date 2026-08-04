import type { IntegrationCapability } from "../../shared/contracts.js";
export const mainRelayDroneCapability: IntegrationCapability = {
  id: "landslide.main-relay-drone", domain: "landslide", kind: "communication", direction: "BIDIRECTIONAL",
  description: "산사태 현장 메인 중계기 드론 상태·제어",
  inputFields: ["deviceId", "action"], outputFields: ["sourceAssetId", "deviceId", "status", "position", "links"],
  endpointEnv: "DEVICE_LANDSLIDE_MAIN_RELAY_URL",
};
