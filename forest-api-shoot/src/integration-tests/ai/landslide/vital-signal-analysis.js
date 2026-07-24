import { definition, IDS, now } from "../../shared.js";
export default definition({
  id: "landslide.vital-signal-analysis", name: "IR-UWB/GPR 생체신호 분석", domain: "landslide", category: "ai", direction: "BIDIRECTIONAL",
  eventId: IDS.landslideEvent, sourceSystem: "mock-vital-ai",
  invoke: { rawSignal: { sampleRateHz: 100, samples: [0.11, 0.18, 0.42, 0.21] } },
  result: () => ({ modelId: "vital-mock", resultType: "vital-signal", output: { analyzedAt: now(), detected: true, respirationBpm: 16 }, confidence: 0.82 }),
});
