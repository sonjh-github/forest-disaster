import type { IntegrationCapability } from "../../shared/contracts.js";

export const satelliteBackhaulCapability: IntegrationCapability = {
  id: "wildfire.private-5g-ntn",
  domain: "wildfire", kind: "communication", direction: "INBOUND",
  description: "LEO 위성 백홀의 연결·지연·손실·처리량 상태 수집",
  inputFields: [],
  outputFields: ["networkId", "status", "startedAt", "reasonCode", "reasonDetail"],
  resultTarget: { schema: "core", table: "network_status_history" },
};
