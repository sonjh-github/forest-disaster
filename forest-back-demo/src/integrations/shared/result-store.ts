import { supabase } from "../../config.js";
import type { IntegrationCapability, IntegrationEnvelope } from "./contracts.js";
import { toDatabase } from "../../services/database.js";
import { assertRegisteredAssetId } from "../../services/asset-identity.js";

export async function storeIntegrationResult(
  capability: IntegrationCapability,
  envelope: IntegrationEnvelope<Record<string, unknown>>,
) {
  if (!capability.resultTarget) return { stored: false, reason: "NO_RESULT_TARGET" };
  const payload: Record<string, unknown> = toDatabase(envelope.data);
  if ("asset_id" in payload) {
    payload.asset_id = await assertRegisteredAssetId(payload.asset_id);
  }
  if (capability.id === "landslide.gcs") {
    const assetId = String(payload.asset_id ?? "");
    const attributes = payload.attributes && typeof payload.attributes === "object"
      ? payload.attributes as Record<string, unknown>
      : {};
    const systemId = Number(attributes.system_id ?? 0);
    const sourceAddress = String(attributes.source_address ?? "unknown");
    const { error: assetError } = await supabase.schema("core").from("asset").upsert({
      asset_id: assetId,
      asset_code: `GCS-UAV-${sourceAddress.replaceAll(/[^0-9a-z]/gi, "-")}-${systemId}`,
      asset_type: "UAV",
      asset_name: `연동 드론 ${systemId}`,
      owner_org_code: "FOREST-UAV",
      serial_number: `${sourceAddress}:${systemId}`,
      status: "ACTIVE",
      specifications: {
        sourceSystem: envelope.context.sourceSystem,
        mavlinkSystemId: systemId,
        sourceAddress,
        automaticallyRegistered: true,
      },
    }, { onConflict: "asset_id", ignoreDuplicates: true });
    if (assetError) throw assetError;
    if (attributes.battery_percent !== undefined) payload.battery_pct = attributes.battery_percent;
  }
  // core.network_status_history는 communication_network를 통해 사건에 연결되며
  // event_id 컬럼을 직접 갖지 않는다.
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
