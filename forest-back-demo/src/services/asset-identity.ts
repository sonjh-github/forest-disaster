import { supabase } from "../config.js";

export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const registeredAssetIds = new Set<string>();

export function assertAssetUuid(value: unknown): asserts value is string {
  if (typeof value !== "string" || !UUID_PATTERN.test(value)) {
    throw new Error("assetId는 통합 자산 UUID 형식이어야 합니다.");
  }
}

export async function assertRegisteredAssetId(value: unknown) {
  assertAssetUuid(value);
  const assetId = value.toLowerCase();
  if (registeredAssetIds.has(assetId)) return assetId;

  const { data, error } = await supabase
    .schema("core")
    .from("asset")
    .select("asset_id")
    .eq("asset_id", assetId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error(`자산 마스터에 등록되지 않은 assetId입니다: ${assetId}`);
  registeredAssetIds.add(assetId);
  return assetId;
}
