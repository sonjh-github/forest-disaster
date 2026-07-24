import { definition, IDS, now } from "../../shared.js";
export default definition({
  id: "landslide.ir-uwb-gpr", name: "IR-UWB/GPR 탐지기", domain: "landslide", category: "communication", direction: "INBOUND",
  eventId: IDS.landslideEvent, sourceSystem: "mock-ir-uwb-gpr",
  result: () => ({ deviceId: "UWB-GPR-001", status: "operating", observedAt: now(), rawSignal: { sampleRateHz: 100, samples: [0.11, 0.18, 0.42, 0.21] } }),
});
