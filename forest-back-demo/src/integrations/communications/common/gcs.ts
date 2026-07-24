import type { IntegrationCapability } from "../../shared/contracts.js";

export const gcsCapability: IntegrationCapability = {
  id: "landslide.gcs",
  domain: "landslide", kind: "communication", direction: "BIDIRECTIONAL",
  description: "드론/GCS 임무·위치·자세·영상 메타데이터 수집 및 임무 명령",
  inputFields: ["command", "assetId", "missionId"],
  outputFields: ["assetId", "observedAt", "geometry", "operationalStatus", "attributes"],
  endpointEnv: "GCS_API_URL",
  resultTarget: { schema: "core", table: "asset_status" },
};
