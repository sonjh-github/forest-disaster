import test from "node:test";
import assert from "node:assert/strict";
import { IntegrationRegistry } from "../src/integrations/shared/registry.js";
import { integrationGovernance } from "../src/integrations/shared/governance.js";
import { integrationRegistry } from "../src/integrations/catalog.js";
import { assertRequiredFields } from "../src/integrations/shared/contracts.js";

process.env.SUPABASE_URL ??= "https://example.supabase.co";
process.env.SUPABASE_SECRET_KEY ??= "sb_secret_test_only_not_a_real_secret";

test("DB snake_case와 API camelCase를 중첩 객체·배열까지 왕복 변환한다", async () => {
  const { toApi, toDatabase } = await import("../src/services/database.js");
  const database = { event_id: "e1", nested_value: [{ asset_id: "a1", battery_pct: 80 }] };
  const api = { eventId: "e1", nestedValue: [{ assetId: "a1", batteryPct: 80 }] };
  assert.deepEqual(toApi(database), api);
  assert.deepEqual(toDatabase(api), database);
});

test("연동 레지스트리는 중복 capability ID를 거부한다", () => {
  const capability = integrationRegistry.get("landslide.gcs");
  assert.ok(capability);
  const registry = new IntegrationRegistry().register(capability);
  assert.throws(() => registry.register(capability), /중복 연동 기능/);
});

test("업체 소관 기능과 투비 구현 기능의 거버넌스 경계를 구분한다", () => {
  const tvws = integrationRegistry.get("wildfire.tvws-network");
  const gcs = integrationRegistry.get("landslide.gcs");
  const ai = integrationRegistry.get("wildfire.fireline-prediction");
  assert.ok(tvws && gcs && ai);
  assert.deepEqual(integrationGovernance(tvws), { owner: "NDPS", boundary: "EXTERNAL", evidenceStatus: "CONTRACT_ONLY" });
  assert.equal(integrationGovernance(gcs).evidenceStatus, "IMPLEMENTED");
  assert.equal(integrationGovernance(ai).evidenceStatus, "CONTRACT_ONLY");
});

test("필수 필드와 통합 자산 UUID를 엄격히 검증한다", async () => {
  const { assertAssetUuid } = await import("../src/services/asset-identity.js");
  assert.doesNotThrow(() => assertRequiredFields({ eventId: "e1", value: 0 }, ["eventId", "value"]));
  assert.throws(() => assertRequiredFields({}, ["eventId"]), /필수 데이터/);
  assert.doesNotThrow(() => assertAssetUuid("10000000-0000-4000-8000-000000000001"));
  assert.throws(() => assertAssetUuid("ASSET-001"), /UUID/);
});
