import { definition, IDS, now, polygon, siteCoordinates } from "../../shared.js";
export default definition({
  id: "landslide.change-detection", name: "드론영상 변화탐지", domain: "landslide", category: "ai", direction: "BIDIRECTIONAL",
  eventId: IDS.landslideEvent, sourceSystem: "mock-change-ai",
  invoke: { beforeMediaUri: "mock://uav/slope/before.tif", afterMediaUri: "mock://uav/slope/after.tif" },
  result: () => ({ observedAt: now(), changeGeometry: polygon([siteCoordinates("landslide", -100, -80), siteCoordinates("landslide", 120, -80), siteCoordinates("landslide", 120, 140)]), confidence: 0.87 }),
});
