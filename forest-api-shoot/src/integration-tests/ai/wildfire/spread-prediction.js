import { definition, IDS, now, polygon, siteCoordinates } from "../../shared.js";
export default definition({
  id: "wildfire.fireline-prediction", name: "화선 경로 예측 AI", domain: "wildfire", category: "ai", direction: "BIDIRECTIONAL",
  eventId: IDS.wildfireEvent, sourceSystem: "mock-ai-wildfire-spread",
  invoke: { firelineId: "MOCK-FIRELINE-001", weather: { windDirectionDeg: 240, windSpeedMps: 7.2, humidityPct: 31 }, terrainUri: "mock://terrain/dem-001.tif", fuelMapUri: "mock://forest/fuel-001.tif" },
  result: () => {
    const baseTime = now();
    return { modelName: "mock-fire-spread", modelVersion: "1.0.0", baseTime, forecastTime: new Date(Date.now() + 30 * 60_000).toISOString(), predictedArea: polygon([siteCoordinates("wildfire", -350, -250), siteCoordinates("wildfire", 450, -250), siteCoordinates("wildfire", 520, 420), siteCoordinates("wildfire", -320, 380)]), confidence: 0.82, sourceReferences: ["MOCK-FIRELINE-001"] };
  },
});
