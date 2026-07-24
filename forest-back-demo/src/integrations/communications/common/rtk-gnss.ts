import type { IntegrationCapability } from "../../shared/contracts.js";

export type PersonnelPositionJson = {
  personExternalId: string;
  observedAt: string;
  geometry: { type: "Point"; coordinates: [number, number, number?] };
  horizontalAccuracyM?: number;
  positioningMethod: "RTK_FIXED" | "RTK_FLOAT" | "GNSS" | "NETWORK";
  activityStatus?: string;
  safetyStatus?: string;
  sourceAssetId?: string;
  sourceSystem: string;
  qualityStatus?: "RAW" | "VALIDATED" | "REJECTED";
};

export const rtkGnssCapability: IntegrationCapability = {
  id: "wildfire.rtk-terminal",
  domain: "wildfire",
  kind: "communication",
  direction: "INBOUND",
  description: "대원 RTK/GNSS 위치와 측위 품질 수집",
  inputFields: [],
  outputFields: ["personExternalId", "observedAt", "geometry", "positioningMethod", "sourceSystem"],
  resultTarget: { schema: "core", table: "personnel_position" },
};
