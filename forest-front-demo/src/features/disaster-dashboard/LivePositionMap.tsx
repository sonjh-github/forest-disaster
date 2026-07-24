import { useEffect, useRef, useState } from "react";
import maplibregl, { type GeoJSONSource, type Map as MapLibreMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { ApiRecord } from "../../http-api";
import type { LiveLocation } from "./UnifiedDisasterDashboard";

type Props = {
  locations: LiveLocation[];
  changedUntil: Record<string, number>;
  highlightDurationMs: number;
  eventCenter: [number, number] | null;
  focusCenter: [number, number] | null;
  eventId: string;
  showResources: boolean;
  showEvent: boolean;
  selectedKey: string | null;
  onLocationSelect: (location: LiveLocation) => void;
  domainLayers: Record<string, ApiRecord[]>;
  visibleLayerIds: Set<string>;
};

// 타일 스타일 옵션
const MAP_STYLES = {
  topo: {
    version: 8 as const,
    sources: {
      osm: {
        type: "raster" as const,
        tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
        tileSize: 256,
        attribution: "© OpenStreetMap contributors",
      },
    },
    layers: [{ id: "osm", type: "raster" as const, source: "osm", paint: { "raster-saturation": 0.1, "raster-contrast": 0.1 } }],
  },
  satellite: {
    version: 8 as const,
    sources: {
      satellite: {
        type: "raster" as const,
        tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"],
        tileSize: 256,
        attribution: "Esri World Imagery",
      },
    },
    layers: [{ id: "satellite", type: "raster" as const, source: "satellite" }],
  },
};

function keyOf(location: LiveLocation) {
  return `${location.kind}-${location.id}`;
}

const shortCategoryNames: Record<string, string> = {
  PERSONNEL: "소방/진화대원", UAV: "드론", MAIN_RELAY_DRONE: "주중계드론", SERVICE_RELAY_DRONE: "서비스드론",
  RTK_TERMINAL: "RTK단말", RTK_BASE_LPWA_GATEWAY: "RTK기준국", TVWS_BASE_STATION: "TVWS기지국",
  TVWS_CPE: "TVWS단말", LTE_GATEWAY: "LTE게이트웨이", PRIVATE_5G_NTN_GATEWAY: "특화망5G/위성",
  RADIO_GATEWAY_400MHZ: "400MHz무전", COMMAND_VEHICLE: "지휘차량", FIXED_RELAY: "고정중계기",
  MOBILE_RELAY: "이동중계기", GCS: "GCS지상통제", REF_AP: "기준AP", ROVER_AP: "이동AP",
  RSSI_DETECTOR: "RSSI탐지기", IR_UWB_GPR: "UWB생체탐지", ASSET: "현장장비",
};

function compactLabel(location: LiveLocation) {
  const type = shortCategoryNames[location.category] ?? "장비";
  const name = location.label.length > 12 ? `${location.label.slice(0, 11)}…` : location.label;
  return `[${type}] ${name}`;
}

function createLabelImage(text: string) {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) return null;
  context.font = "bold 16px 'Noto Sans KR', sans-serif";
  const width = Math.min(320, Math.ceil(context.measureText(text).width) + 24);
  canvas.width = width;
  canvas.height = 36;
  context.font = "bold 16px 'Noto Sans KR', sans-serif";
  context.fillStyle = "rgba(10, 25, 47, 0.92)";
  context.strokeStyle = "#1b4965";
  context.lineWidth = 2;
  context.beginPath();
  context.roundRect(1, 1, width - 2, 34, 6);
  context.fill();
  context.stroke();
  context.fillStyle = "#ffffff";
  context.textBaseline = "middle";
  context.fillText(text, 12, 18, width - 24);
  return context.getImageData(0, 0, width, 36);
}

const domainLayerStyle: Record<string, { type: "line" | "fill" | "circle"; color: string; opacity?: number }> = {
  firelines: { type: "line", color: "#d90429" },
  "spread-predictions": { type: "fill", color: "#f77f00", opacity: 0.25 },
  "communication-coverages": { type: "fill", color: "#0284c7", opacity: 0.2 },
  "slope-assessments": { type: "fill", color: "#7209b7", opacity: 0.2 },
  "debris-flow-paths": { type: "line", color: "#9d4edd" },
  "debris-flow-areas": { type: "fill", color: "#c77dff", opacity: 0.25 },
  "victim-candidates": { type: "circle", color: "#ef233c" },
  "rssi-detections": { type: "circle", color: "#f39c12" },
  "ai-ran-coverages": { type: "fill", color: "#0ea5e9", opacity: 0.18 },
  "relay-placement-candidates": { type: "circle", color: "#10b981" },
  "ignition-detections": { type: "circle", color: "#dc2626" },
  "vehicle-detections": { type: "circle", color: "#2563eb" },
  "road-segmentations": { type: "line", color: "#475569" },
  "change-detections": { type: "fill", color: "#eab308", opacity: 0.25 },
  "vital-signal-detections": { type: "circle", color: "#e11d48" },
};

