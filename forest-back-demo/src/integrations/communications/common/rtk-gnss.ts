import type { IntegrationCapability } from "../../shared/contracts.js";

export type PersonnelPositionJson = {
  personExternalId: string;
  observedAt: string;
  transmittedAt: string;
  geometry: { type: "Point"; coordinates: [number, number, number?] };
  horizontalAccuracyM?: number;
  positioningMethod: "RTK_FIXED" | "RTK_FLOAT" | "GNSS";
  gnssFixQuality?: string;
  primaryLink: "LPWA";
  fallbackLink: "LTE";
  activeLink: "LPWA" | "LTE";
  fallbackActivated: boolean;
  lastPrimaryLinkAt?: string;
  signalStrengthDbm?: number;
  batteryPercent?: number;
  activityStatus?: string;
  safetyStatus?: string;
  emergency?: boolean;
  sourceAssetId?: string;
  sourceSystem: string;
  qualityStatus?: "RAW" | "VALIDATED" | "REJECTED";
};

export function assertPersonnelPosition(value: Record<string, unknown>) {
  if (!["RTK_FIXED", "RTK_FLOAT", "GNSS"].includes(String(value.positioningMethod))) {
    throw new Error("positioningMethod는 RTK_FIXED, RTK_FLOAT 또는 GNSS여야 합니다.");
  }
  if (value.primaryLink !== "LPWA") {
    throw new Error("primaryLink는 기본 현장망인 LPWA여야 합니다.");
  }
  if (value.fallbackLink !== "LTE") {
    throw new Error("fallbackLink는 LPWA 음영지역 보조망인 LTE여야 합니다.");
  }
  if (!["LPWA", "LTE"].includes(String(value.activeLink))) {
    throw new Error("activeLink는 LPWA 또는 LTE여야 합니다.");
  }
  if (typeof value.fallbackActivated !== "boolean") {
    throw new Error("fallbackActivated는 boolean이어야 합니다.");
  }
  if ((value.activeLink === "LTE") !== value.fallbackActivated) {
    throw new Error("LTE가 activeLink일 때만 fallbackActivated가 true여야 합니다.");
  }
  for (const field of ["observedAt", "transmittedAt"] as const) {
    if (Number.isNaN(Date.parse(String(value[field])))) throw new Error(`${field}는 ISO 8601 시각이어야 합니다.`);
  }
  if (value.lastPrimaryLinkAt && Number.isNaN(Date.parse(String(value.lastPrimaryLinkAt)))) {
    throw new Error("lastPrimaryLinkAt은 ISO 8601 시각이어야 합니다.");
  }
  if (value.batteryPercent !== undefined) {
    const battery = Number(value.batteryPercent);
    if (!Number.isFinite(battery) || battery < 0 || battery > 100) {
      throw new Error("batteryPercent는 0~100이어야 합니다.");
    }
  }
}

export const rtkGnssCapability: IntegrationCapability = {
  id: "wildfire.rtk-terminal",
  domain: "wildfire",
  kind: "communication",
  direction: "INBOUND",
  description: "진화대원 GNSS/RTK 위치와 LPWA 기본망, LPWA 음영지역 LTE 보조망 전환 상태 수집",
  inputFields: [],
  outputFields: [
    "personExternalId", "observedAt", "transmittedAt", "geometry", "positioningMethod",
    "primaryLink", "fallbackLink", "activeLink", "fallbackActivated", "sourceSystem",
  ],
  resultTarget: { schema: "core", table: "personnel_position" },
};
