import { definition, IDS, now } from "../../shared.js";
export default definition({
  id: "common.network-bonding", name: "이기종 통신망 본딩·스위칭", domain: "common", category: "communication", direction: "INBOUND",
  eventId: IDS.wildfireEvent, sourceSystem: "mock-nms",
  result: () => ({ networkId: IDS.wildfireNetwork, status: "ACTIVE", startedAt: now(), reasonCode: "QUALITY_OK", reasonDetail: "latency=38ms, loss=0.4%, throughput=24.2Mbps" }),
});
