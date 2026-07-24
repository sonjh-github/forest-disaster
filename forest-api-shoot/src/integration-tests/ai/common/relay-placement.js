import { definition, IDS, now, sitePoint } from "../../shared.js";
export default definition({
  id: "wildfire.relay-placement", name: "중계기 배치 AI", domain: "wildfire", category: "ai", direction: "BIDIRECTIONAL",
  eventId: IDS.landslideEvent, sourceSystem: "mock-ai-relay-placement",
  invoke: { coverageResultId: "MOCK-COVERAGE-001", availableAssets: [IDS.relay, IDS.landslideUav], constraints: { minBatteryPct: 40, maxSlopeDeg: 18 } },
  result: () => ({ analysisType: "RELAY_PLACEMENT", targetType: "EVENT", modelName: "mock-relay-optimizer", modelVersion: "1.0.0", analyzedAt: now(), resultLabel: "CANDIDATES_READY", confidence: 0.84, sourceReferences: ["MOCK-COVERAGE-001"], result: { candidates: [{ rank: 1, geometry: sitePoint("wildfire", 350, 240, 294), expectedCoverageGainPct: 24.1 }] } }),
});
