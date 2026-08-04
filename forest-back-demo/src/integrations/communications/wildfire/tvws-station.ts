import type { IntegrationCapability } from "../../shared/contracts.js";

export function assertTvwsLinkObservation(value: Record<string, unknown>) {
  if (!["ONLINE", "DEGRADED", "OFFLINE"].includes(String(value.operationalStatus))) {
    throw new Error("operationalStatus는 ONLINE, DEGRADED 또는 OFFLINE이어야 합니다.");
  }
  if (value.ingressMedium !== "ETHERNET") {
    throw new Error("TVWS 장비의 게이트웨이 인입 매체 ingressMedium은 ETHERNET이어야 합니다.");
  }
  if (!["TVWS", "LTE", "5G", "LEO", "ETHERNET"].includes(String(value.backhaulType))) {
    throw new Error("backhaulType은 TVWS, LTE, 5G, LEO 또는 ETHERNET이어야 합니다.");
  }
  if (Number.isNaN(Date.parse(String(value.observedAt)))) {
    throw new Error("observedAt은 ISO 8601 시각이어야 합니다.");
  }
}

export const tvwsStationCapability: IntegrationCapability = {
  id: "wildfire.tvws-network",
  domain: "wildfire",
  kind: "communication",
  direction: "BIDIRECTIONAL",
  description: "TVWS Base-CPE 무선 구간과 Ethernet 인입, 외부 백홀의 운용 상태를 수집하고 제어 명령을 연계",
  owner: "JININFRA",
  boundary: "EXTERNAL",
  evidenceStatus: "CONTRACT_ONLY",
  inputFields: ["command", "cpeAssetId"],
  outputFields: [
    "baseAssetId", "cpeAssetId", "observedAt", "operationalStatus", "channel",
    "signalStrengthDbm", "throughputMbps", "latencyMs", "packetLossPct", "distanceM",
    "ingressMedium", "backhaulType", "backhaulAvailable", "connectedTerminals",
  ],
  endpointEnv: "TVWS_STATION_API_URL",
  resultTarget: { schema: "wildfire", table: "tvws_link_observation" },
};
