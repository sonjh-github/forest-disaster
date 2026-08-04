import type { IntegrationCapability } from "../../shared/contracts.js";

export const mobileRelayCapability: IntegrationCapability = {
  id: "wildfire.mobile-command-hub",
  domain: "wildfire", kind: "communication", direction: "BIDIRECTIONAL",
  description: "차량·드론·배낭형 이동중계기 상태수집 및 전개/활성화/중지 명령",
  owner: "NDPS",
  boundary: "EXTERNAL",
  evidenceStatus: "CONTRACT_ONLY",
  inputFields: ["command", "assetId"],
  outputFields: ["assetId", "observedAt", "operationalStatus", "geometry", "batteryPct", "attributes"],
  endpointEnv: "MOBILE_RELAY_API_URL",
  resultTarget: { schema: "core", table: "asset_status" },
};
