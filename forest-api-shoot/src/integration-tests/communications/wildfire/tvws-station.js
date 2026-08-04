import { definition, IDS, now } from "../../shared.js";
export default definition({
  id: "wildfire.tvws-network", name: "TVWS 통신망", domain: "wildfire", category: "communication", direction: "BIDIRECTIONAL",
  eventId: IDS.wildfireEvent, sourceSystem: "mock-tvws-station",
  reportedByAssetId: IDS.tvws, reportingRole: "NMS",
  invoke: { command: "SET_CHANNEL", cpeAssetId: IDS.tvwsCpe, channel: 27, txPowerDbm: 30, approvedBy: "demo-controller", externalOwner: "NDPS" },
  result: () => ({
    baseAssetId: IDS.tvws,
    cpeAssetId: IDS.tvwsCpe,
    observedAt: now(),
    operationalStatus: "ONLINE",
    channel: "27",
    signalStrengthDbm: -66,
    throughputMbps: 31.4,
    latencyMs: 48,
    packetLossPct: 0.4,
    distanceM: 1800,
    ingressMedium: "ETHERNET",
    backhaulType: "5G",
    backhaulAvailable: true,
    connectedTerminals: 7,
    attributes: { externalOwner: "NDPS", evidenceStatus: "SIMULATED_NOT_DEVICE_MEASURED" },
  }),
});
