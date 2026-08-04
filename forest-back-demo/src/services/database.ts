import { supabase } from "../config.js";
import type { ResourceDefinition } from "../types.js";

export const commonResources: Record<string, ResourceDefinition> = {
  "hazard-zones": { schema: "core", table: "hazard_zone", id: "hazard_zone_id", orderBy: "valid_from" },
  routes: { schema: "core", table: "route_guidance", id: "route_id", orderBy: "valid_from" },
  tasks: { schema: "core", table: "field_task", id: "task_id", orderBy: "updated_at" },
  analyses: { schema: "core", table: "ai_analysis_result", id: "analysis_result_id", orderBy: "analyzed_at" },
  recommendations: { schema: "core", table: "decision_recommendation", id: "recommendation_id", orderBy: "generated_at" },
  kpis: { schema: "core", table: "kpi_measurement", id: "kpi_measurement_id", orderBy: "measured_to" },
  "audit-logs": { schema: "core", table: "audit_log", id: "audit_log_id", orderBy: "occurred_at" },
};

export const wildfireResources: Record<string, ResourceDefinition> = {
  detail: { schema: "wildfire", table: "event_detail", id: "event_id", orderBy: "updated_at" },
  firelines: { schema: "wildfire", table: "fireline", id: "fireline_id", orderBy: "observed_at" },
  "spread-predictions": { schema: "wildfire", table: "spread_prediction", id: "prediction_id", orderBy: "forecast_time" },
  "communication-coverages": { schema: "wildfire", table: "communication_coverage", id: "coverage_id", orderBy: "observed_at" },
};

export const landslideResources: Record<string, ResourceDefinition> = {
  detail: { schema: "landslide", table: "event_detail", id: "event_id", orderBy: "updated_at" },
  "slope-assessments": { schema: "landslide", table: "slope_assessment", id: "assessment_id", orderBy: "assessed_at" },
  "debris-flow-predictions": { schema: "landslide", table: "debris_flow_prediction", id: "prediction_id", orderBy: "forecast_time" },
  "victim-candidates": { schema: "landslide", table: "victim_candidate", id: "victim_candidate_id", orderBy: "last_detected_at" },
  "rssi-detections": { schema: "landslide", table: "rssi_detection", id: "detection_id", orderBy: "detected_at" },
};

function camel(key: string): string {
  return key.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());
}

function snake(key: string): string {
  return key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

export function mapKeys(value: unknown, mapper: (key: string) => string): unknown {
  if (Array.isArray(value)) return value.map((item) => mapKeys(item, mapper));
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(
    ([key, item]) => [mapper(key), mapKeys(item, mapper)],
  ));
}

export const toApi = (value: unknown) => mapKeys(value, camel);
export const toDatabase = (value: unknown) => mapKeys(value, snake) as Record<string, unknown>;

export async function listRows(
  resource: ResourceDefinition,
  options: { eventId?: string; limit?: number; cursor?: string | null } = {},
) {
  const limit = Math.min(Math.max(options.limit ?? 50, 1), 200);
  let query = supabase.schema(resource.schema).from(resource.table).select("*");
  if (options.eventId) query = query.eq("event_id", options.eventId);
  if (options.cursor) query = query.lt(resource.orderBy, options.cursor);
  const { data, error } = await query.order(resource.orderBy, { ascending: false }).limit(limit + 1);
  if (error) throw error;
  const rows = data ?? [];
  const pageRows = rows.slice(0, limit);
  return {
    data: toApi(pageRows),
    page: {
      limit,
      nextCursor: rows.length > limit ? String(pageRows.at(-1)?.[resource.orderBy] ?? "") || null : null,
    },
  };
}

export async function findRow(resource: ResourceDefinition, id: string) {
  const { data, error } = await supabase
    .schema(resource.schema)
    .from(resource.table)
    .select("*")
    .eq(resource.id, id)
    .maybeSingle();
  if (error) throw error;
  return data ? toApi(data) : null;
}

export async function createRow(resource: ResourceDefinition, body: unknown, eventId?: string) {
  const payload = { ...toDatabase(body), ...(eventId ? { event_id: eventId } : {}) };
  const { data, error } = await supabase
    .schema(resource.schema)
    .from(resource.table)
    .insert(payload)
    .select("*")
    .single();
  if (error) throw error;
  return toApi(data);
}

export async function updateRow(
  resource: ResourceDefinition,
  id: string,
  body: unknown,
  eventId?: string,
) {
  let query = supabase
    .schema(resource.schema)
    .from(resource.table)
    .update(toDatabase(body))
    .eq(resource.id, id);
  if (eventId) query = query.eq("event_id", eventId);
  const { data, error } = await query.select("*").maybeSingle();
  if (error) throw error;
  return data ? toApi(data) : null;
}

export const eventResource: ResourceDefinition = {
  schema: "core", table: "disaster_event", id: "event_id", orderBy: "updated_at",
};

export const assetResource: ResourceDefinition = {
  schema: "core", table: "asset", id: "asset_id", orderBy: "updated_at",
};
