import React, { useState } from "react";
import type { LiveLocation, ResourceGroup } from "./UnifiedDisasterDashboard";
import type { ApiRecord } from "../../http-api";

export type PanelTab = "layers" | "resources" | "alerts" | "networks" | "missions";

type OperationsPanelProps = {
  activeTab: PanelTab;
  onTabChange: (tab: PanelTab) => void;
  locations: LiveLocation[];
  selectedLocationKey: string | null;
  onLocationSelect: (location: LiveLocation) => void;
  visibleLayerIds: Set<string>;
  onToggleLayer: (layerId: string) => void;
  alerts: ApiRecord[];
  networks: ApiRecord[];
  onAcknowledgeAlert: (alertId: string) => void;
};

const resourceGroupLabels: Record<ResourceGroup, string> = {
  PERSONNEL: "소방/진화대원",
  UAV: "무인기 (드론)",
  COMMAND: "지휘 차량/GCS",
  POSITIONING: "RTK/위치장비",
  COMMUNICATION: "통신중계기",
  DETECTION: "탐지 센서",
  OTHER: "기타 장비",
};

export const OperationsPanel: React.FC<OperationsPanelProps> = ({
  activeTab,
  onTabChange,
  locations,
  selectedLocationKey,
  onLocationSelect,
  visibleLayerIds,
  onToggleLayer,
  alerts,
  networks,
  onAcknowledgeAlert,
}) => {
  const [resourceFilter, setResourceFilter] = useState<ResourceGroup | "ALL">("ALL");
  const [missionTarget, setMissionTarget] = useState("");
  const [missionText, setMissionText] = useState("");
  const [missions, setMissions] = useState<Array<{ id: string; target: string; text: string; status: string; time: string }>>([
    { id: "M01", target: "삼척소방 1팀", text: "산사태 위험구역 B-3 대피명령 전달", status: "수신완료", time: "10:14" },
  ]);

  const filteredLocations = locations.filter((loc) => {
    if (resourceFilter === "ALL") return true;
    if (resourceFilter === "PERSONNEL") return loc.kind === "personnel";
    if (resourceFilter === "UAV") return ["UAV", "MAIN_RELAY_DRONE", "SERVICE_RELAY_DRONE"].includes(loc.category);
    if (resourceFilter === "COMMAND") return ["COMMAND_VEHICLE", "GCS"].includes(loc.category);
    if (resourceFilter === "COMMUNICATION") return ["TVWS_BASE_STATION", "TVWS_CPE", "LTE_GATEWAY", "PRIVATE_5G_NTN_GATEWAY", "RADIO_GATEWAY_400MHZ", "FIXED_RELAY", "MOBILE_RELAY"].includes(loc.category);
    if (resourceFilter === "DETECTION") return ["RSSI_DETECTOR", "IR_UWB_GPR"].includes(loc.category);
    return true;
  });

  const handleCreateMission = (e: React.FormEvent) => {
    e.preventDefault();
    if (!missionText || !missionTarget) return;
    const newMission = {
      id: `M0${missions.length + 1}`,
      target: missionTarget,
      text: missionText,
      status: "전송중",
      time: new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" }),
    };
    setMissions([newMission, ...missions]);
    setMissionText("");
    alert(`[명령 발행] '${missionTarget}' 대상 지시사항이 현장 단말로 발송되었습니다.`);
  };

  return (
    <div className="operations-panel">
      {/* 탭 헤더 */}
      <div className="panel-tab-bar">
        <button className={`panel-tab ${activeTab === "layers" ? "active" : ""}`} onClick={() => onTabChange("layers")}>
          🗺️ 레이어
        </button>
        <button className={`panel-tab ${activeTab === "resources" ? "active" : ""}`} onClick={() => onTabChange("resources")}>
          👨‍🚒 자산·대원 ({locations.length})
        </button>
        <button className={`panel-tab ${activeTab === "alerts" ? "active" : ""}`} onClick={() => onTabChange("alerts")}>
          🚨 경보 ({alerts.length})
        </button>
        <button className={`panel-tab ${activeTab === "networks" ? "active" : ""}`} onClick={() => onTabChange("networks")}>
          📡 통신망 ({networks.length})
        </button>
        <button className={`panel-tab ${activeTab === "missions" ? "active" : ""}`} onClick={() => onTabChange("missions")}>
          📝 현장명령
        </button>
      </div>

      {/* 탭 본문 */}
      <div className="panel-content">
        {/* 1. GIS 레이어 제어 */}
        {activeTab === "layers" && (
          <div className="layer-control-view">
            <h4 className="panel-section-title">GIS 관제 레이어 표출 설정</h4>

            <div className="layer-group">
              <div className="layer-group-title">🔥 산불 대응 레이어</div>
              <label className="layer-checkbox-label">
                <input
                  type="checkbox"
                  checked={visibleLayerIds.has("firelines")}
                  onChange={() => onToggleLayer("firelines")}
                />
                <span className="color-indicator fireline-color"></span> 관측 화선 (Firelines)
              </label>
              <label className="layer-checkbox-label">
                <input
                  type="checkbox"
                  checked={visibleLayerIds.has("spread-predictions")}
                  onChange={() => onToggleLayer("spread-predictions")}
                />
                <span className="color-indicator spread-color"></span> AI 확산 예측 구역
              </label>
            </div>

            <div className="layer-group mt-2">
              <div className="layer-group-title">⛰️ 산사태 대응 레이어</div>
              <label className="layer-checkbox-label">
                <input
                  type="checkbox"
                  checked={visibleLayerIds.has("slope-assessments")}
                  onChange={() => onToggleLayer("slope-assessments")}
                />
                <span className="color-indicator slope-color"></span> 사면 붕괴 위험 평가 구역
              </label>
              <label className="layer-checkbox-label">
                <input
                  type="checkbox"
                  checked={visibleLayerIds.has("victim-candidates")}
                  onChange={() => onToggleLayer("victim-candidates")}
                />
                <span className="color-indicator victim-color"></span> RSSI/TDOA 융합 조난자 추정지점
              </label>
              <label className="layer-checkbox-label">
                <input
                  type="checkbox"
                  checked={visibleLayerIds.has("debris-flow-paths")}
                  onChange={() => onToggleLayer("debris-flow-paths")}
                />
                <span className="color-indicator debris-color"></span> 토사류 이동 예상 경로
              </label>
            </div>

            <div className="layer-group mt-2">
              <div className="layer-group-title">📡 통신 및 현장 장비 레이어</div>
              <label className="layer-checkbox-label">
                <input
                  type="checkbox"
                  checked={visibleLayerIds.has("communication-coverages")}
                  onChange={() => onToggleLayer("communication-coverages")}
                />
                <span className="color-indicator wifi-color"></span> TVWS / 5G / LEO 중계 커버리지
              </label>
              <label className="layer-checkbox-label">
                <input
                  type="checkbox"
                  checked={visibleLayerIds.has("resources")}
                  onChange={() => onToggleLayer("resources")}
                />
                <span className="color-indicator resource-color"></span> 대원 및 장비 실시간 위치 마커
              </label>
            </div>
          </div>
        )}

        {/* 2. 자산 및 인력 목록 */}
        {activeTab === "resources" && (
          <div className="resources-view">
            <div className="resource-filter-bar">
              <button
                className={`filter-chip ${resourceFilter === "ALL" ? "active" : ""}`}
                onClick={() => setResourceFilter("ALL")}
              >
                전체 ({locations.length})
              </button>
              {(Object.keys(resourceGroupLabels) as ResourceGroup[]).map((group) => (
                <button
                  key={group}
                  className={`filter-chip ${resourceFilter === group ? "active" : ""}`}
                  onClick={() => setResourceFilter(group)}
                >
                  {resourceGroupLabels[group]}
                </button>
              ))}
            </div>

            <div className="resource-card-list">
              {filteredLocations.length === 0 ? (
                <div className="empty-state">해당 유형의 등록된 대원/장비가 없습니다.</div>
              ) : (
                filteredLocations.map((loc) => {
                  const key = `${loc.kind}-${loc.id}`;
                  const isSelected = key === selectedLocationKey;

                  return (
                    <div
                      key={key}
                      className={`resource-card ${isSelected ? "selected" : ""}`}
                      onClick={() => onLocationSelect(loc)}
                    >
                      <div className="card-top">
                        <span className={`status-tag status-${loc.status}`}>{loc.status}</span>
                        <span className="resource-name">{loc.label}</span>
                      </div>
                      <div className="card-details">
                        <span>배터리: {loc.batteryPct != null ? `${loc.batteryPct}%` : "-"}</span>
                        <span>신호: {loc.signalStrengthDbm != null ? `${loc.signalStrengthDbm}dBm` : "-"}</span>
                        <span>상태: <strong className="safety-text">{loc.safetyStatus}</strong></span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* 3. 경보 센터 */}
        {activeTab === "alerts" && (
          <div className="alerts-view">
            <h4 className="panel-section-title">실시간 재난/장비 경보 이력</h4>
            <div className="alert-list">
              {alerts.length === 0 ? (
                <div className="empty-state">현재 발령된 치명 경보가 없습니다. (정상)</div>
              ) : (
                alerts.map((alertItem, idx) => {
                  const isAck = alertItem.acknowledgedAt != null;
                  return (
                    <div key={idx} className={`alert-card severity-${alertItem.severityCode ?? "WARNING"}`}>
                      <div className="alert-card-header">
                        <span className="alert-badge">{String(alertItem.severityCode ?? "경보")}</span>
                        <span className="alert-title">{String(alertItem.alertMessage ?? alertItem.title ?? "경보 발생")}</span>
                      </div>
                      <div className="alert-time-info">
                        발생: {String(alertItem.issuedAt ?? alertItem.createdAt ?? "-")}
                      </div>
                      <div className="alert-card-footer">
                        {isAck ? (
                          <span className="ack-done">✅ 지휘관 수신확인 완료</span>
                        ) : (
                          <button
                            className="kfs-btn kfs-btn-danger compact"
                            onClick={() => onAcknowledgeAlert(String(alertItem.alertId ?? alertItem.id))}
                          >
                            🖐️ 수신확인 (Acknowledge)
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* 4. 통신망 관제 */}
        {activeTab === "networks" && (
          <div className="networks-view">
            <h4 className="panel-section-title">현장 긴급 통신망 품질 및 전환 이력</h4>
            <div className="network-card-grid">
              {networks.map((net, idx) => (
                <div key={idx} className="network-card">
                  <div className="network-header">
                    <span className="network-name">{String(net.networkName ?? net.networkType ?? "통신망")}</span>
                    <span className="badge badge-success">정상가동</span>
                  </div>
                  <div className="network-stats">
                    <div>신호강도: <strong>{String(net.signalStrengthDbm ?? -68)} dBm</strong></div>
                    <div>지연시간: <strong>{String(net.latencyMs ?? 14)} ms</strong></div>
                    <div>손실률: <strong>{String(net.packetLossPct ?? 0.1)}%</strong></div>
                  </div>
                </div>
              ))}
            </div>

            <div className="network-switch-log mt-3">
              <h5>🔄 최근 망 자동전환 (Failover) 이력</h5>
              <div className="log-item">
                <span className="log-time">10:12:45</span>
                <span>TVWS 3번 중계기 신호감쇄 (-92dBm) → <strong>LEO 위성망 자동 전환 (0.4초 소요)</strong></span>
              </div>
            </div>
          </div>
        )}

        {/* 5. 현장 지휘 명령 */}
        {activeTab === "missions" && (
          <div className="missions-view">
            <h4 className="panel-section-title">현장 대원/차량 지휘 명령 하달</h4>
            <form onSubmit={handleCreateMission} className="mission-form">
              <div className="form-group">
                <label>수신 대상</label>
                <select value={missionTarget} onChange={(e) => setMissionTarget(e.target.value)} className="kfs-select">
                  <option value="">대원/팀 선택...</option>
                  <option value="삼척소방 1팀">삼척소방 1팀 (대원 6명)</option>
                  <option value="산불진화 2분대">산불진화 2분대</option>
                  <option value="드론 수색조">드론 수색조 (UAV 2대)</option>
                </select>
              </div>
              <div className="form-group">
                <label>지시 사항 (한국어 표준)</label>
                <textarea
                  rows={3}
                  value={missionText}
                  onChange={(e) => setMissionText(e.target.value)}
                  placeholder="예: 산사태 위험지점 B구역 대원 철수 및 안전지역 대피 지시"
                  className="kfs-textarea"
                />
              </div>
              <button type="submit" className="kfs-btn kfs-btn-primary full-width">
                📡 현장 단말 명령 전송
              </button>
            </form>

            <div className="mission-history mt-3">
              <h5>발행된 명령 이력</h5>
              {missions.map((m) => (
                <div key={m.id} className="mission-item">
                  <div className="mission-head">
                    <strong>[{m.target}]</strong> <span className="time">{m.time}</span>
                    <span className="badge badge-info">{m.status}</span>
                  </div>
                  <div className="mission-body">{m.text}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
