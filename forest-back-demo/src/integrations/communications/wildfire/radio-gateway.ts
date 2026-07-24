import type { IntegrationCapability } from "../../shared/contracts.js";
export const radioGatewayCapability: IntegrationCapability = {
  id: "wildfire.radio-gateway", domain: "wildfire", kind: "communication", direction: "BIDIRECTIONAL",
  description: "400MHz 디지털무전기 음성·메시지 게이트웨이",
  inputFields: ["deviceId", "action"], outputFields: ["deviceId", "status", "payload"],
  endpointEnv: "DEVICE_WILDFIRE_RADIO_GATEWAY_URL",
};
