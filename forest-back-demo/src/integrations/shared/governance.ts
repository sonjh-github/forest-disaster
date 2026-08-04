import type { IntegrationCapability } from "./contracts.js";

type Governance = Required<Pick<IntegrationCapability, "owner" | "boundary" | "evidenceStatus">>;

const owners: Record<string, Governance> = {
  "wildfire.tvws-network": { owner: "NDPS", boundary: "EXTERNAL", evidenceStatus: "CONTRACT_ONLY" },
  "wildfire.rtk-terminal": { owner: "진인프라", boundary: "EXTERNAL", evidenceStatus: "CONTRACT_ONLY" },
  "wildfire.rtk-base-lpwa-gateway": { owner: "진인프라", boundary: "EXTERNAL", evidenceStatus: "CONTRACT_ONLY" },
  "wildfire.radio-gateway": { owner: "에스플러스텍", boundary: "EXTERNAL", evidenceStatus: "CONTRACT_ONLY" },
  "wildfire.private-5g-ntn": { owner: "ETRI", boundary: "EXTERNAL", evidenceStatus: "CONTRACT_ONLY" },
  "wildfire.ai-ran": { owner: "ETRI", boundary: "EXTERNAL", evidenceStatus: "CONTRACT_ONLY" },
  "landslide.main-relay-drone": { owner: "KT·천풍무인항공", boundary: "EXTERNAL", evidenceStatus: "CONTRACT_ONLY" },
  "landslide.service-relay-drone": { owner: "KT·천풍무인항공", boundary: "EXTERNAL", evidenceStatus: "CONTRACT_ONLY" },
  "landslide.fixed-relay": { owner: "KT", boundary: "EXTERNAL", evidenceStatus: "CONTRACT_ONLY" },
  "landslide.ref-ap": { owner: "셀코", boundary: "EXTERNAL", evidenceStatus: "CONTRACT_ONLY" },
  "landslide.rover-ap": { owner: "셀코·천풍무인항공", boundary: "EXTERNAL", evidenceStatus: "CONTRACT_ONLY" },
  "landslide.ir-uwb-gpr": { owner: "셀코", boundary: "EXTERNAL", evidenceStatus: "CONTRACT_ONLY" },
  "landslide.gcs": { owner: "투비유니콘·천풍무인항공 연계", boundary: "TOBE", evidenceStatus: "IMPLEMENTED" },
};

export function integrationGovernance(capability: IntegrationCapability): Governance {
  return owners[capability.id] ?? {
    owner: capability.kind === "ai" ? "해당 AI 세부과제 주관기관·투비유니콘 연계" : "투비유니콘",
    boundary: capability.kind === "ai" ? "EXTERNAL" : "TOBE",
    evidenceStatus: capability.kind === "ai" ? "CONTRACT_ONLY" : "MOCK",
  };
}
