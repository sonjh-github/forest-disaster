import { Hono } from "hono";
import { supabase } from "../config.js";
import { requireJwt, requireScope } from "../middleware/auth.js";
import type { AppEnv } from "../types.js";
import { serverLogger } from "../logger.js";

const allowedTables: Record<string, Set<string>> = {
  core: new Set(["personnel_position", "asset_status", "network_status_history", "communication_network", "disaster_event", "situation_report", "alert"]),
  wildfire: new Set(["fireline", "spread_prediction"]),
  landslide: new Set(["rssi_detection", "victim_candidate", "slope_assessment"]),
};

type IngestBody = {
  schema: "core" | "wildfire" | "landslide";
  table: string;
  method: "POST" | "PATCH";
  filters?: Record<string, string>;
  data: Record<string, unknown> | Array<Record<string, unknown>>;
  context?: { runId?: string; scenarioId?: string; tick?: number };
};

type SimulationSnapshot = {
  longitude?: number;
  latitude?: number;
  altitude?: number;
  battery?: number;
  status?: string;
  signal?: number;
};

const previousSnapshots = new Map<string, SimulationSnapshot>();
const assetNameCache = new Map<string, string>();

function number(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function snapshot(row: Record<string, unknown>): SimulationSnapshot {
  const geometry = row.geometry as { coordinates?: unknown[] } | undefined;
  return {
    longitude: number(geometry?.coordinates?.[0]),
    latitude: number(geometry?.coordinates?.[1]),
    altitude: number(geometry?.coordinates?.[2]),
    battery: number(row.battery_pct),
    status: String(row.operational_status ?? row.activity_status ?? row.safety_status ?? ""),
    signal: number(row.signal_strength_dbm),
  };
}

function signed(value: number, unit: string, digits = 1) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(digits)}${unit}`;
}

function distanceMeters(before: SimulationSnapshot, after: SimulationSnapshot) {
  if (before.longitude == null || before.latitude == null || after.longitude == null || after.latitude == null) return undefined;
  const latitudeMeters = (after.latitude - before.latitude) * 111_320;
  const longitudeMeters = (after.longitude - before.longitude) * 111_320 * Math.cos(after.latitude * Math.PI / 180);
  return Math.hypot(latitudeMeters, longitudeMeters);
}

async function assetName(assetId: string) {
  const cached = assetNameCache.get(assetId);
  if (cached) return cached;
  const { data } = await supabase.schema("core").from("asset").select("asset_name,asset_code").eq("asset_id", assetId).maybeSingle();
  const name = String(data?.asset_name ?? data?.asset_code ?? assetId);
  assetNameCache.set(assetId, name);
  return name;
}

async function logSimulationChange(table: string, row: Record<string, unknown>) {
  if (!['asset_status', 'personnel_position'].includes(table)) return;
  const assetId = String(row.asset_id ?? "");
  const personId = String(row.person_external_id ?? "");
  const entityId = assetId || personId;
  if (!entityId) return;
  const key = `${table}:${entityId}`;
  const current = snapshot(row);
  const previous = previousSnapshots.get(key);
  previousSnapshots.set(key, current);
  const name = assetId ? await assetName(assetId) : personId;

  if (!previous) {
    const position = current.latitude != null && current.longitude != null
      ? `초기 위치 ${current.latitude.toFixed(6)}, ${current.longitude.toFixed(6)}`
      : "초기 상태 수신";
    serverLogger.info("forest-api-shoot", `${name} · ${position}${current.status ? ` · 상태 ${current.status}` : ""}`);
    return;
  }

  const changes: string[] = [];
  const distance = distanceMeters(previous, current);
  if (distance != null && distance >= 0.05) changes.push(`이동 ${signed(distance, "m")}`);
  if (previous.altitude != null && current.altitude != null && current.altitude !== previous.altitude) changes.push(`고도 ${signed(current.altitude - previous.altitude, "m")}`);
  if (previous.battery != null && current.battery != null && current.battery !== previous.battery) changes.push(`배터리 ${signed(current.battery - previous.battery, "%", 2)}`);
  if (previous.signal != null && current.signal != null && current.signal !== previous.signal) changes.push(`신호 ${signed(current.signal - previous.signal, "dBm", 0)}`);
  if (previous.status !== current.status) changes.push(`상태 ${previous.status || "-"}→${current.status || "-"}`);
  if (changes.length) serverLogger.info("forest-api-shoot", `${name} · ${changes.join(" · ")}`);
}

export const simulatorRoutes = new Hono<AppEnv>();
simulatorRoutes.use("*", requireJwt);

simulatorRoutes.post("/ingest", requireScope("forest.ingest"), async (c) => {
  const body = await c.req.json<IngestBody>();
  if (!allowedTables[body.schema]?.has(body.table) || !["POST", "PATCH"].includes(body.method)) {
    return c.json({ error: { code: "INVALID_INGEST_TARGET", message: "허용되지 않은 시뮬레이터 전송 대상입니다." } }, 400);
  }

  if (body.method === "POST") {
    const { error } = await supabase.schema(body.schema).from(body.table).insert(body.data);
    if (error) throw error;
    const rows = Array.isArray(body.data) ? body.data : [body.data];
    await Promise.all(rows.map((row) => logSimulationChange(body.table, row)));
  } else {
    let query = supabase.schema(body.schema).from(body.table).update(body.data as Record<string, unknown>);
    for (const [field, expression] of Object.entries(body.filters ?? {})) {
      const [operator = "eq", ...valueParts] = expression.split(".");
      query = query.filter(field, operator, valueParts.join("."));
    }
    const { error } = await query;
    if (error) throw error;
  }

  return c.json({ data: { accepted: true, schema: body.schema, table: body.table, method: body.method, context: body.context ?? null } }, 202);
});