export default function LivePositionMap({
  locations,
  changedUntil,
  eventCenter,
  focusCenter,
  eventId,
  showResources,
  showEvent,
  selectedKey,
  onLocationSelect,
  domainLayers,
  visibleLayerIds,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const popupRef = useRef<maplibregl.Popup | null>(null);
  const locationsRef = useRef(locations);
  locationsRef.current = locations;
  const onSelectRef = useRef(onLocationSelect);
  onSelectRef.current = onLocationSelect;

  const [mapStyleType, setMapStyleType] = useState<"topo" | "satellite">("topo");
  const [showLegend, setShowLegend] = useState(false);

  // 1. 지도 초기화
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const initialCenter: [number, number] = eventCenter ?? [128.5, 37.8];

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: MAP_STYLES[mapStyleType],
      center: initialCenter,
      zoom: 13,
      attributionControl: false,
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: true, showZoom: true }), "top-right");
    map.addControl(new maplibregl.ScaleControl({ unit: "metric" }), "bottom-right");

    map.on("load", () => {
      map.addSource("locations", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      map.addSource("event-center", { type: "geojson", data: { type: "FeatureCollection", features: [] } });

      // 산불/산사태 도메인 레이어 소스 생성
      Object.keys(domainLayerStyle).forEach((layerId) => {
        map.addSource(`domain-${layerId}`, { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      });

      // 도메인 레이어 렌더링 Layer 추가
      Object.entries(domainLayerStyle).forEach(([layerId, style]) => {
        if (style.type === "fill") {
          map.addLayer({
            id: `domain-layer-${layerId}`,
            type: "fill",
            source: `domain-${layerId}`,
            paint: { "fill-color": style.color, "fill-opacity": style.opacity ?? 0.2 },
          });
        } else if (style.type === "line") {
          map.addLayer({
            id: `domain-layer-${layerId}`,
            type: "line",
            source: `domain-${layerId}`,
            paint: { "line-color": style.color, "line-width": 3.5 },
          });
        } else if (style.type === "circle") {
          map.addLayer({
            id: `domain-layer-${layerId}`,
            type: "circle",
            source: `domain-${layerId}`,
            paint: {
              "circle-color": style.color,
              "circle-radius": 8,
              "circle-stroke-width": 2,
              "circle-stroke-color": "#ffffff",
            },
          });
        }
      });

      // 사건 중심점 핀
      map.addLayer({
        id: "event-center-circle",
        type: "circle",
        source: "event-center",
        paint: {
          "circle-radius": 14,
          "circle-color": "#dc2626",
          "circle-stroke-width": 4,
          "circle-stroke-color": "#ffffff",
        },
      });

      // 현장 대원/자산 위치 마커
      map.addLayer({
        id: "locations-circle",
        type: "circle",
        source: "locations",
        paint: {
          "circle-radius": ["case", ["boolean", ["get", "selected"], false], 11, 8],
          "circle-color": [
            "match",
            ["get", "category"],
            "PERSONNEL", "#e63946",
            "UAV", "#0284c7",
            "COMMAND_VEHICLE", "#2a9d8f",
            "TVWS_BASE_STATION", "#e76f51",
            "RSSI_DETECTOR", "#f4a261",
            "#1d3557"
          ],
          "circle-stroke-width": ["case", ["boolean", ["get", "selected"], false], 4, 2],
          "circle-stroke-color": "#ffffff",
        },
      });

      map.on("click", "locations-circle", (e) => {
        const feature = e.features?.[0];
        if (!feature) return;
        const key = String(feature.properties?.key);
        const match = locationsRef.current.find((item) => keyOf(item) === key);
        if (match) onSelectRef.current(match);
      });

      map.on("mouseenter", "locations-circle", () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", "locations-circle", () => {
        map.getCanvas().style.cursor = "";
      });
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // 맵 스타일(타일) 변경 적용
  useEffect(() => {
    if (!mapRef.current) return;
    mapRef.current.setStyle(MAP_STYLES[mapStyleType]);
  }, [mapStyleType]);

  // 위치 데이터 GeoJSON 업데이트
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    const locSource = map.getSource("locations") as GeoJSONSource | undefined;
    if (locSource) {
      const features = showResources
        ? locations.map((loc) => ({
            type: "Feature" as const,
            geometry: { type: "Point" as const, coordinates: [loc.longitude, loc.latitude] },
            properties: {
              key: keyOf(loc),
              category: loc.category,
              label: compactLabel(loc),
              selected: keyOf(loc) === selectedKey,
            },
          }))
        : [];
      locSource.setData({ type: "FeatureCollection", features });
    }

    const eventSource = map.getSource("event-center") as GeoJSONSource | undefined;
    if (eventSource) {
      const features = showEvent && eventCenter
        ? [{ type: "Feature" as const, geometry: { type: "Point" as const, coordinates: eventCenter }, properties: {} }]
        : [];
      eventSource.setData({ type: "FeatureCollection", features });
    }
  }, [locations, selectedKey, showResources, showEvent, eventCenter]);

  // 도메인 레이어 GeoJSON 업데이트
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    Object.keys(domainLayerStyle).forEach((layerId) => {
      const source = map.getSource(`domain-${layerId}`) as GeoJSONSource | undefined;
      if (!source) return;

      const layerData = domainLayers[layerId] ?? [];
      const isVisible = visibleLayerIds.has(layerId);

      if (!isVisible || layerData.length === 0) {
        source.setData({ type: "FeatureCollection", features: [] });
        return;
      }

      const features = layerData.map((item, idx) => {
        const geom = (item.geometry as any) ?? { type: "Point", coordinates: [128.5 + idx * 0.002, 37.8 + idx * 0.002] };
        return {
          type: "Feature" as const,
          geometry: geom,
          properties: item.properties ?? {},
        };
      });

      source.setData({ type: "FeatureCollection", features });
    });
  }, [domainLayers, visibleLayerIds]);

  // 포커스 중앙 이동
  useEffect(() => {
    if (!mapRef.current || !focusCenter) return;
    mapRef.current.flyTo({ center: focusCenter, zoom: 15, speed: 1.2 });
  }, [focusCenter]);

  return (
    <div className="map-wrapper" style={{ position: "relative", width: "100%", height: "100%" }}>
      <div ref={containerRef} className="map-canvas" style={{ width: "100%", height: "100%" }} />

      {/* 산림청 맵 도구 바 (좌측 상단 오버레이) */}
      <div className="map-toolbar">
        <div className="map-style-toggle">
          <button
            className={`map-tool-btn ${mapStyleType === "topo" ? "active" : ""}`}
            onClick={() => setMapStyleType("topo")}
          >
            🗺️ 일반 지형도
          </button>
          <button
            className={`map-tool-btn ${mapStyleType === "satellite" ? "active" : ""}`}
            onClick={() => setMapStyleType("satellite")}
          >
            🛰️ 위성 영상
          </button>
        </div>

        <button className="map-tool-btn" onClick={() => setShowLegend(!showLegend)}>
          📌 범례 안내 {showLegend ? "▲" : "▼"}
        </button>
      </div>

      {/* 지도 범례 팝오버 */}
      {showLegend && (
        <div className="map-legend-overlay">
          <div className="legend-header">
            <strong>관제 마커 & 레이어 범례</strong>
            <button onClick={() => setShowLegend(false)}>✕</button>
          </div>
          <div className="legend-body">
            <div className="legend-item"><span className="dot dot-personnel"></span> 소방/진화 대원</div>
            <div className="legend-item"><span className="dot dot-uav"></span> 드론 (UAV)</div>
            <div className="legend-item"><span className="dot dot-command"></span> 지휘 차량</div>
            <div className="legend-item"><span className="dot dot-tvws"></span> TVWS / 5G 중계기</div>
            <div className="legend-item"><span className="dot dot-detector"></span> 조난자 RSSI 탐지기</div>
            <div className="legend-item"><span className="line line-fire"></span> 산불 관측 화선 (실선)</div>
            <div className="legend-item"><span className="area area-spread"></span> 확산 예측 구역 (점선/면)</div>
            <div className="legend-item"><span className="area area-landslide"></span> 토사류/사면 위험구역</div>
          </div>
        </div>
      )}
    </div>
  );
}
