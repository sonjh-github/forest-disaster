import type { IntegrationCapability } from "../../shared/contracts.js";
export const rtkBaseLpwaGatewayCapability: IntegrationCapability = {
  id: "wildfire.rtk-base-lpwa-gateway", domain: "wildfire", kind: "communication", direction: "BIDIRECTIONAL",
  description: "이동식 RTK 기준국의 RTCM 보정정보와 LPWA 게이트웨이 상태 연동",
  inputFields: ["deviceId", "action"], outputFields: ["deviceId", "status", "rtcmCorrection", "links"],
  endpointEnv: "DEVICE_WILDFIRE_RTK_BASE_LPWA_URL",
};
