import { supabase } from "../config.js";

export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function assertAssetUuid(value: unknown): asserts value is string {
  if (typeof value !== "string" || !UUID_PATTERN.test(value)) {
    throw new Error("assetId는 통합 자산 UUID 형식이어야 합니다.");
  }
}

export async function assertRegisteredAssetId(value: unknown) {
  assertAssetUuid(value);
  const assetId = value.toLowerCase();
  const { data, error } = await supabase.schema("core").from("asset")
    .select("asset_id,status").eq("asset_id", assetId).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error(`자산 마스터에 등록되지 않은 assetId입니다: ${assetId}`);
  if (["REVOKED", "RETIRED", "LOST", "SUSPENDED", "PENDING_APPROVAL"].includes(data.status)) {
    throw new Error(`운용할 수 없는 장치 상태입니다: ${data.status}`);
  }
  return assetId;
}

export async function assertActivePersonnelAssignment(
  eventId: unknown,
  personExternalId: unknown,
  assetId: unknown,
) {
  assertAssetUuid(assetId);
  if (typeof eventId !== "string" || typeof personExternalId !== "string" || !personExternalId.trim()) {
    throw new Error("대원 위치에는 eventId와 personExternalId가 필요합니다.");
  }
  const { data, error } = await supabase.schema("core").from("personnel_device_assignment")
    .select("assignment_id").eq("event_id", eventId).eq("person_external_id", personExternalId)
    .eq("asset_id", assetId).is("released_at", null).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("해당 사건과 대원에게 활성 배정되지 않은 장치입니다.");
  return data.assignment_id as string;
}

export async function assertReportingAuthority(
  eventId: unknown,
  reporterAssetId: unknown,
  sourceAssetId: unknown,
  capabilityId?: string,
) {
  const reporter = await assertRegisteredAssetId(reporterAssetId);
  const source = await assertRegisteredAssetId(sourceAssetId);
  if (reporter === source) return;
  if (typeof eventId !== "string") throw new Error("대리 보고에는 eventId가 필요합니다.");

  const now = new Date().toISOString();
  const { data, error } = await supabase.schema("core").from("reporting_route")
    .select("reporting_route_id,capability_id,valid_from,valid_to")
    .eq("event_id", eventId)
    .eq("reporter_asset_id", reporter)
    .eq("source_asset_id", source)
    .eq("status", "ACTIVE");
  if (error) throw error;
  const authorized = (data ?? []).some((route) =>
    route.valid_from <= now
    && (!route.valid_to || route.valid_to > now)
    && (!capabilityId || !route.capability_id || route.capability_id === capabilityId));
  if (!authorized) throw new Error("보고 게이트웨이에 해당 장비의 대리 보고 권한이 없습니다.");
}
