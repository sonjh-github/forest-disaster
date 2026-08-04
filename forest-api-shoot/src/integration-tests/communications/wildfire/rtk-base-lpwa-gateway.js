import { definition, IDS, now } from "../../shared.js";
export default definition({
  id: "wildfire.rtk-base-lpwa-gateway", name: "RTK 기준국·LPWA 게이트웨이", domain: "wildfire", category: "communication", direction: "BIDIRECTIONAL",
  eventId: IDS.wildfireEvent, sourceSystem: "mock-rtk-base",
  reportedByAssetId: IDS.rtkGateway, reportingRole: "GATEWAY",
  invoke: { assetId: IDS.rtkGateway, action: "REQUEST_STATUS" },
  result: () => ({
    assetId: IDS.rtkGateway,
    observedAt: now(),
    operationalStatus: "ONLINE",
    rtcmFormat: "RTCM3",
    rtcmAvailable: true,
    correctionAgeSeconds: 0.8,
    deliveryMode: "BROADCAST",
    beaconChannel: 1,
    uplinkChannelCount: 7,
    connectedTerminals: 4,
    allocatedSlots: [{ terminalAssetId: IDS.rtk, channel: 2, slot: 1 }],
    ethernetBackhaul: { connected: true, type: "5G", latencyMs: 42 },
    attributes: { evidenceStatus: "SIMULATED_NOT_DEVICE_MEASURED" },
  }),
});
