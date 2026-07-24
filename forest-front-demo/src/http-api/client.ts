const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000").replace(/\/+$/, "");

export class HttpApiError extends Error {
  constructor(readonly status: number, readonly payload: unknown) {
    super(typeof payload === "object" && payload && "error" in payload
      ? String((payload as { error?: { message?: string } }).error?.message ?? `HTTP ${status}`)
      : `HTTP ${status}`);
    this.name = "HttpApiError";
  }
}

// GitHub Pages 등 정적 호스팅 시 서버 연결 실패 대비 Fallback 데이터
const MOCK_FALLBACK_EVENTS = [
  {
    eventId: "EVT-2026-SAMCHOK-01",
    eventCode: "WF-2026-001",
    disasterType: "WILDFIRE",
    eventName: "강원 삼척 둔전리 산불 대응 관제",
    status: "RESPONDING",
    severityCode: "CRITICAL",
    locationName: "강원 특별자치도 삼척시 둔전리 산 42-1",
    occurredAt: "2026-07-24T08:30:00Z",
    updatedAt: new Date().toISOString(),
    geometry: { type: "Point", coordinates: [129.165, 37.442] },
  },
  {
    eventId: "EVT-2026-BOSEONG-02",
    eventCode: "LS-2026-002",
    disasterType: "LANDSLIDE",
    eventName: "전남 보성 율어면 산사태 및 조난자 수색",
    status: "RESPONDING",
    severityCode: "SEVERE",
    locationName: "전라남도 보성군 율어면 선적리 산 18",
    occurredAt: "2026-07-24T09:15:00Z",
    updatedAt: new Date().toISOString(),
    geometry: { type: "Point", coordinates: [127.185, 34.823] },
  },
];

const MOCK_FALLBACK_PERSONNEL = [
  {
    personExternalId: "소방관_김철수",
    activityStatus: "SAFE",
    safetyStatus: "SAFE",
    observedAt: new Date().toISOString(),
    batteryPct: 88,
    signalStrengthDbm: -65,
    sourceSystem: "RTK-TERMINAL",
    geometry: { type: "Point", coordinates: [129.166, 37.443] },
  },
  {
    personExternalId: "진화대_이영희",
    activityStatus: "CAUTION",
    safetyStatus: "CAUTION",
    observedAt: new Date().toISOString(),
    batteryPct: 72,
    signalStrengthDbm: -82,
    sourceSystem: "400MHZ-RADIO",
    geometry: { type: "Point", coordinates: [129.164, 37.441] },
  },
];

const MOCK_FALLBACK_ASSETS = [
  {
    assetId: "DRONE-UAV-01",
    assetName: "열화상 관측 드론 #1",
    assetType: "UAV",
    operationalStatus: "FLYING",
    observedAt: new Date().toISOString(),
    batteryPct: 94,
    signalStrengthDbm: -58,
    sourceSystem: "GCS-KFS",
    geometry: { type: "Point", coordinates: [129.167, 37.444] },
  },
  {
    assetId: "TVWS-STATION-01",
    assetName: "이동형 TVWS 기지국 #1",
    assetType: "TVWS_BASE_STATION",
    operationalStatus: "NORMAL",
    observedAt: new Date().toISOString(),
    batteryPct: 100,
    signalStrengthDbm: -45,
    sourceSystem: "NMS-KFS",
    geometry: { type: "Point", coordinates: [129.162, 37.440] },
  },
];

export async function httpApi<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("X-Origin", "forest-front-demo");
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");

  try {
    const response = await fetch(`${API_BASE_URL}${path}`, { ...init, headers });
    const payload = response.status === 204 ? null : await response.json().catch(() => null);
    if (!response.ok) throw new HttpApiError(response.status, payload);
    return payload as T;
  } catch (error) {
    // 백엔드 API 연결 불가 시 (GitHub Pages 정적 데모 등) Mock Fallback 데이터 제공
    console.warn(`[API Fallback] 백엔드 연결 불가 (${path}). 데모 모드가 활성화됩니다.`);
    
    if (path.includes("/api/v1/events?")) {
      return { data: MOCK_FALLBACK_EVENTS, page: { limit: 50, nextCursor: null } } as unknown as T;
    }
    if (path.includes("/personnel-positions/latest")) {
      return { data: MOCK_FALLBACK_PERSONNEL, page: { limit: 50, nextCursor: null } } as unknown as T;
    }
    if (path.includes("/asset-statuses/latest")) {
      return { data: MOCK_FALLBACK_ASSETS, page: { limit: 50, nextCursor: null } } as unknown as T;
    }
    if (path.includes("/events/")) {
      return { data: MOCK_FALLBACK_EVENTS[0] } as unknown as T;
    }
    if (path.includes("/integrations")) {
      return { data: [] } as unknown as T;
    }

    return { data: [] } as unknown as T;
  }
}
