import { definition, IDS, now } from "../../shared.js";
export default definition({
  id: "wildfire.vehicle-road-analysis", name: "차량·도로 영상분석", domain: "wildfire", category: "ai", direction: "BIDIRECTIONAL",
  eventId: IDS.wildfireEvent, sourceSystem: "mock-vehicle-road-ai",
  invoke: { mediaUri: "mock://uav/road/frame-001.jpg", capturedAt: now() },
  result: () => ({ observedAt: now(), vehicleBoxes: [{ x: 0.22, y: 0.31, width: 0.08, height: 0.05 }], roadMask: "mock://results/road-mask-001.png", confidence: 0.89 }),
});
