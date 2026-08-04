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
  correlationId?: string;
  sourceSystem: string;
  occurredAt: string;
  sentAt?: string;
  schemaVersion: "1.0";
  reportedByAssetId?: string;
  reportingRole?: "GATEWAY" | "GCS" | "NMS" | "DEVICE" | "SERVICE";
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
  owner?: string;
  boundary?: "TOBE" | "EXTERNAL";
  evidenceStatus?: "IMPLEMENTED" | "MOCK" | "CONTRACT_ONLY";
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
  if (context.correlationId && !uuid.test(context.correlationId)) {
    throw new Error("context.correlationId는 UUID 형식이어야 합니다.");
  }
  if (context.reportedByAssetId && !uuid.test(context.reportedByAssetId)) {
    throw new Error("context.reportedByAssetId는 통합 자산 UUID 형식이어야 합니다.");
  }
  if (context.reportingRole && !["GATEWAY", "GCS", "NMS", "DEVICE", "SERVICE"].includes(context.reportingRole)) {
    throw new Error("context.reportingRole은 GATEWAY, GCS, NMS, DEVICE 또는 SERVICE여야 합니다.");
  }
  if ((context.reportedByAssetId && !context.reportingRole) || (!context.reportedByAssetId && context.reportingRole)) {
    throw new Error("context.reportedByAssetId와 context.reportingRole은 함께 전송해야 합니다.");
  }
  if (typeof context.sourceSystem !== "string" || !/^[a-zA-Z0-9][a-zA-Z0-9._:-]{1,99}$/.test(context.sourceSystem)) {
    throw new Error("context.sourceSystem은 2~100자의 시스템 식별자여야 합니다.");
  }
  if (Number.isNaN(Date.parse(context.occurredAt!))) throw new Error("context.occurredAt은 ISO 8601 형식이어야 합니다.");
  if (Date.parse(context.occurredAt!) > Date.now() + 5 * 60_000) {
    throw new Error("context.occurredAt은 서버 시각보다 5분 이상 미래일 수 없습니다.");
  }
  if (context.sentAt && Number.isNaN(Date.parse(context.sentAt))) {
    throw new Error("context.sentAt은 ISO 8601 형식이어야 합니다.");
  }
  if (context.schemaVersion !== "1.0") throw new Error("지원하지 않는 schemaVersion입니다.");
}

export function assertIdempotencyKey(requestId: string, idempotencyKey?: string) {
  if (!idempotencyKey) throw new Error("Idempotency-Key 헤더가 필요합니다.");
  if (idempotencyKey !== requestId) {
    throw new Error("Idempotency-Key는 context.requestId와 일치해야 합니다.");
  }
}

export function assertRequiredFields(data: Record<string, unknown>, fields: readonly string[]) {
  const missing = fields.filter((field) => data[field] === undefined || data[field] === null);
  if (missing.length) throw new Error(`필수 데이터가 누락되었습니다: ${missing.join(", ")}`);
}
