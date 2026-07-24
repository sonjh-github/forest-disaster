import { supabase } from "../src/config.js";

const wildfireEventId = "10000000-0000-4000-8000-000000000001";
const landslideEventId = "10000000-0000-4000-8000-000000000002";
const wildfireNetworkId = "32000000-0000-4000-8000-000000000001";
const landslideNetworkId = "32000000-0000-4000-8000-000000000002";

const definitions = [
  ["005", "SIM-UAV-LS-01", "MAIN_RELAY_DRONE", "산사태 주 중계 드론", landslideEventId, landslideNetworkId, 127.3160, 36.6660],
  ["006", "SIM-RELAY-LS-01", "SERVICE_RELAY_DRONE", "산사태 서비스 중계 드론", landslideEventId, landslideNetworkId, 127.3170, 36.6670],
  ["009", "SIM-RTK-BASE-01", "RTK_BASE_LPWA_GATEWAY", "이동형 RTK 기준국·LPWA 게이트웨이", wildfireEventId, wildfireNetworkId, 128.6830, 36.3440],
  ["010", "SIM-TVWS-CPE-01", "TVWS_CPE", "TVWS 가입자 단말(CPE)", wildfireEventId, wildfireNetworkId, 128.6850, 36.3450],
  ["011", "SIM-LTE-GW-01", "LTE_GATEWAY", "LTE 연동 게이트웨이", wildfireEventId, wildfireNetworkId, 128.6800, 36.3420],
  ["012", "SIM-5G-NTN-GW-01", "PRIVATE_5G_NTN_GATEWAY", "특화망 5G·저궤도 위성 게이트웨이", wildfireEventId, wildfireNetworkId, 128.6790, 36.3430],
  ["013", "SIM-RADIO-GW-01", "RADIO_GATEWAY_400MHZ", "400MHz 무전 게이트웨이", wildfireEventId, wildfireNetworkId, 128.6810, 36.3450],
  ["014", "SIM-FIXED-RELAY-01", "FIXED_RELAY", "고정형 임시 중계기", landslideEventId, landslideNetworkId, 127.3220, 36.6700],
  ["015", "SIM-GCS-01", "GCS", "드론 지상통제장치", landslideEventId, landslideNetworkId, 127.3180, 36.6670],
  ["016", "SIM-REF-AP-01", "REF_AP", "매몰자 탐지 기준 AP", landslideEventId, null, 127.3200, 36.6690],
  ["017", "SIM-ROVER-AP-01", "ROVER_AP", "매몰자 탐지 이동 AP", landslideEventId, null, 127.3290, 36.6760],
  ["018", "SIM-IR-UWB-GPR-01", "IR_UWB_GPR", "IR-UWB·GPR 생체신호 탐지 장비", landslideEventId, null, 127.3270, 36.6740],
] as const;

const assets = definitions.map(([suffix, assetCode, assetType, assetName]) => ({
  asset_id: `20000000-0000-4000-8000-000000000${suffix}`,
  asset_code: assetCode,
  asset_type: assetType,
  asset_name: assetName,
  owner_org_code: assetType.includes("DRONE") || assetType === "GCS" ? "FOREST-UAV" : assetType.includes("AP") || assetType === "IR_UWB_GPR" ? "FOREST-RESCUE" : "FOREST-ICT",
  model_name: `${assetType}-X`,
  serial_number: assetCode,
  status: "READY",
  specifications: { evidenceStatus: "DOCUMENT_REQUIRED", simulator: true },
}));

const statuses = definitions.map(([suffix, , , , eventId, networkId, longitude, latitude]) => ({
  asset_status_id: `35000000-0000-4000-8000-100000000${suffix}`,
  event_id: eventId,
  asset_id: `20000000-0000-4000-8000-000000000${suffix}`,
  network_id: networkId,
  observed_at: new Date().toISOString(),
  operational_status: "READY",
  geometry: { type: "Point", coordinates: [longitude, latitude, 0] },
  battery_pct: 100,
  external_power: ["RTK_BASE_LPWA_GATEWAY", "LTE_GATEWAY", "PRIVATE_5G_NTN_GATEWAY", "RADIO_GATEWAY_400MHZ", "FIXED_RELAY", "GCS"].includes(definitions.find(([id]) => id === suffix)?.[2] ?? ""),
  attributes: { evidenceStatus: "DOCUMENT_REQUIRED", simulator: true },
}));

