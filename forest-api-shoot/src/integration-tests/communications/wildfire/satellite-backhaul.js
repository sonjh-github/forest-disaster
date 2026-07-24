import { definition, IDS, now } from "../../shared.js";
export default definition({
  id: "wildfire.private-5g-ntn", name: "이음5G·LEO NTN", domain: "wildfire", category: "communication", direction: "INBOUND",
  eventId: IDS.wildfireEvent, sourceSystem: "mock-leo-terminal",
  result: () => ({ networkId: IDS.wildfireNetwork, status: "DEGRADED", startedAt: now(), reasonCode: "LATENCY_HIGH", reasonDetail: "latency=126ms, loss=1.8%, throughput=12.4Mbps" }),
});
