import { definition, IDS, now, sitePoint } from "../../shared.js";
export default definition({
  id: "wildfire.mobile-command-hub", name: "이동형 지휘차량 통신허브", domain: "wildfire", category: "communication", direction: "BIDIRECTIONAL",
  eventId: IDS.wildfireEvent, sourceSystem: "mock-mobile-command-hub",
  invoke: { command: "ACTIVATE", assetId: IDS.command },
  result: () => ({ assetId: IDS.command, observedAt: now(), operationalStatus: "ACTIVE", geometry: sitePoint("wildfire", 220, -140, 285), batteryPct: 76, signalStrengthDbm: -71, latencyMs: 44, throughputMbps: 18.5, packetLossPct: 0.7, attributes: { backhaul: "LEO" } }),
});