const analyses = [
  ["003", wildfireEventId, "AI_RAN_COVERAGE", "Polygon", [[[128.680, 36.341], [128.706, 36.341], [128.706, 36.363], [128.680, 36.363], [128.680, 36.341]]]],
  ["004", wildfireEventId, "RELAY_PLACEMENT", "Point", [128.690, 36.349]],
  ["005", wildfireEventId, "IGNITION_DETECTION", "Point", [128.697, 36.352]],
  ["006", wildfireEventId, "VEHICLE_DETECTION", "Point", [128.684, 36.345]],
  ["007", wildfireEventId, "ROAD_SEGMENTATION", "Polygon", [[[128.681, 36.343], [128.700, 36.350], [128.701, 36.351], [128.682, 36.344], [128.681, 36.343]]]],
  ["008", landslideEventId, "CHANGE_DETECTION", "Polygon", [[[127.323, 36.670], [127.331, 36.670], [127.331, 36.678], [127.323, 36.678], [127.323, 36.670]]]],
  ["009", landslideEventId, "VITAL_SIGNAL_DETECTION", "Point", [127.327, 36.674]],
] as const;

async function upsert(schema: string, table: string, rows: object[], onConflict: string) {
  const { error } = await supabase.schema(schema).from(table).upsert(rows, { onConflict });
  if (error) throw new Error(`${schema}.${table}: ${error.message}`);
}

await upsert("core", "asset", assets, "asset_id");
await upsert("core", "asset_status", statuses, "asset_status_id");
await upsert("core", "ai_analysis_result", analyses.map(([suffix, eventId, analysisType, type, coordinates]) => ({
  analysis_result_id: `42000000-0000-4000-8000-000000000${suffix}`,
  event_id: eventId,
  analysis_type: analysisType,
  target_type: analysisType,
  model_name: `${analysisType.toLowerCase()}-simulator`,
  model_version: "1.0.0",
  analyzed_at: new Date().toISOString(),
  result_geometry: { type, coordinates },
  source_references: [],
  result: { evidenceStatus: "SIMULATED" },
  review_status: "UNREVIEWED",
})), "analysis_result_id");

const { error: victimError } = await supabase.schema("landslide").from("victim_candidate").update({
  estimated_position: { type: "Point", coordinates: [127.327, 36.674, 0] },
}).eq("victim_candidate_id", "62000000-0000-4000-8000-000000000001");
if (victimError) throw new Error(`landslide.victim_candidate: ${victimError.message}`);

const requiredTypes = [
  "RTK_TERMINAL", "RTK_BASE_LPWA_GATEWAY", "TVWS_BASE_STATION", "TVWS_CPE",
  "LTE_GATEWAY", "COMMAND_VEHICLE", "PRIVATE_5G_NTN_GATEWAY", "RADIO_GATEWAY_400MHZ",
  "MAIN_RELAY_DRONE", "SERVICE_RELAY_DRONE", "FIXED_RELAY", "GCS", "REF_AP", "ROVER_AP",
  "IR_UWB_GPR",
];
const { data: verifiedAssets, error: assetReadError } = await supabase.schema("core").from("asset")
  .select("asset_type").in("asset_type", requiredTypes);
if (assetReadError) throw new Error(`marker verification: ${assetReadError.message}`);
const verifiedTypes = new Set((verifiedAssets ?? []).map((row) => row.asset_type));
const missingTypes = requiredTypes.filter((type) => !verifiedTypes.has(type));
if (missingTypes.length) throw new Error(`동기화 검증 실패: ${missingTypes.join(", ")}`);

console.log(`문서 마커 동기화·검증 완료: 장비 ${assets.length}건, 공간 AI 결과 ${analyses.length}건`);
