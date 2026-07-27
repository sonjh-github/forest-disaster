import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { forestApi, loadEventOverview, type EventOverview, type ForestEvent, type ApiRecord } from "../../http-api";
import LivePositionMap from "./LivePositionMap";
import { OperationsPanel, type PanelTab } from "./OperationsPanel";
import { DomainFeatureModals } from "./DomainFeatureModals";
import { HardwareServerPanel } from "./HardwareServerPanel";
import "./unified-disaster-dashboard.css";

const POLL_INTERVAL_MS = 1_000;
const DEFAULT_CHANGE_HIGHLIGHT_MS = POLL_INTERVAL_MS * 0.3;

function text(value: unknown, fallback = "-") { return value == null || value === "" ? fallback : String(value); }
const koreanLabels: Record<string, string> = {
  WILDFIRE: "산불 재난",
  LANDSLIDE: "산사태 재난",
  COMPLEX: "복합 재난",
  RESPONDING: "대응 중",
  CLOSED: "종료",
  READY: "대기",
  ACTIVE: "활성",
  INACTIVE: "비활성",
  RESOLVED: "해제",
  FLYING: "비행 중",
  TAKING_OFF: "이륙 중",
  RETURNING: "복귀 중",
  MOVING: "이동 중",
  PATROLLING: "순찰 중",
  SEARCHING: "수색 중",
  APPROACHING: "접근 중",
  EVACUATING: "대피 중",
  HOLDING: "현장 대기",
  STOPPED: "정지",
  SAFE: "안전",
  CAUTION: "주의",
  WARNING: "경계",
  CRITICAL: "심각",
  SEVERE: "위험",
  MODERATE: "보통",
  LOW: "낮음",
  NORMAL: "정상",
  DEGRADED: "성능 저하",
  DEPLOYING: "구축 중",
  CALIBRATING: "보정 중",
  SIGNAL_LOST: "신호 끊김",
  BOOTING: "시작 중",
  FAILED: "고장",
  UNKNOWN: "확인 필요",
};
function korean(value: unknown, fallback = "-") {
  const raw = text(value, fallback);
  return koreanLabels[raw] ?? raw.replaceAll("_", " ");
}

export type ResourceGroup = "PERSONNEL" | "UAV" | "COMMAND" | "POSITIONING" | "COMMUNICATION" | "DETECTION" | "OTHER";

export type LiveLocation = {
  id: string;
  kind: "personnel" | "asset";
  label: string;
  status: string;
  longitude: number;
  latitude: number;
  altitude: number | null;
  observedAt: string;
  category: string;
  batteryPct: number | null;
  signalStrengthDbm: number | null;
  latencyMs: number | null;
  packetLossPct: number | null;
  safetyStatus: string;
  sourceSystem: string;
};

function locationFrom(item: Record<string, unknown>, kind: LiveLocation["kind"]): LiveLocation | null {
  const geometry = item.geometry as { coordinates?: unknown[] } | undefined;
  const coordinates = geometry?.coordinates;
  const longitude = Number(coordinates?.[0]);
  const latitude = Number(coordinates?.[1]);
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) return null;
  const altitudeValue = Number(coordinates?.[2]);
  return {
    id: String(kind === "personnel" ? item.personExternalId : item.assetId),
    kind,
    label: String(kind === "personnel" ? item.personExternalId : item.assetName ?? item.assetCode ?? item.assetId),
    status: korean(kind === "personnel" ? item.activityStatus ?? item.safetyStatus : item.operationalStatus),
    longitude,
    latitude,
    altitude: Number.isFinite(altitudeValue) ? altitudeValue : null,
    observedAt: String(item.observedAt ?? ""),
    category: String(kind === "personnel" ? "PERSONNEL" : item.assetType ?? "ASSET"),
    batteryPct: Number.isFinite(Number(item.batteryPct)) ? Number(item.batteryPct) : null,
    signalStrengthDbm: Number.isFinite(Number(item.signalStrengthDbm)) ? Number(item.signalStrengthDbm) : null,
    latencyMs: Number.isFinite(Number(item.latencyMs)) ? Number(item.latencyMs) : null,
    packetLossPct: Number.isFinite(Number(item.packetLossPct)) ? Number(item.packetLossPct) : null,
    safetyStatus: korean(item.safetyStatus ?? "UNKNOWN"),
    sourceSystem: String(item.sourceSystem ?? ""),
  };
}

function locationKey(item: LiveLocation) { return `${item.kind}-${item.id}`; }
function locationFingerprint(item: LiveLocation) {
  return [item.longitude, item.latitude, item.altitude, item.status, item.observedAt].join("|");
}

function overviewLocations(overview: EventOverview): LiveLocation[] {
  return [
    ...overview.personnel.map((item) => locationFrom(item, "personnel")),
    ...overview.assets.map((item) => locationFrom(item, "asset")),
  ].filter((item): item is LiveLocation => item !== null);
}

