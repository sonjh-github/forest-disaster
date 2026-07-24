import { definition, IDS, now, polygon, siteCoordinates } from "../../shared.js";
export default definition({
  id: "common.gis-coverage", name: "GIS 통신 커버리지 분석", domain: "common", category: "ai", direction: "BIDIRECTIONAL",
  eventId: IDS.wildfireEvent, sourceSystem: "mock-ai-coverage",
  invoke: { demUri: "mock://terrain/dem-001.tif", nodes: [{ assetId: IDS.tvws, antennaHeightM: 12 }], analysisArea: polygon([siteCoordinates("wildfire", -800, -600), siteCoordinates("wildfire", 800, -600), siteCoordinates("wildfire", 800, 600), siteCoordinates("wildfire", -800, 600)]) },
  result: () => ({ analysisType: "COMMUNICATION_COVERAGE", targetType: "EVENT", modelName: "mock-viewshed", modelVersion: "1.0.0", analyzedAt: now(), resultLabel: "COVERAGE_AVAILABLE", confidence: 0.88, sourceReferences: ["mock://terrain/dem-001.tif"], result: { coveragePct: 72.4, shadowPct: 27.6 } }),
});
