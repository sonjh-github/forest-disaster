import type { IntegrationCapability } from "../../shared/contracts.js";
export const irUwbGprCapability: IntegrationCapability = {
  id: "landslide.ir-uwb-gpr", domain: "landslide", kind: "communication", direction: "INBOUND",
  description: "IR-UWB/GPR 탐지 원시신호와 장비 상태 수신",
  inputFields: [], outputFields: ["deviceId", "status", "observedAt", "rawSignal"],
};