export default function UnifiedDisasterDashboard() {
  const [events, setEvents] = useState<ForestEvent[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [overview, setOverview] = useState<EventOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [eventsLoaded, setEventsLoaded] = useState(false);
  const [changedUntil, setChangedUntil] = useState<Record<string, number>>({});
  const previousLocationsRef = useRef<Map<string, string> | null>(null);
  const [operationsTab, setOperationsTab] = useState<PanelTab>("layers");
  const [selectedLocationKey, setSelectedLocationKey] = useState<string | null>(null);

  // 모달 제어 상태
  const [activeModal, setActiveModal] = useState<"3d-dxf" | "data-platform" | "vr-validation" | "audit-diag" | null>(null);

  // 지도 레이어 가시성
  const [visibleLayerIds, setVisibleLayerIds] = useState(() => new Set([
    "resources", "firelines", "spread-predictions", "slope-assessments",
    "debris-flow-paths", "victim-candidates", "communication-coverages",
  ]));

  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);

  // 사건 목록 조회
  const refreshEvents = useCallback(async () => {
    const result = await forestApi.events(100);
    const sorted = [...result.data].sort((a, b) =>
      Date.parse(String(b.updatedAt ?? b.occurredAt ?? 0)) - Date.parse(String(a.updatedAt ?? a.occurredAt ?? 0))
    );
    setEvents(sorted);
    setSelectedId((current) => current || sorted[0]?.eventId || "");
  }, []);

  // 선택 사건 데이터 Polling
  const refreshOverview = useCallback(async () => {
    const selected = events.find((event) => event.eventId === selectedId);
    if (!selected) return;
    const result = await loadEventOverview(selected);
    const locations = overviewLocations(result);
    const current = new Map(locations.map((item) => [locationKey(item), locationFingerprint(item)]));

    previousLocationsRef.current = current;
    setOverview(result);
    setLastUpdatedAt(new Date());
  }, [events, selectedId]);

  useEffect(() => {
    let active = true;
    refreshEvents()
      .catch((caught) => active && setError(caught instanceof Error ? caught.message : "사건 목록 조회 실패"))
      .finally(() => active && setEventsLoaded(true));
    return () => { active = false; };
  }, [refreshEvents]);

  useEffect(() => {
    if (!selectedId) return;
    let active = true;
    const poll = () => {
      refreshOverview().catch((caught) => active && setError(caught instanceof Error ? caught.message : "개요 조회 실패"));
    };
    poll();
    const interval = window.setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [refreshOverview, selectedId]);

  const selectedEvent = useMemo(() => events.find((e) => e.eventId === selectedId), [events, selectedId]);
  const locations = useMemo(() => (overview ? overviewLocations(overview) : []), [overview]);

  const selectedLocation = useMemo(() => {
    if (!selectedLocationKey) return null;
    return locations.find((item) => locationKey(item) === selectedLocationKey) ?? null;
  }, [locations, selectedLocationKey]);

  // 통계 계산
  const personnelCount = useMemo(() => locations.filter((l) => l.kind === "personnel").length, [locations]);
  const assetCount = useMemo(() => locations.filter((l) => l.kind === "asset").length, [locations]);
  const alertCount = useMemo(() => overview?.alerts.length ?? 0, [overview]);
  const networkCount = useMemo(() => overview?.networks.length ?? 0, [overview]);

  const handleToggleLayer = (layerId: string) => {
    setVisibleLayerIds((prev) => {
      const next = new Set(prev);
      if (next.has(layerId)) next.delete(layerId);
      else next.add(layerId);
      return next;
    });
  };

  const handleAcknowledgeAlert = async (alertId: string) => {
    try {
      await forestApi.acknowledgeAlert(alertId);
      refreshOverview();
      alert("경보 수신확인 처리가 완료되었습니다.");
    } catch {
      alert("경보 처리 중 오류가 발생했습니다.");
    }
  };

  return (
    <div className="unified-kfs-dashboard">
      {/* 1. 최상단 산림청 공식 메인 헤더 */}
      <header className="kfs-header">
        <div className="kfs-logo-area">
          <div className="kfs-emblem">🌲</div>
          <div className="kfs-header-title">
            <h2>대한민국 산림청 <span className="sub-title">산림재난 통합관제 실증 시스템</span></h2>
          </div>
        </div>

        {/* 사건 선택기 & 심각도 배지 */}
        <div className="event-selector-group">
          <span className="selector-label">관제 재난사건:</span>
          <select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            className="event-dropdown"
          >
            {events.map((ev) => (
              <option key={ev.eventId} value={ev.eventId}>
                [{korean(ev.disasterType ?? "WILDFIRE")}] {ev.eventName ?? ev.eventCode ?? ev.eventId} ({ev.locationName ?? "현장"})
              </option>
            ))}
          </select>

          {selectedEvent && (
            <span className={`severity-badge severity-${selectedEvent.severityCode ?? "WARNING"}`}>
              {korean(selectedEvent.severityCode ?? "경계")}
            </span>
          )}
        </div>

        {/* GNB 메인 메뉴 툴바 */}
        <div className="gnb-nav-toolbar">
          <button className="gnb-btn" onClick={() => setActiveModal("3d-dxf")}>
            📐 3D 지형 CAD 변환
          </button>
          <button className="gnb-btn" onClick={() => setActiveModal("data-platform")}>
            📊 실증 데이터셋/LLM
          </button>
          <button className="gnb-btn" onClick={() => setActiveModal("vr-validation")}>
            🥽 VR 가상검증
          </button>
          <button className="gnb-btn" onClick={() => setActiveModal("audit-diag")}>
            🔍 시스템 감사/진단
          </button>
        </div>

        <div className="header-status">
          <span className="live-indicator">● LIVE 1s</span>
          <span className="last-sync">{lastUpdatedAt ? lastUpdatedAt.toLocaleTimeString() : "-"}</span>
        </div>
      </header>

      {/* 2. 상단 관제 KPI 지표 바 */}
      <div className="kfs-kpi-bar">
        <div className="kpi-card" onClick={() => setOperationsTab("resources")}>
          <div className="kpi-icon">👨‍🚒</div>
          <div className="kpi-info">
            <span className="kpi-label">투입 소방/진화대원</span>
            <span className="kpi-value">{personnelCount}<span className="kpi-unit">명</span></span>
          </div>
        </div>

        <div className="kpi-card" onClick={() => setOperationsTab("resources")}>
          <div className="kpi-icon">🛸</div>
          <div className="kpi-info">
            <span className="kpi-label">운용 드론/현장장비</span>
            <span className="kpi-value">{assetCount}<span className="kpi-unit">대</span></span>
          </div>
        </div>

        <div className="kpi-card" onClick={() => setOperationsTab("networks")}>
          <div className="kpi-icon">📡</div>
          <div className="kpi-info">
            <span className="kpi-label">긴급 통신망 가용률</span>
            <span className="kpi-value">99.8<span className="kpi-unit">%</span></span>
          </div>
        </div>

        <div className="kpi-card alert-kpi" onClick={() => setOperationsTab("alerts")}>
          <div className="kpi-icon">🚨</div>
          <div className="kpi-info">
            <span className="kpi-label">활성 재난 경보</span>
            <span className="kpi-value alert-text">{alertCount}<span className="kpi-unit">건</span></span>
          </div>
        </div>
      </div>

      {/* 3. 중앙 GIS 지도 및 오퍼레이션 우측 패널 */}
      <HardwareServerPanel />

      <main className="dashboard-main-content">
        {/* 지도 영역 */}
        <div className="map-container-area">
          <LivePositionMap
            locations={locations}
            changedUntil={changedUntil}
            highlightDurationMs={300}
            eventCenter={
              selectedEvent?.geometry?.coordinates
                ? [Number(selectedEvent.geometry.coordinates[0]), Number(selectedEvent.geometry.coordinates[1])]
                : null
            }
            focusCenter={selectedLocation ? [selectedLocation.longitude, selectedLocation.latitude] : null}
            eventId={selectedId}
            showResources={visibleLayerIds.has("resources")}
            showEvent={true}
            selectedKey={selectedLocationKey}
            onLocationSelect={(loc) => setSelectedLocationKey(locationKey(loc))}
            domainLayers={overview?.domainLayers ?? {}}
            visibleLayerIds={visibleLayerIds}
          />

          {/* 선택 자산/대원 팝오버 상세 서랍 */}
          {selectedLocation && (
            <div className="location-detail-drawer">
              <div className="drawer-header">
                <h4>{selectedLocation.label} 상세 정보</h4>
                <button onClick={() => setSelectedLocationKey(null)}>✕</button>
              </div>
              <div className="drawer-body">
                <p><strong>구분:</strong> {selectedLocation.kind === "personnel" ? "소방대원" : "장비"}</p>
                <p><strong>상태:</strong> <span className="status-badge">{selectedLocation.status}</span></p>
                <p><strong>위치:</strong> {selectedLocation.latitude.toFixed(5)}, {selectedLocation.longitude.toFixed(5)}</p>
                <p><strong>배터리:</strong> {selectedLocation.batteryPct != null ? `${selectedLocation.batteryPct}%` : "-"}</p>
                <p><strong>신호강도:</strong> {selectedLocation.signalStrengthDbm != null ? `${selectedLocation.signalStrengthDbm} dBm` : "-"}</p>
                <p><strong>안전 판정:</strong> <strong>{selectedLocation.safetyStatus}</strong></p>
                <p><strong>수신 시각:</strong> {selectedLocation.observedAt}</p>
              </div>
            </div>
          )}
        </div>

        {/* 우측 오퍼레이션 컨트롤 패널 */}
        <div className="operations-panel-area">
          <OperationsPanel
            activeTab={operationsTab}
            onTabChange={setOperationsTab}
            locations={locations}
            selectedLocationKey={selectedLocationKey}
            onLocationSelect={(loc) => setSelectedLocationKey(locationKey(loc))}
            visibleLayerIds={visibleLayerIds}
            onToggleLayer={handleToggleLayer}
            alerts={overview?.alerts ?? []}
            networks={overview?.networks ?? []}
            onAcknowledgeAlert={handleAcknowledgeAlert}
          />
        </div>
      </main>

      {/* 4. 신규 특화 기능 모달 들 */}
      <DomainFeatureModals activeModal={activeModal} onClose={() => setActiveModal(null)} />
    </div>
  );
}
