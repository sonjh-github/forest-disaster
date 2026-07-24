import { definition, IDS, now } from "../../shared.js";
export default definition({
  id: "landslide.ref-ap", name: "Ref AP 기준신호", domain: "landslide", category: "communication", direction: "BIDIRECTIONAL",
  eventId: IDS.landslideEvent, sourceSystem: "mock-ref-ap",
  invoke: { deviceId: "REF-AP-001", action: "request-status" },
  result: () => ({ deviceId: "REF-AP-001", status: "online", observedAt: now(), referenceRssiDbm: -48, rttMs: 21 }),
});
