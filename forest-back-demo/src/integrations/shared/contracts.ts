export type IntegrationDomain = "common" | "wildfire" | "landslide";
export type IntegrationKind = "communication" | "ai";
export type IntegrationDirection = "INBOUND" | "OUTBOUND" | "BIDIRECTIONAL";

export type GeoPoint3D = {
  type: "Point";
  coordinates: [longitude: number, latitude: number, altitude?: number];
};

export type IntegrationContext = {
  eventId: string;
  requestId: string;
  sourceSystem: string;
  occurredAt: string;
  schemaVersion: "1.0";
};

export type IntegrationEnvelope<T> = {
  context: IntegrationContext;
  data: T;
};

export type IntegrationCapability = {
  id: string;
  domain: IntegrationDomain;
  kind: IntegrationKind;
  direction: IntegrationDirection;
  description: string;
  inputFields: readonly string[];
  outputFields: readonly string[];
  endpointEnv?: string;
  resultTarget?: {
    schema: "core" | "wildfire" | "landslide";
    table: string;
  };
};

export type InvocationResult<T = unknown> = {
  capabilityId: string;
  endpoint: string;
  status: number;
  response: T;
};

export function assertEnvelope(value: unknown): asserts value is IntegrationEnvelope<Record<string, unknown>> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("JSON 객체 요청 본문이 필요합니다.");
  const envelope = value as Partial<IntegrationEnvelope<unknown>>;
  if (!envelope.context || typeof envelope.context !== "object") throw new Error("context가 필요합니다.");
  if (!envelope.data || typeof envelope.data !== "object") throw new Error("data가 필요합니다.");
  const context = envelope.context as Partial<IntegrationContext>;
  for (const field of ["eventId", "requestId", "sourceSystem", "occurredAt"] as const) {
    if (!context[field]) throw new Error(`context.${field}가 필요합니다.`);
  }
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuid.test(context.eventId!)) throw new Error("context.eventId는 UUID 형식이어야 합니다.");
  if (!uuid.test(context.requestId!)) throw new Error("context.requestId는 UUID 형식이어야 합니다.");
  if (Number.isNaN(Date.parse(context.occurredAt!))) throw new Error("context.occurredAt은 ISO 8601 형식이어야 합니다.");
  if (context.schemaVersion !== "1.0") throw new Error("지원하지 않는 schemaVersion입니다.");
}

export function assertRequiredFields(data: Record<string, unknown>, fields: readonly string[]) {
  const missing = fields.filter((field) => data[field] === undefined || data[field] === null);
  if (missing.length) throw new Error(`필수 데이터가 누락되었습니다: ${missing.join(", ")}`);
}
