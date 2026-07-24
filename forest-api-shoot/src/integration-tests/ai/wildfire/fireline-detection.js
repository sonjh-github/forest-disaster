import { definition, IDS, now, sitePoint } from "../../shared.js";
export default definition({
  id: "wildfire.ignition-detection", name: "위성영상 발화점 탐지 AI", domain: "wildfire", category: "ai", direction: "BIDIRECTIONAL",
  eventId: IDS.wildfireEvent, sourceSystem: "mock-ai-ignition",
  invoke: { mediaUri: "mock://satellite/fire/scene-001.tif", capturedAt: now() },
  result: () => ({ observedAt: now(), ignitionPoints: [sitePoint("wildfire", 60, 90)], confidence: 0.91, sourceSystem: "mock-ai-ignition" }),
});
