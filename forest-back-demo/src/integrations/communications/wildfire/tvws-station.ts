import type { IntegrationCapability } from "../../shared/contracts.js";

export const tvwsStationCapability: IntegrationCapability = {
  id: "wildfire.tvws-network",
  domain: "wildfire", kind: "communication", direction: "BIDIRECTIONAL",
  description: "산불 현장 TVWS 기지국 상태수집과 채널·출력·활성화 명령",
  inputFields: ["command", "assetId"],
  outputFields: ["assetId", "observedAt", "operationalStatus", "signalStrengthDbm", "throughputMbps", "attributes"],
  endpointEnv: "TVWS_STATION_API_URL",
  resultTarget: { schema: "core", table: "asset_status" },
};
