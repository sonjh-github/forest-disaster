import type { IntegrationCapability } from "../../shared/contracts.js";

export const networkTelemetryCapability: IntegrationCapability = {
  id: "common.network-bonding",
  domain: "common", kind: "communication", direction: "INBOUND",
  description: "TVWS·5G·LTE·위성 등 이기종 망의 상태·지연·손실·전송률 수집",
  inputFields: [],
  outputFields: ["networkId", "status", "startedAt"],
  resultTarget: { schema: "core", table: "network_status_history" },
};
