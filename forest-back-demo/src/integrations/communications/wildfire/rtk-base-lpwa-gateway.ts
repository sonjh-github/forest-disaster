import type { IntegrationCapability } from "../../shared/contracts.js";

export function assertRtkLpwaGatewayStatus(value: Record<string, unknown>) {
  if (!["ONLINE", "DEGRADED", "OFFLINE"].includes(String(value.operationalStatus))) {
    throw new Error("operationalStatus는 ONLINE, DEGRADED 또는 OFFLINE이어야 합니다.");
  }
  if (!["BROADCAST", "MULTICAST"].includes(String(value.deliveryMode))) {
    throw new Error("deliveryMode는 BROADCAST 또는 MULTICAST여야 합니다.");
  }
  if (Number.isNaN(Date.parse(String(value.observedAt)))) {
    throw new Error("observedAt은 ISO 8601 시각이어야 합니다.");
  }
  for (const field of ["beaconChannel", "uplinkChannelCount", "connectedTerminals"] as const) {
    const number = Number(value[field]);
    if (!Number.isInteger(number) || number < 0) throw new Error(`${field}는 0 이상의 정수여야 합니다.`);
  }
}

export const rtkBaseLpwaGatewayCapability: IntegrationCapability = {
  id: "wildfire.rtk-base-lpwa-gateway",
  domain: "wildfire",
  kind: "communication",
  direction: "BIDIRECTIONAL",
  description: "이동형 RTK 기준국의 RTCM 보정정보 방송과 LPWA 단말 슬롯 및 Ethernet 백홀 상태 연동",
  inputFields: ["assetId", "action"],
  outputFields: [
    "assetId", "observedAt", "operationalStatus", "rtcmFormat", "rtcmAvailable",
    "deliveryMode", "beaconChannel", "uplinkChannelCount", "connectedTerminals",
    "allocatedSlots", "ethernetBackhaul",
  ],
  endpointEnv: "DEVICE_WILDFIRE_RTK_BASE_LPWA_URL",
  resultTarget: { schema: "wildfire", table: "rtk_lpwa_gateway_status" },
};
