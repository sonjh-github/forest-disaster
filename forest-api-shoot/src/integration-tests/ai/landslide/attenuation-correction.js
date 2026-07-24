import { definition, IDS } from "../../shared.js";
export default definition({
  id: "landslide.attenuation-correction", name: "붕괴지반 신호 감쇠 보정", domain: "landslide", category: "ai", direction: "BIDIRECTIONAL",
  eventId: IDS.landslideEvent, sourceSystem: "mock-attenuation-ai",
  invoke: { rawSignal: { samples: [0.04, 0.08, 0.19] }, groundCondition: { material: "mixed-soil", estimatedDepthM: 1.8 } },
  result: { modelId: "attenuation-mock", resultType: "corrected-signal", correctedSignal: { samples: [0.12, 0.24, 0.57] } },
});
