import { definition, IDS, now, line, polygon, siteCoordinates } from "../../shared.js";
export default definition({
  id: "landslide.debris-flow", name: "토석류 예측 AI", domain: "landslide", category: "ai", direction: "BIDIRECTIONAL",
  eventId: IDS.landslideEvent, sourceSystem: "mock-ai-debris-flow",
  invoke: { slopeId: "SLOPE-MOCK-001", terrainUri: "mock://terrain/landslide-dem.tif", soil: { type: "WEATHERED_GRANITE", moisturePct: 42 }, rainfall: { oneHourMm: 48 } },
  result: () => ({ externalSlopeId: "SLOPE-MOCK-001", baseTime: now(), forecastTime: new Date(Date.now() + 20 * 60_000).toISOString(), flowPath: line([siteCoordinates("landslide", -120, 260, 282), siteCoordinates("landslide", 0, 20, 246), siteCoordinates("landslide", 160, -260, 211)]), affectedArea: polygon([siteCoordinates("landslide", -220, -300), siteCoordinates("landslide", 260, -300), siteCoordinates("landslide", 220, 260), siteCoordinates("landslide", -180, 300)]), estimatedVolumeM3: 12600, maxVelocityMps: 8.7, sourceReferences: ["SLOPE-MOCK-001"], result: { warningLevel: "WARNING" } }),
});
