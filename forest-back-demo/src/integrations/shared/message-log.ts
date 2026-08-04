import { supabase } from "../../config.js";
import { toApi } from "../../services/database.js";
import type { IntegrationCapability, IntegrationEnvelope } from "./contracts.js";

export type MessageDirection = "INBOUND" | "OUTBOUND";
export type MessageStatus =
  | "RECEIVED"
  | "DISPATCHED"
  | "ACCEPTED"
  | "SUCCEEDED"
  | "REJECTED"
  | "FAILED";

export async function beginIntegrationMessage(
  capability: IntegrationCapability,
  envelope: IntegrationEnvelope<Record<string, unknown>>,
  direction: MessageDirection,
) {
  const row = {
    request_id: envelope.context.requestId,
    correlation_id: envelope.context.correlationId ?? null,
    capability_id: capability.id,
    direction,
    event_id: envelope.context.eventId,
    source_system: envelope.context.sourceSystem,
    reported_by_asset_id: envelope.context.reportedByAssetId ?? null,
    reporting_role: envelope.context.reportingRole ?? null,
    occurred_at: envelope.context.occurredAt,
    sent_at: envelope.context.sentAt ?? null,
    status: direction === "INBOUND" ? "RECEIVED" : "DISPATCHED",
    payload: envelope,
  };
  const { data, error } = await supabase
    .schema("core")
    .from("integration_message")
    .insert(row)
    .select("*")
    .single();
  if (!error) return { duplicate: false, message: toApi(data) as Record<string, unknown> };
  if (error.code !== "23505") throw error;

  const existing = await findIntegrationMessage(capability.id, direction, envelope.context.requestId);
  if (!existing) throw error;
  return { duplicate: true, message: existing };
}

export async function finishIntegrationMessage(
  messageId: string,
  status: MessageStatus,
  details: { response?: unknown; errorCode?: string; errorDetail?: string } = {},
) {
  const { data, error } = await supabase
    .schema("core")
    .from("integration_message")
    .update({
      status,
      completed_at: new Date().toISOString(),
      response: details.response ?? null,
      error_code: details.errorCode ?? null,
      error_detail: details.errorDetail ?? null,
    })
    .eq("message_id", messageId)
    .select("*")
    .single();
  if (error) throw error;
  return toApi(data) as Record<string, unknown>;
}

export async function findIntegrationMessage(
  capabilityId: string,
  direction: MessageDirection,
  requestId: string,
) {
  const { data, error } = await supabase
    .schema("core")
    .from("integration_message")
    .select("*")
    .eq("capability_id", capabilityId)
    .eq("direction", direction)
    .eq("request_id", requestId)
    .maybeSingle();
  if (error) throw error;
  return data ? toApi(data) as Record<string, unknown> : null;
}
