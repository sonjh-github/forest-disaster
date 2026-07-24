import { definition, IDS, now, polygon, siteCoordinates } from "../../shared.js";
export default definition({
  id: "landslide.risk-analysis", name: "사면 위험도 AI", domain: "landslide", category: "ai", direction: "BIDIRECTIONAL",
  eventId: IDS.landslideEvent, sourceSystem: "mock-ai-landslide-risk",
  invoke: { slopeId: "SLOPE-MOCK-001", terrainUri: "mock://terrain/landslide-dem.tif", rainfall: { oneHourMm: 48, twentyFourHourMm: 176 }, sensorObservations: { displacementMm: 18.4, soilMoisturePct: 42 } },
  result: () => ({ externalSlopeId: "SLOPE-MOCK-001", assessedAt: now(), geometry: polygon([siteCoordinates("landslide", -300, -220), siteCoordinates("landslide", 300, -220), siteCoordinates("landslide", 300, 260), siteCoordinates("landslide", -300, 260)]), riskScore: 86.3, riskLevel: "HIGH", safetyFactor: 0.91, probability: 0.87, modelName: "mock-slope-risk", modelVersion: "1.0.0", sourceReferences: ["mock://terrain/landslide-dem.tif"], result: { factors: [{ name: "rainfall", contribution: 0.42 }, { name: "displacement", contribution: 0.35 }] } }),
});
