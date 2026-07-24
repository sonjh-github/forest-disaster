import { definition, IDS, now } from "../../shared.js";
export default definition({
  id: "wildfire.radio-gateway", name: "400MHz 무전기 게이트웨이", domain: "wildfire", category: "communication", direction: "BIDIRECTIONAL",
  eventId: IDS.wildfireEvent, sourceSystem: "mock-radio-gateway",
  invoke: { deviceId: "RADIO-GW-001", action: "request-status" },
  result: () => ({ deviceId: "RADIO-GW-001", status: "online", observedAt: now(), payload: { channel: "400mhz", activeTalkGroups: 2 } }),
});
