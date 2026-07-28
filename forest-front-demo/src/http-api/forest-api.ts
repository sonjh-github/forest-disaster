import { httpApi } from "./client";

export interface ForestEvent {
  eventId: string;
  eventCode?: string;
  disasterType?: "WILDFIRE" | "LANDSLIDE" | "COMPLEX";
  eventName?: string;
  status?: string;
  severityCode?: string;
  locationName?: string;
  occurredAt?: string;
  updatedAt?: string;
  geometry?: { type?: string; coordinates?: unknown[] };
}

export interface PageResponse<T> { data: T[]; page: { limit: number; nextCursor: string | null } }
export interface DataResponse<T> { data: T }
export type ApiRecord = Record<string, unknown>;
export type IntegrationDomain = "common" | "wildfire" | "landslide";
export type IntegrationKind = "communication" | "ai";
export interface IntegrationCapability {
  id: string;
  domain: IntegrationDomain;
  kind: IntegrationKind;
  direction: "INBOUND" | "OUTBOUND" | "BIDIRECTIONAL";
  description: string;
  inputFields: string[];
  outputFields: string[];
  configured: boolean;
}

export const forestApi = {
  health: () => httpApi<{ status: string; service: string; framework: string }>("/health"),
  databaseHealth: () => httpApi<{ status: string; database: string }>("/health/db"),
  events: (limit = 50) => httpApi<PageResponse<ForestEvent>>(`/api/v1/events?limit=${limit}`),
  event: (eventId: string) => httpApi<DataResponse<ForestEvent>>(`/api/v1/events/${encodeURIComponent(eventId)}`),
  resources: (eventId: string, resource: string, limit = 200) =>
    httpApi<PageResponse<ApiRecord>>(`/api/v1/events/${encodeURIComponent(eventId)}/${resource}?limit=${limit}`),
  domainResources: (eventId: string, domain: "wildfire" | "landslide", resource: string, limit = 200) =>
    httpApi<PageResponse<ApiRecord>>(`/api/v1/events/${encodeURIComponent(eventId)}/${domain}/${resource}?limit=${limit}`),
  latestAssetStatuses: (eventId: string) =>
    httpApi<PageResponse<ApiRecord>>(`/api/v1/events/${encodeURIComponent(eventId)}/asset-statuses/latest?limit=200`),
  latestPersonnelPositions: (eventId: string) =>
    httpApi<PageResponse<ApiRecord>>(`/api/v1/events/${encodeURIComponent(eventId)}/personnel-positions/latest?limit=200`),
  assets: (limit = 200) => httpApi<PageResponse<ApiRecord>>(`/api/v1/assets?limit=${limit}`),
  integrations: () => httpApi<DataResponse<IntegrationCapability[]>>("/api/v1/integrations"),
};

export interface EventOverview {
  event: ForestEvent;
  assets: ApiRecord[];
  personnel: ApiRecord[];
  networks: ApiRecord[];
  alerts: ApiRecord[];
  reports: ApiRecord[];
  integrations: IntegrationCapability[];
  domainDetail: ApiRecord | null;
  domainLayers: Record<string, ApiRecord[]>;
}

let assetCatalogRequest: Promise<ApiRecord[]> | null = null;

function loadAssetCatalog() {
  assetCatalogRequest ??= forestApi.assets().then((result) => result.data).catch((error) => {
    assetCatalogRequest = null;
    throw error;
  });
  return assetCatalogRequest;
}

function latestBy(rows: ApiRecord[], key: string): ApiRecord[] {
  const seen = new Set<string>();
  return rows.filter((row) => {
    const value = String(row[key] ?? row.id ?? "");
    if (!value || seen.has(value)) return false;
    seen.add(value);
    return true;
  });
}

export async function loadEventOverview(event: ForestEvent): Promise<EventOverview> {
  const eventId = event.eventId;
  const domain = event.disasterType === "LANDSLIDE" ? "landslide" : "wildfire";
  const domainResourceNames = domain === "landslide"
    ? ["slope-assessments", "debris-flow-predictions", "victim-candidates", "rssi-detections"]
    : ["firelines", "spread-predictions", "communication-coverages"];
  const [eventResult, assets, personnel, networks, alerts, reports, integrations, detail, assetCatalog, analyses, domainLayerResults] = await Promise.all([
    forestApi.event(eventId),
    forestApi.latestAssetStatuses(eventId),
    forestApi.latestPersonnelPositions(eventId),
    forestApi.resources(eventId, "networks"),
    forestApi.resources(eventId, "alerts"),
    forestApi.resources(eventId, "situation-reports"),
    forestApi.integrations(),
    forestApi.domainResources(eventId, domain, "detail", 1),
    loadAssetCatalog(),
    forestApi.resources(eventId, "analyses", 100).catch(() => ({ data: [], page: { limit: 100, nextCursor: null } })),
    Promise.all(domainResourceNames.map(async (resource) => {
      try { return [resource, (await forestApi.domainResources(eventId, domain, resource, 100)).data] as const; }
      catch { return [resource, []] as const; }
    })),
  ]);
  const analysisLayerNames: Record<string, string> = {
    AI_RAN_COVERAGE: "ai-ran-coverages",
    RELAY_PLACEMENT: "relay-placement-candidates",
    IGNITION_DETECTION: "ignition-detections",
    VEHICLE_DETECTION: "vehicle-detections",
    ROAD_SEGMENTATION: "road-segmentations",
    CHANGE_DETECTION: "change-detections",
    VITAL_SIGNAL_DETECTION: "vital-signal-detections",
  };
  const analysisLayers = analyses.data.reduce<Record<string, ApiRecord[]>>((grouped, row) => {
    const layerName = analysisLayerNames[String(row.analysisType ?? "")];
    if (layerName && row.resultGeometry) (grouped[layerName] ??= []).push(row);
    return grouped;
  }, {});
  const fetchedDomainLayers = Object.fromEntries(domainLayerResults);
  const debrisRows = fetchedDomainLayers["debris-flow-predictions"] ?? [];
  const assetById = new Map(assetCatalog.map((asset) => [String(asset.assetId), asset]));
  return {
    event: eventResult.data,
    assets: latestBy(assets.data, "assetId").map((status) => ({ ...assetById.get(String(status.assetId)), ...status })),
    personnel: latestBy(personnel.data, "personExternalId"),
    networks: networks.data,
    alerts: alerts.data,
    reports: reports.data,
    integrations: integrations.data,
    domainDetail: detail.data[0] ?? null,
    domainLayers: {
      ...fetchedDomainLayers,
      ...(debrisRows.length ? { "debris-flow-paths": debrisRows, "debris-flow-areas": debrisRows } : {}),
      ...analysisLayers,
    },
  };
}
