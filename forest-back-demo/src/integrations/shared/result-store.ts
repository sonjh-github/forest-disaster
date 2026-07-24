import { supabase } from "../../config.js";
import type { IntegrationCapability, IntegrationEnvelope } from "./contracts.js";
import { toDatabase } from "../../services/database.js";

export async function storeIntegrationResult(
  capability: IntegrationCapability,
  envelope: IntegrationEnvelope<Record<string, unknown>>,
) {
  if (!capability.resultTarget) return { stored: false, reason: "NO_RESULT_TARGET" };
  const payload: Record<string, unknown> = toDatabase(envelope.data);
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
