import { definition, IDS, now, sitePoint } from "../../shared.js";
export default definition({
  id: "wildfire.tvws-network", name: "TVWS 통신망", domain: "wildfire", category: "communication", direction: "BIDIRECTIONAL",
  eventId: IDS.wildfireEvent, sourceSystem: "mock-tvws-station",
  invoke: { command: "SET_CHANNEL", assetId: IDS.tvws, channel: 27, txPowerDbm: 30 },
  result: () => ({ assetId: IDS.tvws, observedAt: now(), operationalStatus: "ACTIVE", geometry: sitePoint("wildfire", -180, 120, 250), signalStrengthDbm: -66, throughputMbps: 31.4, attributes: { channel: 27, txPowerDbm: 30 } }),
});
