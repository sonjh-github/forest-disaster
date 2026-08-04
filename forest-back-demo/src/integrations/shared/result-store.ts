import { supabase } from "../../config.js";
import type { IntegrationCapability, IntegrationEnvelope } from "./contracts.js";
import { toDatabase } from "../../services/database.js";
import { assertActivePersonnelAssignment, assertRegisteredAssetId } from "../../services/asset-identity.js";

export async function storeIntegrationResult(
  capability: IntegrationCapability,
  envelope: IntegrationEnvelope<Record<string, unknown>>,
) {
  if (!capability.resultTarget) return { stored: false, reason: "NO_RESULT_TARGET" };
  const payload: Record<string, unknown> = toDatabase(envelope.data);
  const supportsReporter = capability.resultTarget.schema === "core"
    && ["personnel_position", "asset_status"].includes(capability.resultTarget.table)
    || capability.resultTarget.schema === "wildfire"
    && ["rtk_lpwa_gateway_status", "tvws_link_observation"].includes(capability.resultTarget.table);
  if (supportsReporter && envelope.context.reportedByAssetId) {
    payload.reported_by_asset_id = await assertRegisteredAssetId(envelope.context.reportedByAssetId);
    if (capability.resultTarget.schema === "core") payload.reporting_role = envelope.context.reportingRole ?? null;
  }
  for (const field of ["asset_id", "source_asset_id", "base_asset_id", "cpe_asset_id", "gateway_asset_id"] as const) {
    if (field in payload) payload[field] = await assertRegisteredAssetId(payload[field]);
  }
  if (capability.resultTarget.schema === "core" && capability.resultTarget.table === "personnel_position") {
    await assertActivePersonnelAssignment(
      envelope.context.eventId,
      payload.person_external_id,
      payload.source_asset_id,
    );
  }

  // GCS·드론도 다른 현장 장비와 마찬가지로 자산 마스터에 사전등록되어야 한다.
  // 수신 데이터만으로 자산을 자동 생성하지 않는다.
  if (capability.id === "landslide.gcs") {
    const attributes = payload.attributes && typeof payload.attributes === "object"
      ? payload.attributes as Record<string, unknown>
      : {};
    if (attributes.battery_percent !== undefined) payload.battery_pct = attributes.battery_percent;
  }

  // network_status_history는 communication_network를 통해 사건에 연결되며 event_id가 없다.
  if (!(capability.resultTarget.schema === "core" && capability.resultTarget.table === "network_status_history")) {
    payload.event_id = envelope.context.eventId;
  }
  const { data, error } = await supabase
    .schema(capability.resultTarget.schema)
    .from(capability.resultTarget.table)
    .insert(payload)
    .select("*")
    .single();
  if (error) throw error;
  return { stored: true, target: capability.resultTarget, data };
}
