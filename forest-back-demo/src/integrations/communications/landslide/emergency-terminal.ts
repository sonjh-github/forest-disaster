import type { IntegrationCapability } from "../../shared/contracts.js";

export const emergencyTerminalCapability: IntegrationCapability = {
  id: "landslide.ref-ap",
  domain: "landslide", kind: "communication", direction: "BIDIRECTIONAL",
  description: "Ref AP 기준 RSSI·LTE·RTT 상태 연동",
  inputFields: ["deviceId", "action"],
  outputFields: ["deviceId", "status", "observedAt", "referenceRssiDbm", "rttMs"],
  endpointEnv: "EMERGENCY_TERMINAL_API_URL",
};
